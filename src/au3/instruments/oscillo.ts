import { au3 } from '../../data/reference'
import { MISE_EN_PAGE } from '../miseEnPage'

/**
 * Oscilloscope Keysight DSOX2004A, en fonctions pures : plan d'acquisition, déclenchement, couplage AC,
 * quantification 8 bits sur la plage affichée (trace écrêtée hors écran), moyennage, curseurs, mesures, .csv.
 */
const DIV_X = au3('OSC_DIV_X')
const DIV_Y = au3('OSC_DIV_Y')
const REF_GAUCHE = au3('OSC_REF_GAUCHE_DIV')
const POINTS = au3('OSC_POINTS')
const PX = MISE_EN_PAGE.oscillo.pxParDiv
export const LARGEUR_PX = DIV_X * PX
export const HAUTEUR_PX = DIV_Y * PX
export const NB_VOIES = MISE_EN_PAGE.oscillo.couleurs.length

export type Couplage = 'DC' | 'AC'
export interface Voie {
  active: boolean
  /** Calibre vertical (V/div) */
  vdiv: number
  /** Position du 0 V par rapport au centre de l'écran (divisions, vers le haut) */
  position: number
  couplage: Couplage
}
export interface Declenchement {
  /** Indice de la voie source (0 = voie 1) */
  source: number
  front: 'montant' | 'descendant'
  niveau: number
  mode: 'normal' | 'auto'
}
export interface ReglagesOscillo {
  voies: Voie[]
  /** Base de temps (s/div) */
  sdiv: number
  declenchement: Declenchement
  moyennage: number
  run: boolean
}

export interface Enregistrement {
  /** Instant du premier point, relatif au déclenchement (s) */
  t0: number
  dt: number
  /** Tensions acquises (quantifiées) par voie ; null = voie éteinte */
  voies: (Float64Array | null)[]
  /** Calibres au moment de l'acquisition (la quantification en dépend) */
  calibres: { vdiv: number; position: number }[]
  sdiv: number
  declenche: boolean
}

/** Signaux bruts d'une simulation, échantillonnés régulièrement */
export interface Signaux {
  t: Float64Array
  voies: Float64Array[]
}

export interface PlanAcquisition {
  duree: number
  pasSortie: number
  /** Le déclenchement est cherché à partir de cet instant (régime périodique établi) */
  debutRecherche: number
  periode: number
}

/** Durée à simuler et pas d'échantillonnage pour une acquisition à la base de temps courante */
export function planAcquisition(osc: ReglagesOscillo, periodeGbf: number | null, pasEuler: number): PlanAcquisition {
  const fenetre = DIV_X * osc.sdiv
  const periode = periodeGbf ?? fenetre
  const avant = REF_GAUCHE * osc.sdiv
  const debutRecherche = Math.max(au3('PERIODES_CHAUFFE') * periode - periode / 2, avant)
  const pasSortie = Math.max(pasEuler, Math.floor(fenetre / POINTS / pasEuler) * pasEuler)
  return { duree: debutRecherche + periode + fenetre, pasSortie, debutRecherche, periode }
}

/** Passe-haut du 1er ordre (couplage AC) */
export function passeHaut(x: Float64Array, dt: number, fc = au3('COUPURE_AC_OSCILLO')): Float64Array {
  const rc = 1 / (2 * Math.PI * fc)
  const a = rc / (rc + dt)
  const y = new Float64Array(x.length)
  for (let i = 1; i < x.length; i++) y[i] = a * (y[i - 1]! + x[i]! - x[i - 1]!)
  return y
}

/** Pas de quantification : plage affichée (divY divisions) sur 2^bits niveaux */
export const pasQuantif = (vdiv: number) => (DIV_Y * vdiv) / 2 ** au3('QUANTIF_OSCILLO_BITS')

/** Plage visible d'une voie (V) */
export const plageVoie = (vdiv: number, position: number) => ({ min: (-DIV_Y / 2 - position) * vdiv, max: (DIV_Y / 2 - position) * vdiv })

/** Quantification 8 bits sur la plage affichée ; hors écran la trace est écrêtée au bord */
export function quantifier(v: number, vdiv: number, position: number): number {
  const { min, max } = plageVoie(vdiv, position)
  const q = pasQuantif(vdiv)
  return Math.min(max, Math.max(min, min + Math.round((v - min) / q) * q))
}

const interp = (s: Signaux, x: Float64Array, t: number) => {
  const dt = s.t[1]! - s.t[0]!
  const f = (t - s.t[0]!) / dt
  const i = Math.max(0, Math.min(x.length - 2, Math.floor(f)))
  const r = f - i
  return x[i]! * (1 - r) + x[i + 1]! * r
}

/** Premier franchissement du niveau de déclenchement après `debut` (interpolé), ou null */
export function chercherDeclenchement(s: Signaux, d: Declenchement, debut: number): number | null {
  const x = s.voies[d.source]
  if (!x) return null
  const sens = d.front === 'montant' ? 1 : -1
  for (let i = 1; i < x.length; i++) {
    if (s.t[i]! < debut) continue
    const a = sens * (x[i - 1]! - d.niveau)
    const b = sens * (x[i]! - d.niveau)
    if (a < 0 && b >= 0) return s.t[i - 1]! + ((s.t[i]! - s.t[i - 1]!) * a) / (a - b)
  }
  return null
}

/**
 * Une acquisition : déclenchement, fenêtre de 10 divisions (déclenchement à 1 division du bord gauche),
 * couplage, quantification. Mode Normal sans déclenchement → null (l'écran garde la trace précédente).
 * Mode Auto sans déclenchement → trace non synchronisée (position tirée par `decalage` ∈ [0, 1[) : elle défile.
 */
export function acquerir(osc: ReglagesOscillo, s: Signaux, plan: PlanAcquisition, decalage: number): Enregistrement | null {
  const trouve = chercherDeclenchement(s, osc.declenchement, plan.debutRecherche)
  if (trouve === null && osc.declenchement.mode === 'normal') return null
  const tTrig = trouve ?? plan.debutRecherche + decalage * plan.periode
  const avant = REF_GAUCHE * osc.sdiv
  const dt = (DIV_X * osc.sdiv) / POINTS
  const dtSim = s.t[1]! - s.t[0]!
  const voies = osc.voies.map((v, j) => {
    const brut = s.voies[j]
    if (!v.active || !brut) return null
    const x = v.couplage === 'AC' ? passeHaut(brut, dtSim) : brut
    const r = new Float64Array(POINTS)
    for (let k = 0; k < POINTS; k++) r[k] = quantifier(interp(s, x, tTrig - avant + k * dt), v.vdiv, v.position)
    return r
  })
  return { t0: -avant, dt, voies, calibres: osc.voies.map((v) => ({ vdiv: v.vdiv, position: v.position })), sdiv: osc.sdiv, declenche: trouve !== null }
}

/** Moyennage point à point de plusieurs acquisitions (mêmes réglages) */
export function moyenner(recs: Enregistrement[]): Enregistrement | null {
  const [premier] = recs
  if (!premier) return null
  const voies = premier.voies.map((v, j) => {
    if (!v) return null
    const somme = new Float64Array(v.length)
    for (const r of recs) r.voies[j]?.forEach((x, k) => (somme[k] = somme[k]! + x / recs.length))
    return somme
  })
  return { ...premier, voies }
}

/* ───────────── Écran : conversions pixel ↔ unité ───────────── */

const refPx = REF_GAUCHE * PX
export const pxVersTemps = (px: number, sdiv: number) => ((px - refPx) * sdiv) / PX
export const tempsVersPx = (t: number, sdiv: number) => refPx + (t * PX) / sdiv
export const pxVersTension = (py: number, vdiv: number, position: number) => ((HAUTEUR_PX / 2 - py) / PX - position) * vdiv
export const tensionVersPx = (v: number, vdiv: number, position: number) => HAUTEUR_PX / 2 - (v / vdiv + position) * PX

/** Valeur d'une voie enregistrée à l'instant t (relatif au déclenchement), ou null hors enregistrement */
export function valeurA(rec: Enregistrement, voie: number, t: number): number | null {
  const x = rec.voies[voie]
  if (!x) return null
  const f = (t - rec.t0) / rec.dt
  if (f < 0 || f > x.length - 1) return null
  const i = Math.min(x.length - 2, Math.floor(f))
  const r = f - i
  return x[i]! * (1 - r) + x[i + 1]! * r
}

/* ───────────── Curseurs X1, X2, Y1, Y2 ───────────── */

export interface Curseurs {
  /** Positions en pixels écran (entiers) */
  x1: number
  x2: number
  y1: number
  y2: number
  /** Voie source des curseurs Y */
  source: number
  /** Mode « suivre signal » : Y1 et Y2 lisent la trace aux instants X1 et X2 */
  suivre: boolean
}

export interface LectureCurseurs {
  x1: number
  x2: number
  dx: number
  invDx: number
  y1: number | null
  y2: number | null
  dy: number | null
}

export function lireCurseurs(c: Curseurs, osc: ReglagesOscillo, rec: Enregistrement | null): LectureCurseurs {
  const x1 = pxVersTemps(c.x1, osc.sdiv)
  const x2 = pxVersTemps(c.x2, osc.sdiv)
  const v = osc.voies[c.source]
  const manuel = (py: number) => (v ? pxVersTension(py, v.vdiv, v.position) : null)
  const y1 = c.suivre ? (rec ? valeurA(rec, c.source, x1) : null) : manuel(c.y1)
  const y2 = c.suivre ? (rec ? valeurA(rec, c.source, x2) : null) : manuel(c.y2)
  const dx = x2 - x1
  return { x1, x2, dx, invDx: dx === 0 ? Infinity : 1 / dx, y1, y2, dy: y1 === null || y2 === null ? null : y2 - y1 }
}

/* ───────────── Mesures automatiques ───────────── */

export interface MesuresAuto {
  max: number
  min: number
  crcr: number
  ampl: number
}

const mediane = (x: number[]) => {
  const s = [...x].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)] ?? NaN
}

/** Max, Min, Cr-cr et Ampl (haut − bas, médianes de part et d'autre du milieu) sur la trace affichée */
export function mesurer(rec: Enregistrement | null, voie: number): MesuresAuto | null {
  const x = rec?.voies[voie]
  if (!x) return null
  let max = -Infinity
  let min = Infinity
  for (const v of x) {
    max = Math.max(max, v)
    min = Math.min(min, v)
  }
  const milieu = (max + min) / 2
  const vals = [...x]
  const haut = mediane(vals.filter((v) => v >= milieu))
  const bas = mediane(vals.filter((v) => v < milieu))
  return { max, min, crcr: max - min, ampl: Number.isNaN(bas) ? 0 : haut - bas }
}

/* ───────────── Export .csv (format de l'oscilloscope) ───────────── */

/** -1.0000000E-02 : mantisse à csvChiffres décimales, exposant signé sur 2 chiffres au moins */
const nombreCsv = (v: number) => v.toExponential(MISE_EN_PAGE.oscillo.csvChiffres).replace(/e([+-])(\d+)$/, (_, s: string, d: string) => `E${s}${d.padStart(2, '0')}`)

/** Lignes « x-axis,1,2 » puis « second,Volt,Volt », puis une ligne par point */
export function exporterCsv(rec: Enregistrement): string {
  const actives = rec.voies.flatMap((v, j) => (v ? [j] : []))
  const lignes = [['x-axis', ...actives.map((j) => String(j + 1))].join(','), ['second', ...actives.map(() => 'Volt')].join(',')]
  const n = rec.voies[actives[0] ?? 0]?.length ?? 0
  for (let k = 0; k < n; k++) lignes.push([nombreCsv(rec.t0 + k * rec.dt), ...actives.map((j) => nombreCsv(rec.voies[j]![k]!))].join(','))
  return lignes.join('\n') + '\n'
}

export interface Csv {
  entetes: string[][]
  colonnes: number[][]
}

/** Relit un .csv d'oscilloscope : les 2 lignes d'en-tête, puis les colonnes numériques */
export function lireCsv(texte: string): Csv {
  const lignes = texte.trim().split(/\r?\n/).map((l) => l.split(','))
  const entetes = lignes.slice(0, 2)
  const largeur = entetes[0]?.length ?? 0
  const colonnes = Array.from({ length: largeur }, (_, j) => lignes.slice(2).map((l) => Number(l[j])))
  return { entetes, colonnes }
}

/** Nom de la mesure de performance d'une image (simulation + acquisition + moyennage), lue par le test navigateur */
export const MESURE_IMAGE = 'au3-image'

/** Indices du palier haut affiché : du déclenchement (t = 0) jusqu'au front descendant de la voie de déclenchement, ou la fin */
export function palierAffiche(rec: Enregistrement, voieDecl = 0): { iFront: number; iFin: number } | null {
  const c = rec.voies[voieDecl]
  if (!c) return null
  const iFront = Math.max(0, Math.round(-rec.t0 / rec.dt))
  let haut = -Infinity
  let bas = Infinity
  for (const v of c) {
    haut = Math.max(haut, v)
    bas = Math.min(bas, v)
  }
  const milieu = (haut + bas) / 2
  let iFin = c.length - 1
  for (let i = iFront + 1; i < c.length; i++)
    if (c[i]! < milieu) {
      iFin = i - 1
      break
    }
  return iFin > iFront + 1 ? { iFront, iFin } : null
}
