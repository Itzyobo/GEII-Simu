/**
 * Bus RS485 du pupitre, en fonctions pures : chronologie des trames (busSimulate) et signaux TX+, TX−, TX_EN
 * vus depuis une carte (rs485Lines). Temps en secondes, sur l'horloge de simulation.
 */
import { REF } from '../data/reference'
import { mulberry32 } from './scope'
import { PUPITRE, crcOk, slaveRespond, withCrc } from './slaves'
import { uartDecode, uartFrame, type Liaison, type Received, type Waveform } from './uart'

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

/** Trame émise par un seul driver */
interface Part {
  t0: number
  bytes: number[]
}

export interface BusFrame {
  t0: number
  t1: number
  /** Octets relus sur la ligne (pour une collision : ce que lit un récepteur) */
  bytes: number[]
  drivers: Driver[]
  type: 'MAITRE' | 'ESCLAVE'
  /** Plusieurs drivers en même temps : `parts` garde ce que chacun émettait */
  collision: boolean
  parts?: Part[]
  crcOk: boolean
  /** Sur la paire du pupitre (false : carte non branchée, la trame reste sur ses propres broches) */
  onBus: boolean
}

/** Requête 07 du parcours vers l'adresse `adr` */
export const parcoursRequest = (adr: number) => withCrc([adr, 7])

/** Heures d'émission des requêtes d'un maître qui tombent dans [w0, w1]. */
function schedule(e: Emetteur, w0: number, w1: number): Part[] {
  const I = REF.parcoursIntervalle.value
  const n = REF.parcoursAdresses.value
  const out: Part[] = []
  const p = e.parcours?.debut ?? null
  const fin = e.parcours?.fin ?? 0
  if (p !== null)
    for (let k = Math.max(0, Math.floor((w0 - p) / I)); k < n && p + k * I <= w1 && p + k * I < fin; k++) if (p + k * I >= w0) out.push({ t0: p + k * I, bytes: parcoursRequest(k) })
  if (e.memorized.length) {
    const poll = REF.pollPeriod.value
    for (let c = Math.max(0, Math.floor((w0 - e.memStart) / poll) - 1); e.memStart + c * poll <= w1; c++)
      e.memorized.forEach((bytes, j) => {
        let t = e.memStart + c * poll + j * I
        // Pendant un parcours : au milieu du créneau en cours (H38)
        if (p !== null && t >= p && t < fin) t = p + (Math.floor((t - p) / I) + REF.memoriseesAuMilieuDuCreneau.value) * I
        if (t >= w0 && t <= w1) out.push({ t0: t, bytes })
      })
  }
  return out.sort((a, b) => a.t0 - b.t0)
}

const bitsOf = (p: Part) => p.bytes.flatMap((b) => uartFrame(b, MODBUS))
const partsOf = (f: BusFrame): Part[] => f.parts ?? [{ t0: f.t0, bytes: f.bytes }]

type Etat = 0 | 1 | 'conflit' | 'hz'

/**
 * État de la ligne à l'instant t, d'après les trames dont le driver est actif : personne → haute impédance ;
 * bits identiques → ce bit ; bits opposés → conflit (H39). Un driver actif hors de ses caractères impose le repos (1).
 */
function etatLigne(parts: { part: Part; bits: number[]; win: readonly [number, number] }[], t: number): Etat {
  let etat: Etat = 'hz'
  for (const { part, bits, win } of parts) {
    if (t < win[0] || t >= win[1]) continue
    const k = Math.floor((t - part.t0) / BIT + 1e-9)
    const b = k >= 0 && k < bits.length ? (bits[k] as 0 | 1) : 1
    etat = etat === 'hz' ? b : etat === b ? b : 'conflit'
  }
  return etat
}

/** Graine du tirage d'une collision : déterministe, tirée de l'instant de la trame */
const graine = (t: number) => Math.round(t * 1e7)

/** Collision : ce que relit un récepteur UART sur la ligne combinée ; un bit en conflit est tiré au hasard (H39). */
function combine(group: BusFrame[]): BusFrame {
  const parts = group.flatMap(partsOf)
  const t0 = Math.min(...group.map((f) => f.t0))
  const t1 = Math.max(...group.map((f) => f.t1))
  const info = parts.map((part) => {
    const bits = bitsOf(part)
    return { part, bits, win: [part.t0, part.t0 + bits.length * BIT] as const }
  })
  const edges = [...new Set(info.flatMap(({ part, bits }) => bits.map((_, k) => part.t0 + k * BIT)).concat([t1]))].sort((a, b) => a - b)
  const rnd = mulberry32(graine(t0))
  const lead = 2 * BIT // repos avant le premier start
  const volts = (b: number) => (b ? REF.ttlHigh.value : REF.ttlLow.value)
  const samples = [{ t: 0, v: volts(1) }]
  for (const t of edges) {
    const e = etatLigne(info, t)
    samples.push({ t: t - t0 + lead, v: volts(e === 'conflit' ? (rnd() < 0.5 ? 0 : 1) : e === 'hz' ? 1 : e) })
  }
  const bytes = uartDecode({ samples, period: t1 - t0 + 2 * lead }, MODBUS).map((r) => r.byte)
  return { t0, t1, bytes, drivers: group.flatMap((f) => f.drivers), type: 'MAITRE', collision: true, parts, crcOk: crcOk(bytes), onBus: true }
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
 * Trames superposées : octets corrompus (H39), CRC faux, aucun esclave ne répond.
 */
export function busSimulate(emetteurs: readonly Emetteur[], w0: number, w1: number): BusFrame[] {
  // Marge : une réponse peut suivre une requête émise juste avant la fenêtre
  const margin = REF.esclaveDelaiReponse.value + frameDuration(260)
  const masterFrames = (connected: boolean) =>
    emetteurs
      .filter((e) => e.connected === connected)
      .flatMap((e) =>
        schedule(e, w0 - margin, w1).map(
          ({ t0, bytes }): BusFrame => ({ t0, t1: t0 + frameDuration(bytes.length), bytes, drivers: [e.card], type: 'MAITRE', collision: false, crcOk: crcOk(bytes), onBus: connected }),
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
const driveWindow = (t0: number, t1: number) => [t0 - REF.txEnAvance.value, t1 + REF.txEnRetard.value] as const

export interface Lines {
  txp: Waveform
  txm: Waveform
  txen: Waveform
}

/**
 * TX+, TX− et TX_EN sur les broches de `card` pendant [w0, w1) (signal périodique de période w1 − w0).
 * Piloté : 1 logique ⇔ TX+ > TX− (H34), niveaux H8 ; deux drivers en désaccord : différentiel H39.
 * Personne ne pilote : haute impédance, fils tenus par la polarisation (H9) ou au même potentiel sans elle.
 * `parasite` : sinus de mode commun ajouté aux deux fils (H35).
 */
export function rs485Lines(
  frames: readonly BusFrame[],
  card: CardId,
  w0: number,
  w1: number,
  { parasite = false, connected = true, polarisation = true } = {},
): Lines {
  const seen = frames.filter((f) => (connected && f.onBus) || f.drivers.includes(card))
  // Chaque driver actif de t0 − avance à t1 + retard (H33) ; dans une collision, chacun garde ses propres bits
  const info = seen.flatMap((f) =>
    partsOf(f).map((part) => {
      const bits = bitsOf(part)
      return { part, bits, win: driveWindow(part.t0, part.t0 + bits.length * BIT) }
    }),
  )
  const txenAt = (t: number) => seen.some((f) => f.drivers.includes(card) && t >= driveWindow(f.t0, f.t1)[0] && t < driveWindow(f.t0, f.t1)[1])

  const times = new Set<number>([w0])
  for (const { part, bits, win } of info) {
    times.add(win[0]).add(win[1])
    for (let k = 0; k <= bits.length; k++) times.add(part.t0 + k * BIT)
  }
  const fp = REF.parasiteFrequence.value
  const STEPS = 24
  if (parasite) for (let t = Math.ceil(w0 * fp * STEPS) / (fp * STEPS); t < w1; t += 1 / (fp * STEPS)) times.add(t)
  const grid = [...times].filter((t) => t >= w0 && t < w1).sort((a, b) => a - b)

  const hi = REF.rs485High.value
  const lo = REF.rs485Low.value
  const mid = (hi + lo) / 2
  const conflit = REF.rs485Conflit.value / 2
  const repos = polarisation ? [REF.rs485IdlePlus.value, REF.rs485IdleMinus.value] : [REF.rs485SansPolarisation.value, REF.rs485SansPolarisation.value]
  const niveaux = (e: Etat): [number, number] => (e === 'hz' ? [repos[0]!, repos[1]!] : e === 'conflit' ? [mid + conflit, mid - conflit] : e ? [hi, lo] : [lo, hi])
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
    txp: wave((t) => niveaux(etatLigne(info, t))[0] + pv(t)),
    txm: wave((t) => niveaux(etatLigne(info, t))[1] + pv(t)),
    txen: wave((t) => (txenAt(t) ? REF.ttlHigh.value : REF.ttlLow.value)),
  }
}

/**
 * Récepteur RS485 branché sur la paire : lit TX+ − TX− ; sous le seuil de ± 200 mV (EIA-485), chaque durée de bit
 * est tirée au hasard (graine fixée). Avec la polarisation (H9), les silences sont lus comme des 1 : aucun caractère.
 */
export function lireLigne({ txp, txm }: Pick<Lines, 'txp' | 'txm'>, seed = 1): Received[] {
  const rnd = mulberry32(seed)
  const period = txp.period
  const at = (w: Waveform, t: number) => {
    let v = w.samples[0]?.v ?? 0
    for (const s of w.samples) {
      if (s.t > t) break
      v = s.v
    }
    return v
  }
  const edges = [...new Set([...txp.samples, ...txm.samples].map((s) => s.t))].sort((a, b) => a - b)
  const volts = (b: number) => (b ? REF.ttlHigh.value : REF.ttlLow.value)
  const samples: Waveform['samples'] = []
  edges.forEach((t, i) => {
    const d = at(txp, t) - at(txm, t)
    if (Math.abs(d) >= REF.rs485Seuil.value) return samples.push({ t, v: volts(d > 0 ? 1 : 0) })
    // Indéterminé : un tirage par durée de bit jusqu'au prochain changement
    const end = edges[i + 1] ?? period
    for (let u = t; u < end; u += BIT) samples.push({ t: u, v: volts(rnd() < 0.5 ? 0 : 1) })
  })
  return uartDecode({ samples, period }, MODBUS)
}

/** Zones à annoter sur l'écran (mode entraînement), en temps relatif à w0. */
export function busZones(frames: readonly BusFrame[], card: CardId, w0: number, w1: number, connected = true) {
  const zones: { from: number; to: number; label: 'prise de ligne' | 'réponse esclave' | 'haute impédance' }[] = []
  const driven = frames
    .filter((f) => (connected && f.onBus) || f.drivers.includes(card))
    .map((f) => ({ f, win: driveWindow(f.t0, f.t1) }))
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
