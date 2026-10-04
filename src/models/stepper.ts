/**
 * Moteur pas à pas piloté par TB6600 — modèle pur, sans React.
 * Par phase : L·di/dt = V − R·i − e, pont en H à ±15 V, régulation par hystérésis, Euler à 1 µs.
 */
import { PAP, TB6600_MODES, type ModePas } from '../data/reference'

export type Switches = readonly [boolean, boolean, boolean]
export type Dir = 1 | -1

/** Mode selon S1-S2-S3 ; null = combinaison invalide, moteur inactif. */
export function modeFromSwitches(s: Switches): ModePas | null {
  return TB6600_MODES.find((m) => m.s.every((v, i) => v === s[i]))?.mode ?? null
}

export const INVALID_SWITCHES_MSG = 'Combinaison S1-S2-S3 non reconnue : le driver ne pilote pas le moteur.'

/** Nombre de périodes d'horloge par période électrique de courant (4 / 8 / 16). */
export const statesPerPeriod = (mode: ModePas) => PAP.periodesHorlogeParPeriodeCourant[mode]

/**
 * Consigne de courant (A) de la phase à l'état k (front d'horloge n° k dans la période).
 * I_B = I_A décalé de dir·T/4 : I_B en avance de T/4 si dir = +1, en retard si dir = −1.
 */
export function setpoint(mode: ModePas, k: number, phase: 'A' | 'B', dir: Dir): number {
  const states = statesPerPeriod(mode)
  const theta = (2 * Math.PI * k) / states + (phase === 'B' ? (dir * Math.PI) / 2 : 0)
  const I = PAP.iConsigne
  if (mode === 'entier') return I * Math.sign(Math.cos(theta - Math.PI / 4)) // 4 états, ±1 A sur les deux phases
  const c = Math.round(Math.cos(theta) * 1e9) / 1e9
  if (mode === 'demi') return Math.abs(c) < 0.5 ? 0 : I * Math.sign(c) // 8 états : +1 / 0 / −1
  return I * c // 16 états : cos échantillonné, |I| ∈ {0 ; 0,38 ; 0,71 ; 0,92 ; 1}
}

/** Vitesse en tr/min : N = 60·f / Np, nulle au-delà du décrochage. */
export function speedRpm(f: number, mode: ModePas): number {
  return f > PAP.fDecrochage ? 0 : (60 * f) / PAP.pasParTour[mode]
}

export interface StepperParams {
  /** Fréquence d'horloge PUL — Hz */
  f: number
  mode: ModePas
  dir: Dir
}

export interface StepperSim extends StepperParams {
  /** Période électrique du courant — s */
  period: number
  rpm: number
  /** Pas d'échantillonnage du buffer — s */
  dt: number
  /** Durée du buffer (nombre entier de périodes) — s */
  duration: number
  iA: Float32Array
  iB: Float32Array
  /** Tension appliquée à la phase A — V */
  vA: Float32Array
}

const DT = 1e-6
const MAX_SAMPLES = 400_000
/** Au-delà de 200 ms par période de courant, le buffer ne garde qu'une période — s */
const LONG_PERIOD = 0.2

/** Paramètres électriques calés (surchargés uniquement par le calage). */
export interface Motor {
  /** H */
  l: number
  /** V·s/rad */
  ke: number
}
const MOTOR: Motor = { l: PAP.lReelle, ke: PAP.ke }

/**
 * Simule jusqu'au régime établi puis garde ≥ 4 périodes de courant (≥ 10 ms) dans le buffer,
 * ou une seule période si elle dépasse LONG_PERIOD (recalcul < 50 ms dans tous les modes).
 */
export function simulate({ f, mode, dir }: StepperParams, motor: Motor = MOTOR): StepperSim {
  const { l: L, ke } = motor
  const states = statesPerPeriod(mode)
  const period = states / f
  const rpm = speedRpm(f, mode)
  const omega = (2 * Math.PI * rpm) / 60
  const R = PAP.rPhase
  const E = PAP.vAlim
  const h = PAP.hysteresis
  const tableA = Array.from({ length: states }, (_, k) => setpoint(mode, k, 'A', dir))
  const tableB = Array.from({ length: states }, (_, k) => setpoint(mode, k, 'B', dir))

  const warmSteps = Math.round(0.05 / DT) // 50 ms ≈ 7·L/R simulés avant le buffer (t < 0)
  const keepPeriods = period > LONG_PERIOD ? 1 : Math.max(4, Math.ceil(0.01 / period))
  const keepSteps = Math.round((keepPeriods * period) / DT)
  const stride = Math.max(1, Math.ceil(keepSteps / MAX_SAMPLES))
  const n = Math.floor(keepSteps / stride)
  const iA = new Float32Array(n)
  const iB = new Float32Array(n)
  const vA = new Float32Array(n)

  // État de chaque phase : courant, transistors, tension appliquée.
  const i = new Float64Array(2)
  const on = new Uint8Array(2) // 1 = transistors passants, 0 = roue libre par les diodes
  const v = new Float64Array(2)
  const stepPhase = (p: number, c: number) => {
    const x = i[p]
    let V: number
    if (c !== 0) {
      const s = Math.sign(c)
      // Hystérésis entre |c| − 0,1 A et |c| (symétrique pour les courants négatifs)
      if (s * x < Math.abs(c) - h) on[p] = 1
      else if (s * x >= Math.abs(c)) on[p] = 0
      V = on[p] ? s * E : -Math.sign(x) * E // roue libre D2/D4 : −15 V vu du courant
    } else {
      on[p] = 0
      V = -Math.sign(x) * E // consigne nulle : roue libre jusqu'à 0
    }
    const e = c === 0 ? 0 : ke * omega * Math.sign(c)
    let next = x + ((V - R * x - e) / L) * DT
    if (!on[p] && x !== 0 && Math.sign(next) !== Math.sign(x)) next = 0 // les diodes bloquent à i = 0
    if (next === 0 && !on[p]) V = 0
    i[p] = next
    v[p] = V
  }

  // Le buffer commence à t = 0, sur un front d'horloge de début de période : phase cohérente avec clockAt().
  const stepsPerClock = 1 / (f * DT)
  let edge = Math.floor(-warmSteps / stepsPerClock) // n° du dernier front d'horloge
  let nextEdge = Math.round((edge + 1) * stepsPerClock)
  let k = ((edge % states) + states) % states
  for (let s = -warmSteps; s < n * stride; s++) {
    if (s >= nextEdge) {
      edge++
      nextEdge = Math.round((edge + 1) * stepsPerClock)
      k = ((edge % states) + states) % states
    }
    stepPhase(0, tableA[k])
    stepPhase(1, tableB[k])
    if (s >= 0 && s % stride === 0) {
      iA[s / stride] = i[0]
      iB[s / stride] = i[1]
      vA[s / stride] = v[0]
    }
  }
  return { f, mode, dir, period, rpm, dt: DT * stride, duration: n * DT * stride, iA, iB, vA }
}

/** Lecture en boucle du buffer : valeur à l'instant t (s), phase cohérente avec l'horloge. */
export function sampleAt(sim: StepperSim, arr: Float32Array, t: number): number {
  const u = ((t % sim.duration) + sim.duration) % sim.duration
  return arr[Math.min(arr.length - 1, Math.floor(u / sim.dt))]
}

/** Horloge PUL du GBF : créneau 0/5 V à f, rapport cyclique 50 %. */
export function clockAt(f: number, t: number): number {
  const x = t * f
  return x - Math.floor(x) < 0.5 ? 5 : 0
}

/** Mode tension : le courant n'atteint plus consigne − hystérésis (0,9 A) dans le buffer établi. */
export function isVoltageMode(sim: StepperSim): boolean {
  let peak = 0
  for (const x of sim.iA) peak = Math.max(peak, Math.abs(x))
  return peak < PAP.iConsigne - PAP.hysteresis
}

/** Freq2 en pas entier, par dichotomie sur f (Hz). */
export function findFreq2(motor: Motor = MOTOR, lo = 200, hi = 2400): number {
  for (let k = 0; k < 14; k++) {
    const mid = (lo + hi) / 2
    if (isVoltageMode(simulate({ f: mid, mode: 'entier', dir: 1 }, motor))) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}

/**
 * Instants (s, dans le buffer) des passages montants de `arr` par `level`.
 */
export function risingCrossings(sim: StepperSim, arr: Float32Array, level: number): number[] {
  const out: number[] = []
  for (let j = 1; j < arr.length; j++)
    if (arr[j - 1] < level && arr[j] >= level) out.push((j - 1 + (level - arr[j - 1]) / (arr[j] - arr[j - 1])) * sim.dt)
  return out
}

/**
 * L « mesurée aux curseurs » comme au labo : L = E·Δt/Δi sur la montée de I_A de −1 A à +1 A
 * (repères à ∓0,95 A pour rester hors de la bande de hachage). Pas entier uniquement.
 * Néglige R·i et la f.c.é.m. : c'est une inductance apparente.
 */
export function measureInductance(sim: StepperSim): { l: number; dt: number; di: number } {
  const a = -0.95
  const b = 0.95
  const starts = risingCrossings(sim, sim.iA, a)
  for (const t1 of risingCrossings(sim, sim.iA, b)) {
    const t0 = starts.filter((t) => t < t1).pop()
    if (t0 !== undefined && t1 - t0 < sim.period / 2) return { l: (PAP.vAlim * (t1 - t0)) / (b - a), dt: t1 - t0, di: b - a }
  }
  return { l: NaN, dt: NaN, di: NaN }
}

/** L apparente mesurée à 1 kHz en pas entier (Q12 et critère PRD). */
export const apparentInductance = (motor: Motor = MOTOR) => measureInductance(simulate({ f: 1000, mode: 'entier', dir: 1 }, motor)).l

/**
 * Calage conjoint (L réelle, Ke) : pour chaque L, Ke tel que Freq2 = f2Cible (dichotomie),
 * puis L telle que l'inductance apparente à 1 kHz = lCible (dichotomie).
 */
export function calibrate(f2Cible: number, lCible = PAP.lApparenteMesuree, lRange: [number, number] = [5e-3, 10e-3], keRange: [number, number] = [0, 0.15]) {
  const keFor = (l: number) => {
    let [lo, hi] = keRange // Ke ↑ ⇒ Freq2 ↓
    for (let k = 0; k < 16; k++) {
      const mid = (lo + hi) / 2
      if (findFreq2({ l, ke: mid }) > f2Cible) lo = mid
      else hi = mid
    }
    return (lo + hi) / 2
  }
  let [lo, hi] = lRange // L ↑ ⇒ L apparente ↑
  for (let k = 0; k < 16; k++) {
    const mid = (lo + hi) / 2
    if (apparentInductance({ l: mid, ke: keFor(mid) }) < lCible) lo = mid
    else hi = mid
  }
  const l = (lo + hi) / 2
  const ke = keFor(l)
  return { l, ke, freq2: findFreq2({ l, ke }), lApparente: apparentInductance({ l, ke }) }
}

/** Déphasage de I_B par rapport à I_A (fronts montants à +0,5 A), en degrés dans ]−180 ; 180] (+90 = I_B en avance de T/4). */
export function phaseShiftDeg(sim: StepperSim): number {
  const a = risingCrossings(sim, sim.iA, 0.5)[0]
  const b = risingCrossings(sim, sim.iB, 0.5).find((t) => t > a)
  if (a === undefined || b === undefined) return NaN
  const lagB = (((b - a) % sim.period) + sim.period) % sim.period // retard de B sur A
  const deg = 360 - (lagB / sim.period) * 360 // avance de B
  return deg > 180 ? deg - 360 : deg
}

/** Périodes d'horloge par période de courant, mesurées sur I_A. */
export function clocksPerCurrentPeriod(sim: StepperSim): number {
  const r = risingCrossings(sim, sim.iA, 0.5)
  return r.length < 2 ? NaN : ((r[r.length - 1] - r[0]) / (r.length - 1)) * sim.f
}
