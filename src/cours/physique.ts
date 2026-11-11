/**
 * Modèles du cours ENER3 : génériques, sans constantes de TP. Unités SI sauf mention.
 * Les animations du cours n'appellent que ces fonctions (testées dans physique.test.ts).
 */

const TAU = 2 * Math.PI
export const MU0 = 4e-7 * Math.PI
const mod = (a: number, n: number) => ((a % n) + n) % n

/* ---------- 1. Circuits magnétiques ---------- */

export interface Circuit {
  /** spires */
  n: number
  /** courant — A */
  i: number
  /** longueur moyenne du fer — m */
  l: number
  /** section — m² */
  s: number
  /** perméabilité relative du fer */
  mur: number
  /** entrefer — m */
  e: number
  /** induction de saturation — T */
  bsat: number
}

/** Réluctance en régime linéaire : R = l/(µ0·µr·S) + e/(µ0·S) — H⁻¹ */
export const reluctance = ({ l, s, mur, e }: Circuit) => l / (MU0 * mur * s) + e / (MU0 * s)

/** Courbe d'aimantation du fer : B = Bsat·tanh(µ0·µr·H / Bsat) */
export const bOfH = (h: number, mur: number, bsat: number) => bsat * Math.tanh((MU0 * mur * h) / bsat)
const hOfB = (b: number, mur: number, bsat: number) => (bsat / (MU0 * mur)) * Math.atanh(b / bsat)

/** Induction dans le fer, saturation comprise : n·i = H_fer·l + B·e/µ0, résolu par dichotomie sur B. */
export function induction(c: Circuit): number {
  const ni = Math.abs(c.n * c.i)
  let lo = 0
  let hi = c.bsat * (1 - 1e-12)
  for (let k = 0; k < 80; k++) {
    const b = (lo + hi) / 2
    if (hOfB(b, c.mur, c.bsat) * c.l + (b * c.e) / MU0 > ni) hi = b
    else lo = b
  }
  return Math.sign(c.n * c.i) * lo
}

/* ---------- 2. Alimentation flyback ---------- */

export interface Flyback {
  /** tension d'entrée — V */
  e: number
  /** rapport cyclique */
  alpha: number
  /** rapport de transformation n2/n1 */
  m: number
  /** inductance du primaire — H */
  l1: number
  /** fréquence de découpage — Hz */
  f: number
  /** charge — Ω */
  r: number
}

export interface FlybackPoint {
  vs: number
  is: number
  /** démagnétisation partielle (conduction continue) */
  continu: boolean
  /** courant primaire au début / à la fin de la magnétisation — A */
  i1min: number
  i1max: number
  /** durée de la démagnétisation — s */
  t2: number
}

/**
 * Point de fonctionnement en boucle ouverte. Continu : Vs = m·α·E/(1−α).
 * Discontinu : toute l'énergie ½·L1·Î² passe à la charge à chaque période, Vs² / R = ½·L1·Î²·f.
 * Le mode réel est celui qui donne la plus grande tension (le discontinu n'existe que si t2 < (1−α)·T).
 */
export function flyback(p: Flyback): FlybackPoint {
  const T = 1 / p.f
  const vc = (p.m * p.alpha * p.e) / (1 - p.alpha)
  const vd = p.alpha * p.e * Math.sqrt((p.r * T) / (2 * p.l1))
  const continu = vc >= vd
  const vs = Math.max(vc, vd)
  const is = vs / p.r
  const di = (p.e * p.alpha * T) / p.l1
  const i1min = continu ? (p.m * is) / (1 - p.alpha) - di / 2 : 0
  return { vs, is, continu, i1min, i1max: i1min + di, t2: continu ? (1 - p.alpha) * T : (p.m * p.e * p.alpha * T) / vs }
}

/** Grandeurs à l'instant t (ramené dans la période). Conventions du cours : v2 = −m·v1, vK = E − v1. */
export function flybackAt(p: Flyback, pt: FlybackPoint, t: number) {
  const T = 1 / p.f
  const tt = mod(t, T)
  const ton = p.alpha * T
  let i1 = 0
  let i2 = 0
  let v1 = 0
  if (tt < ton) {
    i1 = pt.i1min + (p.e * tt) / p.l1
    v1 = p.e
  } else if (tt - ton < pt.t2) {
    i2 = (pt.i1max - (pt.vs * (tt - ton)) / (p.m * p.l1)) / p.m
    v1 = -pt.vs / p.m
  }
  return { i1, i2, v1, v2: -p.m * v1, vk: p.e - v1, k: tt < ton }
}

/* ---------- 3. Moteur pas à pas ---------- */

export type ModePas = 'une-phase' | 'deux-phases' | 'demi-pas'

const DEMI = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
] as const

/** Signe des courants des phases A et B au pas k. */
export function phasesPas(mode: ModePas, k: number): readonly [number, number] {
  return DEMI[mod(mode === 'demi-pas' ? k : 2 * k + (mode === 'deux-phases' ? 1 : 0), 8)]
}

/** Nombre de pas par tour en pas entier : Np = ns·nr / |nr − ns| (réluctance variable, hybride). */
export const pasParTour = (ns: number, nr: number) => (ns * nr) / Math.abs(nr - ns)

/** Pôles du stator dessiné : A en haut, B à droite, A′ et B′ en face — angle en degrés, polarité (+1 = N). */
export const polesStator = (ia: number, ib: number) =>
  [
    [90, ia],
    [270, -ia],
    [0, ib],
    [180, -ib],
  ] as const

/** Dent j du rotor (nr dents alternées S, N, S…) : angle en degrés pour une position θ du rotor. */
export const dentRotor = (nr: number, j: number, theta: number) => theta + 90 + (j * 360) / nr

/**
 * Énergie d'interaction stator / rotor (unités arbitraires) : chaque pôle attire les dents de polarité
 * opposée proches de lui et repousse les autres. Le rotor s'arrête dans un minimum.
 */
export function energiePas(nr: number, ia: number, ib: number, theta: number): number {
  const w = (0.8 * 180) / nr
  let e = 0
  for (const [a, pol] of polesStator(ia, ib)) {
    if (!pol) continue
    for (let j = 0; j < nr; j++) {
      const d = mod(dentRotor(nr, j, theta) - a + 180, 360) - 180
      e += pol * (j % 2 ? 1 : -1) * Math.exp(-((d / w) ** 2))
    }
  }
  return e
}

/** Couple de rappel −dE/dθ (unités arbitraires, θ en degrés). */
export const couplePas = (nr: number, ia: number, ib: number, theta: number) =>
  -(energiePas(nr, ia, ib, theta + 0.01) - energiePas(nr, ia, ib, theta - 0.01)) / 0.02

/** Position d'équilibre la plus proche de theta0 (descente de gradient). */
export function equilibrePas(nr: number, ia: number, ib: number, theta0: number): number {
  let th = theta0
  for (let k = 0; k < 4000; k++) th += 2 * Math.max(-0.5, Math.min(0.5, couplePas(nr, ia, ib, th)))
  return th
}

export interface Hacheur {
  /** tension du pont — V */
  u: number
  /** inductance de la phase — H */
  l: number
  /** seuils haut / bas de la régulation — A */
  ih: number
  il: number
  /** durée d'un pas — s */
  tp: number
}

/**
 * Courant d'une phase pilotée en courant par un pont en H, sur 4 pas (A+, repos, A−, repos), pas de calcul dt.
 * inst : 0 repos, 1 magnétisation, 2 relance, 3 roue libre, 4 démagnétisation, 5 à 7 idem en sens négatif.
 */
export function hacheurPhase(p: Hacheur, dt: number) {
  const n = Math.round((4 * p.tp) / dt)
  const va = new Float32Array(n)
  const ia = new Float32Array(n)
  const inst = new Uint8Array(n)
  const pente = p.u / p.l
  const rl = 0.55 * pente // roue libre : décroissance lente due aux pertes
  let i = 0
  let libre = false
  let premier = true
  let prev = -1
  for (let k = 0; k < n; k++) {
    const pas = Math.min(3, Math.floor((k * dt) / p.tp))
    const cmd = [1, 0, -1, 0][pas]
    if (pas !== prev) {
      libre = false
      premier = true
      prev = pas
    }
    let v = 0
    let s = 0
    if (cmd === 1) {
      if (libre) {
        s = 3
        i -= rl * dt
        if (i <= p.il) libre = false
      } else {
        v = p.u
        s = premier ? 1 : 2
        i += pente * dt
        if (i >= p.ih) {
          i = p.ih
          libre = true
          premier = false
        }
      }
    } else if (cmd === -1) {
      if (libre) {
        s = 6
        i += rl * dt
        if (i >= -p.il) libre = false
      } else {
        v = -p.u
        s = 5
        i -= pente * dt
        if (i <= -p.ih) {
          i = -p.ih
          libre = true
          premier = false
        }
      }
    } else if (i > 1e-9) {
      v = -p.u
      s = 4
      i = Math.max(0, i - pente * dt)
    } else if (i < -1e-9) {
      v = p.u
      s = 7
      i = Math.min(0, i + pente * dt)
    } else i = 0
    va[k] = v
    ia[k] = i
    inst[k] = s
  }
  return { va, ia, inst, n }
}

/**
 * Courant moyen pendant un pas de durée 1/fh, rapporté à la consigne : la phase R-L s'établit sous E
 * (i = E/R·(1 − e^(−t/τ))) puis est régulée à Iref. Le couple disponible lui est proportionnel.
 */
export function remplissageCourant(fh: number, e: number, r: number, l: number, iref: number): number {
  const tp = 1 / fh
  const tau = l / r
  const ifin = e / r
  const aire = (t: number) => ifin * (t - tau * (1 - Math.exp(-t / tau)))
  const tr = iref >= ifin ? Infinity : -tau * Math.log(1 - iref / ifin)
  const moy = tp <= tr ? aire(tp) / tp : (aire(tr) + iref * (tp - tr)) / tp
  return moy / iref
}

/* ---------- 4 à 7. Machines tournantes, onduleur ---------- */

/** Vitesse de synchronisme Ns = 60·f/p — tr/min */
export const nSync = (f: number, p: number) => (60 * f) / p

export interface Mas {
  f: number
  p: number
  /** couple maximal — N·m */
  cmax: number
  /** glissement au couple maximal */
  gm: number
}

/** Couple électromagnétique (formule de Kloss) : C = 2·Cmax / (g/gm + gm/g). Négatif en génératrice. */
export function coupleMas(m: Mas, n: number): number {
  const g = 1 - n / nSync(m.f, m.p)
  return g === 0 ? 0 : (2 * m.cmax) / (g / m.gm + m.gm / g)
}

/** Alimentation à V/f constant : Cmax garde sa valeur et la courbe glisse avec Ns (gm·Ns constant). */
export const masVf = (base: Mas, f: number): Mas => ({ ...base, f, gm: (base.gm * base.f) / f })

/**
 * Point de fonctionnement stable : intersection de C(N) et de Cr(N) entre le couple maximal et Ns.
 * null si la charge dépasse le couple maximal (le moteur décroche).
 */
export function pointMas(m: Mas, cr: (n: number) => number): { n: number; c: number; g: number } | null {
  const ns = nSync(m.f, m.p)
  let lo = ns * (1 - m.gm)
  let hi = ns
  if (coupleMas(m, lo) < cr(lo)) return null
  for (let k = 0; k < 60; k++) {
    const n = (lo + hi) / 2
    if (coupleMas(m, n) > cr(n)) lo = n
    else hi = n
  }
  return { n: lo, c: cr(lo), g: 1 - lo / ns }
}

/** Bilan de puissance de la machine asynchrone (pertes fixes données en W). */
export function bilanMas({ c, n, ns, pjs, pfs, pm }: { c: number; n: number; ns: number; pjs: number; pfs: number; pm: number }) {
  const ptr = (c * ns * TAU) / 60
  const g = 1 - n / ns
  const pjr = g * ptr
  const pmeca = ptr - pjr
  const pu = pmeca - pm
  const pa = ptr + pjs + pfs
  return { pa, pjs, pfs, ptr, pjr, pmeca, pm, pu, eta: pu / pa }
}

/** Porteuse triangulaire de fréquence fp, entre −1 et +1. */
export const porteuse = (t: number, fp: number) => {
  const x = mod(t * fp, 1)
  return x < 0.5 ? 4 * x - 1 : 3 - 4 * x
}

/** Bras d'onduleur MLI bipolaire : +E quand la sinusoïde de référence (indice ma) dépasse la porteuse. */
export const mli = (t: number, e: number, f: number, fp: number, ma: number) => (ma * Math.sin(TAU * f * t) >= porteuse(t, fp) ? e : -e)

/** Commande pleine onde : créneau ±E à la fréquence f. */
export const pleineOnde = (t: number, e: number, f: number) => (mod(t * f, 1) < 0.5 ? e : -e)

/** Amplitudes crête des harmoniques 1 à nmax d'un signal de fréquence f (intégration sur une période). */
export function harmoniques(sig: (t: number) => number, f: number, nmax: number, pts = 8192): number[] {
  const T = 1 / f
  const out: number[] = []
  for (let h = 1; h <= nmax; h++) {
    let a = 0
    let b = 0
    for (let k = 0; k < pts; k++) {
      const t = ((k + 0.5) * T) / pts
      const v = sig(t)
      a += v * Math.cos(TAU * h * f * t)
      b += v * Math.sin(TAU * h * f * t)
    }
    out.push((2 / pts) * Math.hypot(a, b))
  }
  return out
}
