/**
 * Trafic de la salle du TP3 : hub 10Base2, coax 50 Ω bouchonné aux deux bouts. Broadcasts de fond aléatoires
 * et ping -l L -t d'un PC vers l'automate TSX 57, tirés seconde par seconde (graine), à la demande.
 */
import { ETH10B2 } from '../../data/reference'
import { mulberry32 } from '../../au3/sim/prng'
import { gamma, withEcho } from './coax'
import {
  activityEnd,
  bitsEnd,
  BROADCAST,
  durationUs,
  ETHERTYPE_ARP,
  ETHERTYPE_IPV4,
  ethernetSource,
  ethFrame,
  ipv4,
  pingDatagrams,
  PROTO_UDP,
  timed,
  type Ip,
  type Mac,
  type TimedFrame,
} from './ethernet'
import type { SignalSource } from '../scope/types'

export interface Station {
  name: string
  ip: Ip
  mac: Mac
}

/** OUI réels : Dell, HP, Intel… pour les PC ; Telemecanique (Schneider) pour le TSX */
const OUI_PC: Mac[] = [
  [0xb8, 0xac, 0x6f],
  [0xf0, 0x1f, 0xaf],
  [0x3c, 0xd9, 0x2b],
  [0xa4, 0xbb, 0x6d],
  [0x00, 0x1b, 0x21],
]
const OUI_TSX: Mac = [0x00, 0x80, 0xf4]
const NET: Ip = [192, 168, 202]
const PC_HOSTS = [121, 122, 123, 124, 125, 126, 127, 128]
const TSX_HOST = 229
const BCAST_HOST = 255
const BYTE = 256
/** Message ARP Ethernet/IPv4 — octets */
const ARP_LEN = 28

/** Postes de la salle, adresses MAC fixées par la graine */
export function salle(seed: number): { pcs: Station[]; tsx: Station } {
  const rnd = mulberry32(seed)
  const nic = (oui: Mac): Mac => [...oui, ...[0, 1, 2].map(() => Math.floor(rnd() * BYTE))]
  const pcs = PC_HOSTS.map((h, i) => ({ name: `PC${i + 1}`, ip: [...NET, h], mac: nic(OUI_PC[Math.floor(rnd() * OUI_PC.length)]) }))
  return { pcs, tsx: { name: 'TSX 57', ip: [...NET, TSX_HOST], mac: nic(OUI_TSX) } }
}

/** ping -l L -t lancé à l'instant `start` (s, temps du banc) de `from` vers `to` (par défaut PC1 → TSX) */
export type Scenario = { kind: 'fond' } | { kind: 'ping'; L: number; from?: Station; to?: Station; start?: number }

/** Requête ARP « qui a ip ? » diffusée par `from` */
function arpRequest(from: Station, target: Ip): Uint8Array {
  // Matériel Ethernet (1), protocole IPv4, longueurs 6 et 4, opération 1 (requête)
  const b = new Uint8Array(28)
  b.set([0, 1, 0x08, 0x00, 6, 4, 0, 1], 0)
  b.set(from.mac, 8)
  b.set(from.ip, 14)
  b.set(target, 24)
  return b
}

/** Réponse ARP (opération 2) de `from` à `to`, en unicast */
function arpReply(from: Station, to: Station): Uint8Array {
  const b = arpRequest(from, to.ip)
  b[7] = 2
  b.set(to.mac, 18)
  return b
}

/** Datagramme UDP diffusé (port NetBIOS 137) de `n` octets de données, somme UDP non calculée (0) */
function udpBroadcast(from: Station, n: number, rnd: () => number): Uint8Array {
  const port = 137
  const u = new Uint8Array(8 + n)
  u.set([port >> 8, port & 0xff, port >> 8, port & 0xff, (8 + n) >> 8, (8 + n) & 0xff, 0, 0])
  for (let i = 8; i < u.length; i++) u[i] = Math.floor(rnd() * BYTE)
  return ipv4({ id: Math.floor(rnd() * BYTE * BYTE), proto: PROTO_UDP, src: from.ip, dst: [...NET, BCAST_HOST], payload: u })
}

/** Ping requête ou réponse : trames des fragments, séparées par l'espace inter-trame */
export function pingFrames(t0: number, L: number, from: Station, to: Station, type: 8 | 0, seq: number): TimedFrame[] {
  const out: TimedFrame[] = []
  let t = t0
  for (const d of pingDatagrams(L, from.ip, to.ip, { type, seq, ipId: seq })) {
    const f = timed(t, ethFrame(to.mac, from.mac, ETHERTYPE_IPV4, d), type === 8 ? 'ping requête' : 'ping réponse')
    out.push(f)
    t = f.t0 + f.halves.length / 2 / ETH10B2.debit + ETH10B2.ifg
  }
  return out
}

/** Instant (dans la seconde) de la requête ping — s */
const PING_PHASE = 0.5
/** Fenêtre réservée au ping dans chaque seconde — s */
const PING_WINDOW = 0.02

/** Trames de la seconde n (t ∈ [n, n+1[), triées, sans recouvrement */
export function framesOfSecond(seed: number, scenario: Scenario, n: number): TimedFrame[] {
  const rnd = mulberry32((seed * 7919 + n * 104729) >>> 0)
  const { pcs, tsx } = salle(seed)
  const frames: TimedFrame[] = []
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]
  const nb = ETH10B2.broadcastsMin + Math.floor(rnd() * (ETH10B2.broadcastsMax - ETH10B2.broadcastsMin + 1))
  for (let i = 0; i < nb; i++) {
    // Hors de la fenêtre du ping, à au moins 2 ms de la fin de seconde
    let u = rnd() * (1 - PING_WINDOW - 0.002)
    if (u >= PING_PHASE) u += PING_WINDOW
    const from = pick(pcs)
    const payload = rnd() < ETH10B2.partUdp ? udpBroadcast(from, 50, rnd) : arpRequest(from, pick([...pcs, tsx]).ip)
    const type = payload.length === ARP_LEN ? ETHERTYPE_ARP : ETHERTYPE_IPV4
    frames.push(timed(n + u, ethFrame(BROADCAST, from.mac, type, payload), type === ETHERTYPE_ARP ? 'ARP (broadcast)' : 'UDP (broadcast)'))
  }
  const nStart = scenario.kind === 'ping' ? Math.ceil(scenario.start ?? 0) : 0
  if (scenario.kind === 'ping' && n >= nStart) {
    const from = scenario.from ?? pcs[0]
    const to = scenario.to ?? tsx
    const delay = () => ETH10B2.reponseMin + rnd() * (ETH10B2.reponseMax - ETH10B2.reponseMin)
    let t = n + PING_PHASE + rnd() * 1e-3
    // 1er ping de la séquence, puis à chaque expiration du cache ARP : qui a l'IP du destinataire ?
    if ((n - nStart) % ETH10B2.arpCache === 0) {
      const req = timed(t, ethFrame(BROADCAST, from.mac, ETHERTYPE_ARP, arpRequest(from, to.ip)), 'ARP requête (broadcast)')
      const rep = timed(activityEnd(req) + delay(), ethFrame(from.mac, to.mac, ETHERTYPE_ARP, arpReply(to, from)), 'ARP réponse')
      frames.push(req, rep)
      t = activityEnd(rep) + ETH10B2.ifg
    }
    const req = pingFrames(t, scenario.L, from, to, 8, n + 1)
    frames.push(...req, ...pingFrames(activityEnd(req[req.length - 1]) + delay(), scenario.L, to, from, 0, n + 1))
  }
  frames.sort((a, b) => a.t0 - b.t0)
  // Accès au support : une trame attend la fin de la précédente + espace inter-trame
  for (let i = 1; i < frames.length; i++) {
    const free = bitsEnd(frames[i - 1]) + ETH10B2.ifg
    if (frames[i].t0 < free) frames[i] = timed(free, frames[i].frame, frames[i].label)
  }
  return frames
}

/** Trafic de la salle : source pour l'oscillo (bouchon retiré ⇒ écho Γ = +1) et trames visibles sur un intervalle. */
export function salleTraffic(seed: number, scenario: Scenario, bouchon: boolean) {
  const cache = new Map<number, TimedFrame[]>()
  const second = (n: number) => {
    let f = cache.get(n)
    if (!f) {
      f = framesOfSecond(seed, scenario, n)
      if (cache.size > 8) cache.clear()
      cache.set(n, f)
    }
    return f
  }
  const framesIn = (a: number, b: number): TimedFrame[] => {
    const out: TimedFrame[] = []
    for (let n = Math.floor(a) - 1; n <= Math.floor(b); n++) for (const f of second(n)) if (activityEnd(f) >= a && f.t0 <= b) out.push(f)
    return out
  }
  const clean = ethernetSource(framesIn)
  // Bouchon retiré à d du point d'observation : extrémité ouverte, écho Γ = +1 après un aller-retour
  const source: SignalSource = bouchon ? clean : withEcho(clean, (2 * ETH10B2.dBouchon) / ETH10B2.v, gamma(Infinity, ETH10B2.zCharge * 2))
  return { source, framesIn }
}

/* ─────────────── API du partiel ─────────────── */

export interface PingExpected {
  L: number
  paddingBytes: number
  /** Octets sur le câble de la 1re trame de requête, préambule et FCS compris */
  frameBytesOnWire: number
  /** Durée de cette trame — µs */
  durationUs: number
  firstMacDstByte: number
}

/** Ping tiré par graine : L ∈ [1 ; 1472] (≈ 30 % sous 18 octets, donc avec bourrage), une seule trame de requête. */
export function createPingExercise(seed: number): { L: number; from: Station; to: Station; frames: TimedFrame[]; expected: PingExpected } {
  const rnd = mulberry32(seed ^ 0x5bd1e995)
  const short = ETH10B2.payloadMin - 28 - 1 // L ≤ 17 ⇒ bourrage
  const L = rnd() < ETH10B2.partBourrage ? ETH10B2.pingMin + Math.floor(rnd() * short) : short + 1 + Math.floor(rnd() * (ETH10B2.pingMax - short))
  const { pcs, tsx } = salle(seed)
  const all = [...pcs, tsx]
  const from = pcs[Math.floor(rnd() * pcs.length)]
  const others = all.filter((s) => s !== from)
  const to = others[Math.floor(rnd() * others.length)]
  const frames = pingFrames(0, L, from, to, 8, 1)
  const f = frames[0].frame
  return { L, from, to, frames, expected: { L, paddingBytes: f.padLen, frameBytesOnWire: f.wire.length, durationUs: durationUs(f), firstMacDstByte: to.mac[0] } }
}

export interface PingGradeDetail {
  key: keyof PingExpected
  given: number
  expected: number
  ok: boolean
}

/** Correction : durée à ±2 %, tout le reste exact. Score dans [0, 1]. */
export function gradePing(expected: PingExpected, answers: Partial<Record<keyof PingExpected, number>>): { score: number; details: PingGradeDetail[] } {
  const details = (Object.keys(expected) as (keyof PingExpected)[]).map((key) => {
    const given = answers[key] ?? NaN
    const e = expected[key]
    const ok = Number.isFinite(given) && (key === 'durationUs' ? Math.abs(given - e) <= ETH10B2.tolDuree * e : given === e)
    return { key, given, expected: e, ok }
  })
  return { score: details.filter((d) => d.ok).length / details.length, details }
}
