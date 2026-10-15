/**
 * Bus RS485 du pupitre, en fonctions pures : chronologie des trames (busSimulate) et signaux TX+, TX−, TX_EN
 * vus depuis une carte (rs485Lines). Temps en secondes, sur l'horloge de simulation.
 */
import { REF } from '../data/reference'
import { PUPITRE, crcOk, slaveRespond, withCrc } from './slaves'
import { uartDecode, uartFrame, type Liaison, type Waveform } from './uart'

export type CardId = 'c1' | 'c2'
/** Qui pilote la ligne : une carte, ou un esclave (son adresse) */
export type Driver = CardId | number

export const MODBUS: Liaison = { baud: REF.modbusBaud.value, dataBits: REF.modbusDataBits.value, parity: REF.modbusParity.value, stopBits: REF.modbusStopBits.value }
const BIT = 1 / MODBUS.baud
const CHAR = uartFrame(0, MODBUS).length * BIT

/** Durée d'une trame de n octets consécutifs — s */
export const frameDuration = (n: number) => n * CHAR

/** Parcours réseau : adresses 00 à FF à partir de `debut`, interrompu à `fin` (« Arrêter ») */
export interface Parcours {
  debut: number
  fin: number
}
export const parcoursComplet = (debut: number): Parcours => ({ debut, fin: debut + REF.parcoursAdresses.value * REF.parcoursIntervalle.value })

/** Une carte en mode Maître. */
export interface Emetteur {
  card: CardId
  /** Câble DB9/bleu-vert branché au pupitre */
  connected: boolean
  /** Parcours réseau (en cours ou passé), ou null */
  parcours: Parcours | null
  /** Trames mémorisées, émises à la période d'interrogation depuis `memStart` */
  memorized: number[][]
  memStart: number
}

export interface BusFrame {
  t0: number
  t1: number
  bytes: number[]
  drivers: Driver[]
  type: 'MAITRE' | 'ESCLAVE'
  /** Plusieurs drivers en même temps : octets lus sur la ligne combinée */
  collision: boolean
  crcOk: boolean
  /** Sur la paire du pupitre (false : carte non branchée, la trame reste sur ses propres broches) */
  onBus: boolean
}

/** Requête 07 du parcours vers l'adresse `adr` */
export const parcoursRequest = (adr: number) => withCrc([adr, 7])

/** Heures d'émission des requêtes d'un maître qui tombent dans [w0, w1]. */
function schedule(e: Emetteur, w0: number, w1: number): { t: number; bytes: number[] }[] {
  const I = REF.parcoursIntervalle.value
  const n = REF.parcoursAdresses.value
  const out: { t: number; bytes: number[] }[] = []
  const p = e.parcours?.debut ?? null
  const fin = e.parcours?.fin ?? 0
  if (p !== null)
    for (let k = Math.max(0, Math.floor((w0 - p) / I)); k < n && p + k * I <= w1 && p + k * I < fin; k++) if (p + k * I >= w0) out.push({ t: p + k * I, bytes: parcoursRequest(k) })
  if (e.memorized.length) {
    const poll = REF.pollPeriod.value
    for (let c = Math.max(0, Math.floor((w0 - e.memStart) / poll) - 1); e.memStart + c * poll <= w1; c++)
      e.memorized.forEach((bytes, j) => {
        let t = e.memStart + c * poll + j * I
        // Pendant un parcours : au milieu du créneau en cours (H38)
        if (p !== null && t >= p && t < fin) t = p + (Math.floor((t - p) / I) + REF.memoriseesAuMilieuDuCreneau.value) * I
        if (t >= w0 && t <= w1) out.push({ t, bytes })
      })
  }
  return out.sort((a, b) => a.t - b.t)
}

/** Ligne combinée de trames superposées (le 0 l'emporte, H37), relue par un récepteur UART. */
function combine(group: BusFrame[]): BusFrame {
  const t0 = Math.min(...group.map((f) => f.t0))
  const t1 = Math.max(...group.map((f) => f.t1))
  const bits = group.map((f) => ({ t0: f.t0, bits: f.bytes.flatMap((b) => uartFrame(b, MODBUS)) }))
  const bitAt = (t: number) =>
    bits.every(({ t0: s, bits: bs }) => {
      const k = Math.floor((t - s) / BIT + 1e-9)
      return k < 0 || k >= bs.length || bs[k] === 1
    })
      ? 1
      : 0
  const edges = [...new Set(bits.flatMap(({ t0: s, bits: bs }) => bs.map((_, k) => s + k * BIT)).concat(group.map((f) => f.t1)))].sort((a, b) => a - b)
  const lead = 2 * BIT // repos avant le premier start
  const volts = (b: number) => (b ? REF.ttlHigh.value : REF.ttlLow.value)
  const samples = [{ t: 0, v: volts(1) }, ...edges.map((t) => ({ t: t - t0 + lead, v: volts(bitAt(t)) }))]
  const w: Waveform = { samples, period: t1 - t0 + 2 * lead }
  const bytes = uartDecode(w, MODBUS).map((r) => r.byte)
  return { t0, t1, bytes, drivers: group.flatMap((f) => f.drivers), type: 'MAITRE', collision: true, crcOk: crcOk(bytes), onBus: true }
}

/** Regroupe les trames qui se chevauchent ; un groupe de plusieurs trames devient une collision. */
function resolve(frames: BusFrame[]): BusFrame[] {
  const sorted = [...frames].sort((a, b) => a.t0 - b.t0)
  const out: BusFrame[] = []
  let group: BusFrame[] = []
  let end = -Infinity
  const flush = () => {
    if (group.length === 1) out.push(group[0]!)
    else if (group.length > 1) out.push(combine(group))
    group = []
  }
  for (const f of sorted) {
    if (group.length && f.t0 >= end) flush()
    group.push(f)
    end = group.length === 1 ? f.t1 : Math.max(end, f.t1)
  }
  flush()
  return out
}

/**
 * Chronologie des trames dans [w0, w1] : requêtes des maîtres, réponses des esclaves après leur délai (H32).
 * Diffusion (adresse 0) et esclave absent : pas de réponse (le maître constate un délai dépassé).
 * Trames superposées : octets corrompus, CRC faux, aucun esclave ne répond.
 */
export function busSimulate(emetteurs: readonly Emetteur[], w0: number, w1: number): BusFrame[] {
  // Marge : une réponse peut suivre une requête émise juste avant la fenêtre
  const margin = REF.esclaveDelaiReponse.value + frameDuration(260)
  const masterFrames = (connected: boolean) =>
    emetteurs
      .filter((e) => e.connected === connected)
      .flatMap((e) =>
        schedule(e, w0 - margin, w1).map(
          ({ t, bytes }): BusFrame => ({ t0: t, t1: t + frameDuration(bytes.length), bytes, drivers: [e.card], type: 'MAITRE', collision: false, crcOk: crcOk(bytes), onBus: connected }),
        ),
      )

  const requests = resolve(masterFrames(true))
  const answer = (req: BusFrame): BusFrame | null => {
    const module = PUPITRE.get(req.bytes[0] ?? 0)
    if (!req.crcOk || req.bytes[0] === 0 || !module) return null
    const bytes = slaveRespond(module, req.bytes)
    if (!bytes) return null
    const t0 = req.t1 + REF.esclaveDelaiReponse.value
    return { t0, t1: t0 + frameDuration(bytes.length), bytes, drivers: [req.bytes[0]!], type: 'ESCLAVE', collision: false, crcOk: crcOk(bytes), onBus: true }
  }
  const responses = requests.map(answer).filter((f): f is BusFrame => f !== null)
  // Une réponse peut chevaucher la requête d'un autre maître : on regroupe tout une seconde fois.
  // ponytail: une seule passe ; une requête corrompue par une réponse garde ici sa propre réponse si elle en avait une
  const bus = resolve([...requests.filter((r) => !r.collision), ...responses]).concat(requests.filter((r) => r.collision))
  const local = masterFrames(false)
  return [...bus, ...local].filter((f) => f.t1 >= w0 && f.t0 <= w1).sort((a, b) => a.t0 - b.t0)
}

/** Fenêtre d'activation du driver d'une trame (H33) */
const driveWindow = (f: BusFrame) => [f.t0 - REF.txEnAvance.value, f.t1 + REF.txEnRetard.value] as const

export interface Lines {
  txp: Waveform
  txm: Waveform
  txen: Waveform
}

/**
 * TX+, TX− et TX_EN sur les broches de `card` pendant [w0, w1) (signal périodique de période w1 − w0).
 * Piloté : 1 logique ⇔ TX+ > TX− (H34), niveaux H8. Personne ne pilote : haute impédance, les deux fils à H9.
 * `parasite` : sinus de mode commun ajouté aux deux fils (H35).
 */
export function rs485Lines(frames: readonly BusFrame[], card: CardId, w0: number, w1: number, { parasite = false, connected = true } = {}): Lines {
  const seen = frames.filter((f) => (connected && f.onBus) || f.drivers.includes(card))
  // Collision : la ligne relue (f.bytes) est redessinée en caractères consécutifs depuis t0
  const bitsOf = seen.map((f) => ({ f, bits: f.bytes.flatMap((b) => uartFrame(b, MODBUS)), win: driveWindow(f) }))

  // Logique de ligne : null = haute impédance
  const logicAt = (t: number): 0 | 1 | null => {
    let driven = false
    let v: 0 | 1 = 1
    for (const { f, bits, win } of bitsOf) {
      if (t < win[0] || t >= win[1]) continue
      driven = true
      const k = Math.floor((t - f.t0) / BIT + 1e-9)
      if (k >= 0 && t < f.t1 && bits[k] === 0) v = 0
    }
    return driven ? v : null
  }
  const txenAt = (t: number) => seen.some((f) => f.drivers.includes(card) && t >= driveWindow(f)[0] && t < driveWindow(f)[1])

  const times = new Set<number>([w0])
  for (const { f, win } of bitsOf) {
    for (const t of [win[0], win[1], f.t1]) times.add(t)
    for (let k = 0; f.t0 + k * BIT < f.t1; k++) times.add(f.t0 + k * BIT)
  }
  const fp = REF.parasiteFrequence.value
  const STEPS = 24
  if (parasite) for (let t = Math.ceil(w0 * fp * STEPS) / (fp * STEPS); t < w1; t += 1 / (fp * STEPS)) times.add(t)
  const grid = [...times].filter((t) => t >= w0 && t < w1).sort((a, b) => a - b)

  const hi = REF.rs485High.value
  const lo = REF.rs485Low.value
  const idle = REF.rs485Idle.value
  const pv = (t: number) => (parasite ? REF.parasiteAmplitude.value * Math.sin(2 * Math.PI * fp * t) : 0)
  const wave = (f: (t: number) => number): Waveform => {
    const samples: Waveform['samples'] = []
    for (const t of grid) {
      const v = f(t)
      if (samples.at(-1)?.v !== v) samples.push({ t: t - w0, v })
    }
    if (samples[0]?.t !== 0) samples.unshift({ t: 0, v: f(w0) })
    return { samples, period: w1 - w0 }
  }
  return {
    txp: wave((t) => {
      const l = logicAt(t)
      return (l === null ? idle : l ? hi : lo) + pv(t)
    }),
    txm: wave((t) => {
      const l = logicAt(t)
      return (l === null ? idle : l ? lo : hi) + pv(t)
    }),
    txen: wave((t) => (txenAt(t) ? REF.ttlHigh.value : REF.ttlLow.value)),
  }
}

/** Zones à annoter sur l'écran (mode entraînement), en temps relatif à w0. */
export function busZones(frames: readonly BusFrame[], card: CardId, w0: number, w1: number, connected = true) {
  const zones: { from: number; to: number; label: 'prise de ligne' | 'réponse esclave' | 'haute impédance' }[] = []
  const driven = frames
    .filter((f) => (connected && f.onBus) || f.drivers.includes(card))
    .map((f) => ({ f, win: driveWindow(f) }))
    .sort((a, b) => a.win[0] - b.win[0])
  let cursor = w0
  for (const { f, win } of driven) {
    if (win[0] > cursor) zones.push({ from: cursor - w0, to: Math.min(win[0], w1) - w0, label: 'haute impédance' })
    zones.push({ from: Math.max(win[0], w0) - w0, to: Math.min(win[1], w1) - w0, label: f.type === 'ESCLAVE' ? 'réponse esclave' : 'prise de ligne' })
    cursor = Math.max(cursor, win[1])
  }
  if (cursor < w1) zones.push({ from: cursor - w0, to: w1 - w0, label: 'haute impédance' })
  return zones.filter((z) => z.to > z.from)
}
