import { useEffect, useState } from 'react'
import { contexteTp3 } from '../examen/catalogue'
import { MISE_EN_PAGE } from '../miseEnPage'
import type { ResultatPosition } from '../sim/position'

export type ContexteTp3 = ReturnType<typeof contexteTp3>

/** Courbe sous-échantillonnée (figures) : au plus `points` échantillons entre les indices i0 et i1 */
export function decimer(r: ResultatPosition, i0 = 0, i1 = r.t.length - 1, points: number = MISE_EN_PAGE.identification.pointsTrace): ResultatPosition {
  const pas = Math.max(1, Math.floor((i1 - i0) / points))
  const garder = (x: Float64Array) => Float64Array.from({ length: Math.floor((i1 - i0) / pas) + 1 }, (_, k) => x[i0 + k * pas]!)
  return { ...r, t: garder(r.t), voie1: garder(r.voie1), voie2: garder(r.voie2), voie3: garder(r.voie3), voie4: garder(r.voie4), theta: garder(r.theta), commande: garder(r.commande) }
}

/** Contexte allégé pour le transfert depuis le Worker : courbes réduites à la fenêtre des figures */
export function alleger(c: ContexteTp3): ContexteTp3 {
  const fenetre = (r: ResultatPosition) => {
    const i0 = r.t.length >> 1
    const i1 = Math.min(r.t.length - 1, i0 + Math.round(MISE_EN_PAGE.disque.fenetreFigure / (r.t[1]! - r.t[0]!)))
    return decimer(r, i0, i1)
  }
  const essai = <T extends { r: ResultatPosition }>(a: T): T => ({ ...a, r: fenetre(a.r) })
  return { ...c, rampe: { ...c.rampe, r: decimer(c.rampe.r) }, k7: essai(c.k7), k9: essai(c.k9), k1: essai(c.k1), comparaison: { ...c.comparaison, essais: c.comparaison.essais.map((x) => ({ ...x, a: essai(x.a) })) } }
}

let cache: ContexteTp3 | null = null
let calcul: Promise<ContexteTp3> | null = null

/** Un seul Worker pour toute la vie de la page (StrictMode monte les effets deux fois : pas de Worker arrêté en plein chargement) */
const calculer = () =>
  (calcul ??= new Promise<ContexteTp3>((fin) => {
    const w = new Worker(new URL('./contexte.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<ContexteTp3>) => {
      cache = e.data
      fin(e.data)
      w.terminate()
    }
    w.postMessage(null)
  }))

/** Réponses attendues du TP3, calculées une fois dans un Worker (aucune image bloquée pendant le mode temps réel) */
export function useContexteTp3(): ContexteTp3 | null {
  // Sans Worker (rendu serveur, tests) : calcul synchrone
  const [ctx, setCtx] = useState(() => cache ?? (typeof Worker === 'undefined' ? (cache = contexteTp3()) : null))
  useEffect(() => {
    if (cache) return
    let monte = true
    void calculer().then((c) => monte && setCtx(c))
    return () => {
      monte = false
    }
  }, [])
  return ctx
}
