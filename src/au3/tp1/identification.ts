import { au3 } from '../../data/reference'
import type { Csv } from '../instruments/oscillo'
import type { ResultatFit } from '../session'
import { indicielleNormalisee } from './abaque'

/**
 * Identification « moindres carrés » (remplace main_ident.m, énoncé I.2.3) : Nelder–Mead sur le .csv exporté.
 * Critère = Σ (valeur simulée − valeur mesurée)² sur l'échelon positif affiché.
 * Modèle « en variation » : m(t) = m0 + G0·ΔU·s(t), s = réponse indicielle unitaire d'ordre 1 ou 2.
 */

/** Échelon positif extrait du .csv : instants ≥ 0 tant que l'entrée reste au niveau haut */
export interface Fenetre {
  t: number[]
  m: number[]
  /** Valeur initiale de la mesure (moyenne avant le déclenchement) */
  m0: number
  /** Variation de l'entrée (crête à crête) */
  du: number
}

const moyenne = (x: number[]) => x.reduce((a, b) => a + b, 0) / Math.max(1, x.length)

/** Colonnes « Volt » de la voie 1 (entrée U) et de la voie 2 (mesure M) ; null si absentes */
export function fenetreEchelon(csv: Csv): Fenetre | null {
  const noms = csv.entetes[0] ?? []
  const iu = noms.indexOf('1')
  const im = noms.indexOf('2')
  const t = csv.colonnes[0]
  const u = csv.colonnes[iu]
  const m = csv.colonnes[im]
  if (!t || !u || !m || iu < 0 || im < 0) return null
  const avant = t.flatMap((x, i) => (x < 0 ? [i] : []))
  const uAvant = avant.length ? moyenne(avant.map((i) => u[i]!)) : u[0]!
  const m0 = avant.length ? moyenne(avant.map((i) => m[i]!)) : m[0]!
  const debut = t.findIndex((x) => x >= 0)
  if (debut < 0) return null
  let uHaut = u[debut]!
  for (let i = debut; i < u.length; i++) uHaut = Math.max(uHaut, u[i]!)
  const milieu = (uAvant + uHaut) / 2
  const fin = u.findIndex((x, i) => i > debut && x < milieu)
  const n = fin < 0 ? u.length : fin
  if (n - debut < 2 || uHaut <= uAvant) return null
  const indices = Array.from({ length: n - debut }, (_, k) => debut + k)
  return { t: indices.map((i) => t[i]!), m: indices.map((i) => m[i]!), m0, du: moyenne(indices.map((i) => u[i]!)) - uAvant }
}

export const indicielleOrdre1 = (t: number, tau: number) => (t <= 0 ? 0 : 1 - Math.exp(-t / tau))
export const indicielleOrdre2 = (t: number, z: number, wn: number) => indicielleNormalisee(wn * t, z)

/** Modèle d'un résultat, évalué à l'instant t (variation ajoutée à m0) */
export function modele(f: Pick<Fenetre, 'm0' | 'du'>, r: ResultatFit, t: number): number {
  const s = r.ordre === 1 ? indicielleOrdre1(t, r.tau!) : indicielleOrdre2(t, r.z!, r.wn!)
  return f.m0 + r.g0 * f.du * s
}

/** Nelder–Mead (coefficients standard : réflexion 1, expansion 2, contraction et réduction 1/2) */
export function nelderMead(f: (x: number[]) => number, x0: number[], pas: number): { x: number[]; fx: number; iterations: number } {
  const n = x0.length
  let simplexe = [x0, ...x0.map((_, i) => x0.map((v, j) => (i === j ? v + pas : v)))].map((x) => ({ x, fx: f(x) }))
  let iterations = 0
  const combiner = (a: number[], b: number[], k: number) => a.map((v, i) => v + k * (b[i]! - v))
  for (; iterations < au3('IDENT_ITER_MAX'); iterations++) {
    simplexe.sort((a, b) => a.fx - b.fx)
    const meilleur = simplexe[0]!
    const pire = simplexe[n]!
    if (pire.fx - meilleur.fx <= au3('IDENT_TOL') * (Math.abs(meilleur.fx) + au3('IDENT_TOL'))) break
    const centre = simplexe.slice(0, n).reduce((c, s) => c.map((v, i) => v + s.x[i]! / n), new Array<number>(n).fill(0))
    const reflechi = combiner(centre, pire.x, -1)
    const fr = f(reflechi)
    if (fr < meilleur.fx) {
      const etendu = combiner(centre, pire.x, -2)
      const fe = f(etendu)
      simplexe[n] = fe < fr ? { x: etendu, fx: fe } : { x: reflechi, fx: fr }
      continue
    }
    if (fr < simplexe[n - 1]!.fx) {
      simplexe[n] = { x: reflechi, fx: fr }
      continue
    }
    const contracte = fr < pire.fx ? combiner(centre, reflechi, 1 / 2) : combiner(centre, pire.x, 1 / 2)
    const fc = f(contracte)
    if (fc < Math.min(fr, pire.fx)) {
      simplexe[n] = { x: contracte, fx: fc }
      continue
    }
    simplexe = simplexe.map((s, i) => (i === 0 ? s : { x: combiner(meilleur.x, s.x, 1 / 2), fx: NaN })).map((s) => (Number.isNaN(s.fx) ? { x: s.x, fx: f(s.x) } : s))
  }
  simplexe.sort((a, b) => a.fx - b.fx)
  return { x: simplexe[0]!.x, fx: simplexe[0]!.fx, iterations }
}

/** Ajuste un modèle d'ordre 1 (G0, τ) ou 2 (G0, z, ωn) sur l'échelon ; paramètres cherchés en logarithme (positifs) */
export function identifier(f: Fenetre, ordre: 1 | 2): ResultatFit {
  const n = f.t.length
  const fin = moyenne(f.m.slice(n - Math.max(1, Math.floor(n / au3('OSC_DIV_X')))))
  const g00 = (fin - f.m0) / f.du
  const i63 = f.m.findIndex((v) => v - f.m0 >= au3('NIVEAU_TAU') * (fin - f.m0))
  const tau0 = f.t[Math.max(1, i63)]!
  const critere = (r: ResultatFit) => {
    let s = 0
    for (let i = 0; i < n; i++) {
      const e = modele(f, r, f.t[i]!) - f.m[i]!
      s += e * e
    }
    return s
  }
  const vers = (x: number[]): ResultatFit => (ordre === 1 ? { ordre, g0: Math.exp(x[0]!), tau: Math.exp(x[1]!), critere: 0, iterations: 0 } : { ordre, g0: Math.exp(x[0]!), z: Math.exp(x[1]!), wn: Math.exp(x[2]!), critere: 0, iterations: 0 })
  let x = ordre === 1 ? [Math.log(g00), Math.log(tau0)] : [Math.log(g00), 0, Math.log(2 / tau0)]
  let iterations = 0
  let fx = Infinity
  for (let p = 0; p < au3('IDENT_PASSES'); p++) {
    const r = nelderMead((y) => critere(vers(y)), x, au3('IDENT_PAS_INITIAL'))
    x = r.x
    fx = r.fx
    iterations += r.iterations
  }
  return { ...vers(x), critere: fx, iterations }
}

/** Pente à l'origine d'un modèle (V/s) : G0·ΔU/τ pour l'ordre 1, nulle pour l'ordre 2 */
export const penteOrigine = (f: Pick<Fenetre, 'du'>, r: ResultatFit) => (r.ordre === 1 ? (r.g0 * f.du) / r.tau! : 0)

/** Pente de la mesure au démarrage : régression sur les premiers points (t ≤ TANGENTE_FENETRE·τ) */
export function penteMesure(f: Fenetre, tau: number): number {
  const idx = f.t.flatMap((t, i) => (t <= tau * au3('TANGENTE_FENETRE') ? [i] : []))
  if (idx.length < 2) return NaN
  const tm = moyenne(idx.map((i) => f.t[i]!))
  const mm = moyenne(idx.map((i) => f.m[i]!))
  const num = idx.reduce((s, i) => s + (f.t[i]! - tm) * (f.m[i]! - mm), 0)
  const den = idx.reduce((s, i) => s + (f.t[i]! - tm) ** 2, 0)
  return den ? num / den : NaN
}
