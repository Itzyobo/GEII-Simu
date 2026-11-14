import { au3 } from '../../data/reference'
import { dureeTampon, MESURE_IMAGE, pasFenetre, type Signaux } from '../instruments/oscillo'
import { MS_PAR_SECONDE } from '../unites'
import { BANC_POSITION, etatInitial, preparer, type BancPosition, type EntreesPosition, type EtatPosition, type ModelePosition } from '../sim/position'

/**
 * Mode temps réel du TP3 : le banc de position tourne en continu. À chaque image, l'état (conservé entre les images)
 * avance de la durée écoulée (au plus TP3_DT_IMAGE_MAX) avec les entrées courantes (offset tourné à la main, K,
 * câblage, interrupteur). Les échantillons des 4 voies remplissent un tampon glissant lu par l'oscilloscope.
 */
export type Abonne = (s: Signaux, tFin: number, etat: EtatPosition) => void

export interface TempsReel {
  /** Nouvelles entrées : le modèle est reconstruit, l'état continue */
  entrees: (e: EntreesPosition) => void
  /** Base de temps de l'oscilloscope : pas d'échantillonnage et durée du tampon (le tampon repart vide) */
  configurer: (sdiv: number) => void
  /** S'abonner aux images ; la boucle tourne tant qu'il y a des abonnés */
  abonner: (f: Abonne) => () => void
  /** Avance de dt (s), sans horloge (tests, et chaque image) */
  avancer: (dt: number) => void
  etat: () => EtatPosition
}

export function creerTempsReel(entrees: EntreesPosition, b: BancPosition = BANC_POSITION, horloge = typeof requestAnimationFrame === 'undefined' ? null : { demander: (f: FrameRequestCallback) => requestAnimationFrame(f), annuler: (i: number) => cancelAnimationFrame(i) }): TempsReel {
  let etat = etatInitial(b)
  let modele: ModelePosition = preparer(b, entrees)
  let decim = 1
  let garde = 0
  const tampon: number[][] = [[], [], [], [], []]
  const abonnes = new Set<Abonne>()
  let id = 0
  let precedent: number | null = null

  const pousser = (t: number, v: readonly number[]) => {
    tampon[0]!.push(t)
    for (let j = 0; j < v.length; j++) tampon[j + 1]!.push(v[j]!)
  }
  const avancer = (dt: number) => {
    etat = modele.avancer(etat, Math.min(dt, au3('TP3_DT_IMAGE_MAX')), pousser, decim)
    const trop = tampon[0]!.length - garde
    if (trop > garde) for (const x of tampon) x.splice(0, trop)
  }
  const signaux = (): Signaux => ({ t: Float64Array.from(tampon[0]!), voies: tampon.slice(1).map((x) => Float64Array.from(x)) })
  const image = (maintenant: number) => {
    const debut = performance.now()
    avancer(precedent === null ? 0 : (maintenant - precedent) / MS_PAR_SECONDE)
    precedent = maintenant
    if (tampon[0]!.length > 1) {
      const s = signaux()
      const tFin = s.t[s.t.length - 1]!
      for (const f of abonnes) f(s, tFin, etat)
    }
    performance.measure(MESURE_IMAGE, { start: debut })
    id = horloge ? horloge.demander(image) : 0
  }
  const configurer = (sdiv: number) => {
    decim = Math.max(1, Math.round(pasFenetre(sdiv, b.pas) / b.pas))
    garde = Math.ceil(dureeTampon(sdiv) / (decim * b.pas))
    for (const x of tampon) x.length = 0
  }
  configurer(au3('TP3_SDIV'))
  return {
    entrees: (e) => void (modele = preparer(b, e)),
    configurer,
    abonner: (f) => {
      abonnes.add(f)
      if (abonnes.size === 1 && horloge) id = horloge.demander(image)
      return () => {
        abonnes.delete(f)
        if (!abonnes.size && horloge) {
          horloge.annuler(id)
          precedent = null
        }
      }
    },
    avancer,
    etat: () => etat,
  }
}
