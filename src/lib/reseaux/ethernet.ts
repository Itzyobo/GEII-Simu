/**
 * Ethernet 10Base2, pur : en-têtes IPv4 / ICMP, fragmentation du ping, trame Ethernet (préambule, SFD, bourrage,
 * FCS CRC-32), sérialisation poids faible en premier, codage Manchester, niveaux électriques sur le coax,
 * et source d'oscilloscope construite sur une liste de trames datées (aucune pré-génération du signal).
 */
import { ETH10B2 } from '../../data/reference'
import type { SignalSource } from '../scope/types'

export type Bytes = Uint8Array
export type Mac = readonly number[]
export type Ip = readonly number[]

// Constantes de syntaxe des protocoles (valeurs fixées par les normes, pas des grandeurs physiques)
const IPV4_VERSION_IHL = 0x45
const IP_HEADER = 20
const ICMP_HEADER = 8
const ETH_HEADER = 14
const FCS = 4
const PREAMBLE_BYTE = 0x55
const SFD = 0xd5
const FLAG_DF = 0x4000
const FLAG_MF = 0x2000
const CRC32_POLY = 0xedb88320
export const ETHERTYPE_IPV4 = 0x0800
export const ETHERTYPE_ARP = 0x0806
export const PROTO_ICMP = 1
export const PROTO_UDP = 17
export const BROADCAST: Mac = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff]

/** Durée d'un bit — s (100 ns) */
export const BIT = 1 / ETH10B2.debit
/** Durée d'un octet sur le câble — µs (0,8 µs) */
export const BYTE_US = 8 * BIT * 1e6

/* ─────────────── Sommes de contrôle ─────────────── */

/** CRC-32 IEEE 802.3 (réfléchi, init et XOR final 0xFFFFFFFF). « 123456789 » ⇒ 0xCBF43926. */
export function crc32(bytes: ArrayLike<number>): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i]
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ CRC32_POLY : c >>> 1
  }
  return (c ^ 0xffffffff) >>> 0
}

/** Somme de contrôle Internet : complément à 1 de la somme en complément à 1 des mots de 16 bits. */
export function inetChecksum(bytes: ArrayLike<number>): number {
  let s = 0
  for (let i = 0; i < bytes.length; i += 2) s += (bytes[i] << 8) | (i + 1 < bytes.length ? bytes[i + 1] : 0)
  while (s > 0xffff) s = (s & 0xffff) + (s >>> 16)
  return ~s & 0xffff
}

const put16 = (b: Bytes, i: number, v: number) => {
  b[i] = (v >>> 8) & 0xff
  b[i + 1] = v & 0xff
}

/* ─────────────── IPv4, ICMP ─────────────── */

export interface Ipv4Opts {
  tos?: number
  id: number
  df?: boolean
  mf?: boolean
  /** Décalage du fragment en octets (multiple de 8, codé en unités de 8 octets dans le champ) */
  fragOffset?: number
  ttl?: number
  proto: number
  src: Ip
  dst: Ip
  payload: Bytes
}

/** Datagramme IPv4 sans options (en-tête de 20 octets, 45h) avec sa somme de contrôle. */
export function ipv4(o: Ipv4Opts): Bytes {
  const b = new Uint8Array(IP_HEADER + o.payload.length)
  b[0] = IPV4_VERSION_IHL
  b[1] = o.tos ?? 0
  put16(b, 2, b.length)
  put16(b, 4, o.id)
  put16(b, 6, (o.df ? FLAG_DF : 0) | (o.mf ? FLAG_MF : 0) | ((o.fragOffset ?? 0) / 8))
  b[8] = o.ttl ?? ETH10B2.ttlWindows
  b[9] = o.proto
  b.set(o.src, 12)
  b.set(o.dst, 16)
  put16(b, 10, inetChecksum(b.subarray(0, IP_HEADER)))
  b.set(o.payload, IP_HEADER)
  return b
}

/** Données d'un ping Windows : « abcdefghijklmnopqrstuvw » en boucle (61h…77h). */
export function pingData(L: number): Bytes {
  const a = 'a'.charCodeAt(0)
  const n = 'w'.charCodeAt(0) - a + 1
  return Uint8Array.from({ length: L }, (_, i) => a + (i % n))
}

/** Message ICMP Echo (type 8 requête, 0 réponse), code 0, avec sa somme de contrôle. */
export function icmpEcho(type: 8 | 0, id: number, seq: number, data: Bytes): Bytes {
  const b = new Uint8Array(ICMP_HEADER + data.length)
  b[0] = type
  put16(b, 4, id)
  put16(b, 6, seq)
  b.set(data, ICMP_HEADER)
  put16(b, 2, inetChecksum(b))
  return b
}

/** Charge utile Ethernet découpée en champs nommés (pour la surimpression et la vue hexa) */
export interface Datagram {
  bytes: Bytes
  parts: { name: FieldName; len: number }[]
}

/**
 * Datagrammes IP d'un ping de L octets de données. Si 8 + L > 1480 : fragmentation en morceaux de 1480 octets,
 * seul le premier porte l'en-tête ICMP ; MF = 1 sauf sur le dernier ; décalages 0, 1480, 2960…
 */
export function pingDatagrams(L: number, src: Ip, dst: Ip, o: { type?: 8 | 0; id?: number; seq?: number; ipId?: number; ttl?: number } = {}): Datagram[] {
  const icmp = icmpEcho(o.type ?? 8, o.id ?? 1, o.seq ?? 1, pingData(L))
  const out: Datagram[] = []
  for (let off = 0; off < icmp.length; off += ETH10B2.fragment) {
    const chunk = icmp.subarray(off, Math.min(icmp.length, off + ETH10B2.fragment))
    const mf = off + chunk.length < icmp.length
    const bytes = ipv4({ id: o.ipId ?? 1, mf, fragOffset: off, ttl: o.ttl, proto: PROTO_ICMP, src, dst, payload: chunk })
    const parts: Datagram['parts'] = off === 0 ? [{ name: 'IP', len: IP_HEADER }, { name: 'ICMP', len: ICMP_HEADER }, { name: 'Données', len: chunk.length - ICMP_HEADER }] : [{ name: 'IP', len: IP_HEADER }, { name: 'Données', len: chunk.length }]
    out.push({ bytes, parts: parts.filter((p) => p.len > 0) })
  }
  return out
}

/* ─────────────── Trame Ethernet ─────────────── */

export type FieldName = 'Préambule' | 'SFD' | 'MAC dest' | 'MAC src' | 'Type' | 'IP' | 'ICMP' | 'ARP' | 'UDP' | 'Données' | 'Bourrage' | 'FCS'

export interface Field {
  name: FieldName
  /** Premier octet sur le câble (préambule compris) */
  start: number
  len: number
}

export interface EthFrame {
  /** Octets sur le câble : préambule, SFD, en-tête, charge, bourrage, FCS */
  wire: Bytes
  fields: Field[]
  padLen: number
}

/** Trame Ethernet II : préambule 7×55h, SFD D5h, MACs, type, charge, bourrage à 46 octets, FCS poids faible en premier. */
export function ethFrame(dst: Mac, src: Mac, type: number, payload: Bytes | Datagram, padByte = 0x00): EthFrame {
  const data = payload instanceof Uint8Array ? payload : payload.bytes
  const parts = payload instanceof Uint8Array ? [{ name: 'Données' as const, len: data.length }] : payload.parts
  const padLen = Math.max(0, ETH10B2.payloadMin - data.length)
  const pre = ETH10B2.preambule + 1
  const frameLen = ETH_HEADER + data.length + padLen
  const wire = new Uint8Array(pre + frameLen + FCS)
  wire.fill(PREAMBLE_BYTE, 0, ETH10B2.preambule)
  wire[ETH10B2.preambule] = SFD
  wire.set(dst, pre)
  wire.set(src, pre + 6)
  put16(wire, pre + 12, type)
  wire.set(data, pre + ETH_HEADER)
  wire.fill(padByte, pre + ETH_HEADER + data.length, pre + frameLen)
  const fcs = crc32(wire.subarray(pre, pre + frameLen))
  for (let k = 0; k < FCS; k++) wire[pre + frameLen + k] = (fcs >>> (8 * k)) & 0xff
  const fields: Field[] = []
  let at = 0
  const add = (name: FieldName, len: number) => {
    if (len > 0) fields.push({ name, start: at, len })
    at += len
  }
  add('Préambule', ETH10B2.preambule)
  add('SFD', 1)
  add('MAC dest', 6)
  add('MAC src', 6)
  add('Type', 2)
  for (const p of parts) add(p.name, p.len)
  add('Bourrage', padLen)
  add('FCS', FCS)
  return { wire, fields, padLen }
}

/** Octets montrés par Wireshark : ni préambule, ni SFD, ni bourrage, ni FCS. */
export function wiresharkBytes(f: EthFrame): Bytes {
  const pre = ETH10B2.preambule + 1
  return f.wire.subarray(pre, f.wire.length - FCS - f.padLen)
}

/** Bits émis : chaque octet poids faible en premier (55h ⇒ 1,0,1,0,…). */
export function serialize(bytes: ArrayLike<number>): Uint8Array {
  const out = new Uint8Array(bytes.length * 8)
  for (let i = 0; i < bytes.length; i++) for (let k = 0; k < 8; k++) out[8 * i + k] = (bytes[i] >>> k) & 1
  return out
}

/**
 * Manchester IEEE 802.3 (horloge XOR donnée, horloge à 1 sur la 1re demi-période) : deux demi-bits par bit.
 * 0 ⇒ haut puis bas (front descendant au milieu), 1 ⇒ bas puis haut (front montant).
 */
export function manchester(bits: ArrayLike<number>): Uint8Array {
  const out = new Uint8Array(bits.length * 2)
  for (let i = 0; i < bits.length; i++) {
    out[2 * i] = 1 ^ bits[i]
    out[2 * i + 1] = bits[i]
  }
  return out
}

/** Durée d'une trame sur le câble, préambule compris — µs */
export const durationUs = (f: EthFrame) => f.wire.length * BYTE_US

/** L d'un ping retrouvé à partir de la durée T (µs, préambule → fin) ; sous 57,6 µs, d'après le bourrage compté. */
export function pingLengthFromDuration(Tus: number, paddingBytes = 0): number {
  const minUs = (ETH10B2.preambule + 1 + ETH_HEADER + ETH10B2.payloadMin + FCS) * BYTE_US
  return Tus > minUs + 1e-9 ? Math.round(Tus / BYTE_US - (ETH10B2.preambule + 1 + ETH_HEADER + IP_HEADER + ICMP_HEADER + FCS)) : ETH10B2.payloadMin - IP_HEADER - ICMP_HEADER - paddingBytes
}

/* ─────────────── Signal électrique sur le coax ─────────────── */

/** Niveaux sur le coax pendant une trame : la carte tire I dans 25 Ω, donc tensions négatives — V */
export const LEVELS = {
  /** Niveau logique haut (courant minimal 10 mA) : −0,25 V */
  haut: -(ETH10B2.iMoyen - ETH10B2.iEcart) * ETH10B2.zCharge,
  /** Niveau logique bas (courant maximal 70 mA) : −1,75 V */
  bas: -(ETH10B2.iMoyen + ETH10B2.iEcart) * ETH10B2.zCharge,
} as const

/** Trame placée dans le temps du banc */
export interface TimedFrame {
  /** Début du préambule — s */
  t0: number
  frame: EthFrame
  /** Demi-bits Manchester (1 = haut) */
  halves: Uint8Array
  /** Description courte (ARP, ping requête…) */
  label: string
}

export const timed = (t0: number, frame: EthFrame, label: string): TimedFrame => ({ t0, frame, halves: manchester(serialize(frame.wire)), label })

const HALF = BIT / 2
const TR = ETH10B2.front
const HOLD = ETH10B2.finMaintien
const FALL = ETH10B2.finRetour
/** Fin des bits de la trame — s */
export const bitsEnd = (f: TimedFrame) => f.t0 + f.halves.length * HALF
/** Fin de l'activité électrique (retour à 0 V) — s */
export const activityEnd = (f: TimedFrame) => bitsEnd(f) + HOLD + FALL

const lev = (h: number) => (h ? LEVELS.haut : LEVELS.bas)

/** Tension d'une trame à l'instant t (0 V hors trame) */
export function frameValue(f: TimedFrame, t: number): number {
  const u = t - f.t0
  if (u < 0) return 0
  const n = f.halves.length
  const k = Math.floor(u / HALF)
  if (k < n) {
    const cur = lev(f.halves[k])
    const prev = k === 0 ? 0 : lev(f.halves[k - 1])
    const du = u - k * HALF
    return du < TR && prev !== cur ? prev + ((cur - prev) * du) / TR : cur
  }
  const du = u - n * HALF
  const last = lev(f.halves[n - 1])
  if (du < TR) return last + ((LEVELS.haut - last) * du) / TR
  if (du < HOLD) return LEVELS.haut
  if (du < HOLD + FALL) return LEVELS.haut * (1 - (du - HOLD) / FALL)
  return 0
}

/** Coins d'une trame dans [a, b] (début et fin de chaque front) */
export function frameEdges(f: TimedFrame, a: number, b: number, out: number[]) {
  const n = f.halves.length
  const push = (t: number) => t >= a && t <= b && out.push(t)
  const k0 = Math.max(0, Math.floor((a - f.t0) / HALF) - 1)
  const k1 = Math.min(n - 1, Math.ceil((b - f.t0) / HALF))
  for (let k = k0; k <= k1; k++)
    if (k === 0 || f.halves[k] !== f.halves[k - 1]) {
      push(f.t0 + k * HALF)
      push(f.t0 + k * HALF + TR)
    }
  const e = bitsEnd(f)
  for (const t of [e, e + TR, e + HOLD, e + HOLD + FALL]) push(t)
}

/**
 * Source d'oscilloscope sur des trames datées. `framesNear(t0, t1)` rend les trames qui recouvrent [t0, t1],
 * triées et sans recouvrement entre elles (le support CSMA/CD n'a pas de collision ici).
 */
export function ethernetSource(framesNear: (t0: number, t1: number) => readonly TimedFrame[]): SignalSource {
  return {
    value: (t) => {
      for (const f of framesNear(t, t)) if (t >= f.t0 && t <= activityEnd(f)) return frameValue(f, t)
      return 0
    },
    edges: (a, b) => {
      const out: number[] = []
      for (const f of framesNear(a, b)) frameEdges(f, a, b, out)
      return out.sort((x, y) => x - y)
    },
  }
}
