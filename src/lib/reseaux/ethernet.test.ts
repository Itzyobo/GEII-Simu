import { describe, expect, it } from 'vitest'
import { ETH10B2 } from '../../data/reference'
import {
  BROADCAST,
  crc32,
  durationUs,
  ETHERTYPE_IPV4,
  ethernetSource,
  ethFrame,
  icmpEcho,
  inetChecksum,
  ipv4,
  LEVELS,
  manchester,
  pingData,
  pingDatagrams,
  pingLengthFromDuration,
  PROTO_ICMP,
  serialize,
  timed,
  wiresharkBytes,
} from './ethernet'
import { createPingExercise, framesOfSecond, gradePing, pingFrames, salle, salleTraffic } from './traffic'
import { findTrigger } from '../scope/engine'

const A: number[] = [192, 168, 0, 10]
const B: number[] = [192, 168, 0, 254]
const hex = (b: ArrayLike<number>) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' ')

describe('IPv4 et ICMP', () => {
  it('diapo 74 : 45 00 00 3c c0 40 00 00 80 01 [ck] 192.168.0.10 → 192.168.0.254 ⇒ ck = F827', () => {
    const d = ipv4({ id: 0xc040, ttl: 0x80, proto: PROTO_ICMP, src: A, dst: B, payload: new Uint8Array(40) })
    expect(hex(d.subarray(0, 10))).toBe('45 00 00 3c c0 40 00 00 80 01')
    expect((d[10] << 8) | d[11]).toBe(0xf827)
    expect(inetChecksum(d.subarray(0, 20))).toBe(0)
  })
  it('drapeaux et décalage : champ en unités de 8 octets', () => {
    const d = ipv4({ id: 1, mf: true, df: false, fragOffset: 2960, proto: 1, src: A, dst: B, payload: new Uint8Array(8) })
    expect(((d[6] << 8) | d[7]) & 0x1fff).toBe(2960 / 8)
    expect(d[6] & 0x20).toBe(0x20)
  })
  it('ICMP Echo : la somme recalculée sur le message complet vaut 0 ; données a…w en boucle', () => {
    const m = icmpEcho(8, 1, 7, pingData(50))
    expect(inetChecksum(m)).toBe(0)
    expect(String.fromCharCode(...pingData(25))).toBe('abcdefghijklmnopqrstuvwab')
  })
  it('ping 5000 : fragments de 1480, ICMP dans le 1er seulement, MF sauf le dernier, décalages 0/1480/2960/4440', () => {
    const ds = pingDatagrams(5000, A, B)
    expect(ds.map((d) => d.bytes.length)).toEqual([1500, 1500, 1500, 588])
    expect(ds.map((d) => (((d.bytes[6] << 8) | d.bytes[7]) & 0x1fff) * 8)).toEqual([0, 1480, 2960, 4440])
    expect(ds.map((d) => (d.bytes[6] & 0x20) >> 5)).toEqual([1, 1, 1, 0])
    expect(ds[0].parts.map((p) => p.name)).toEqual(['IP', 'ICMP', 'Données'])
    expect(ds[1].parts.map((p) => p.name)).toEqual(['IP', 'Données'])
  })
})

describe('trame Ethernet', () => {
  it('CRC-32 IEEE : « 123456789 » ⇒ CBF43926', () => {
    expect(crc32(Array.from('123456789', (c) => c.charCodeAt(0)))).toBe(0xcbf43926)
  })
  it('préambule 7×55h, SFD D5h, bourrage à 46, FCS poids faible en premier', () => {
    const f = ethFrame(BROADCAST, [0, 1, 2, 3, 4, 5], 0x0806, new Uint8Array(28), 0x00)
    expect(hex(f.wire.subarray(0, 8))).toBe('55 55 55 55 55 55 55 d5')
    expect(f.padLen).toBe(18)
    const body = f.wire.subarray(8, f.wire.length - 4)
    const fcs = crc32(body)
    expect(Array.from(f.wire.subarray(f.wire.length - 4))).toEqual([fcs & 0xff, (fcs >>> 8) & 0xff, (fcs >>> 16) & 0xff, fcs >>> 24])
    // Propriété du CRC : sur trame + FCS, le reste vaut la constante 0xDEBB20E3 (inversé 0x2144DF1C)
    expect(crc32(f.wire.subarray(8))).toBe(0x2144df1c)
    expect(wiresharkBytes(f).length).toBe(14 + 28)
  })
  it('sérialisation poids faible en premier, Manchester IEEE', () => {
    expect(Array.from(serialize([0x55])).join('')).toBe('10101010')
    expect(Array.from(serialize([0xd5])).join('')).toBe('10101011')
    // 0 ⇒ haut puis bas (front descendant au milieu) ; 1 ⇒ bas puis haut
    expect(Array.from(manchester([0, 1])).join('')).toBe('1001')
  })
})

describe('durées sur le câble', () => {
  const { pcs, tsx } = salle(1)
  const req = (L: number) => pingFrames(0, L, pcs[0], tsx, 8, 1)
  it('ping -l 50 ⇒ 104 octets = 83,2 µs', () => {
    const [f] = req(50)
    expect(f.frame.wire.length).toBe(104)
    expect(durationUs(f.frame)).toBeCloseTo(83.2, 9)
    expect(pingLengthFromDuration(83.2)).toBe(50)
  })
  it('ping -l 5 ⇒ 13 octets de bourrage, trame de 72 octets = 57,6 µs', () => {
    const [f] = req(5)
    expect(f.frame.padLen).toBe(13)
    expect(f.frame.wire.length).toBe(72)
    expect(durationUs(f.frame)).toBeCloseTo(57.6, 9)
    expect(pingLengthFromDuration(57.6, 13)).toBe(5)
  })
  it('ping -l 5000 ⇒ 1526/1526/1526/614 octets, espace 9,6 µs, total 4182,4 µs', () => {
    const fs = req(5000)
    expect(fs.map((f) => f.frame.wire.length)).toEqual([1526, 1526, 1526, 614])
    expect(fs.map((f) => durationUs(f.frame))).toEqual([1220.8, 1220.8, 1220.8, 491.2].map((x) => expect.closeTo(x, 9)))
    const end = (i: number) => fs[i].t0 + durationUs(fs[i].frame) * 1e-6
    for (let i = 1; i < 4; i++) expect((fs[i].t0 - end(i - 1)) * 1e6).toBeCloseTo(9.6, 6)
    expect(end(3) * 1e6).toBeCloseTo(4182.4, 6)
  })
})

describe('signal sur le coax', () => {
  const f = timed(1e-3, ethFrame(BROADCAST, [0, 1, 2, 3, 4, 5], ETHERTYPE_IPV4, new Uint8Array(46)), 'test')
  const src = ethernetSource((a, b) => (b >= f.t0 && a <= f.t0 + 1e-3 ? [f] : []))
  it('niveaux : repos 0 V, haut −0,25 V, bas −1,75 V (I = 40 ± 30 mA dans 25 Ω)', () => {
    expect(LEVELS.haut).toBeCloseTo(-0.25, 12)
    expect(LEVELS.bas).toBeCloseTo(-1.75, 12)
    expect(src.value(0.5e-3)).toBe(0)
    // 1er bit du préambule = 1 ⇒ bas sur la 1re demi-période
    expect(src.value(f.t0 + 40e-9)).toBeCloseTo(LEVELS.bas, 12)
    expect(src.value(f.t0 + 90e-9)).toBeCloseTo(LEVELS.haut, 12)
  })
  it('fin de trame : maintien haut ≈ 200 ns puis retour à 0 V en ≈ 100 ns', () => {
    const end = f.t0 + f.halves.length * 50e-9
    expect(src.value(end + 150e-9)).toBeCloseTo(LEVELS.haut, 12)
    expect(src.value(end + 250e-9)).toBeCloseTo(LEVELS.haut / 2, 9)
    expect(src.value(end + 400e-9)).toBe(0)
  })
  it('déclenchement front descendant à −0,1 V : début du préambule', () => {
    expect(findTrigger(src, -0.1, 'descendant', 0, 2e-3)).toBeCloseTo(f.t0 + (0.1 / 1.75) * 25e-9, 12)
  })
  it('préambule = carré à 5 MHz (période 200 ns)', () => {
    const e = src.edges(f.t0 + 1e-6, f.t0 + 2e-6)
    const starts = e.filter((_, i) => i % 2 === 0)
    expect(starts[1] - starts[0]).toBeCloseTo(100e-9, 15)
  })
})

describe('trafic de la salle', () => {
  it('broadcasts de fond 2 à 5 par seconde, reproductibles ; ping : requête puis réponse après 0,5 à 2 ms', () => {
    const a = framesOfSecond(3, { kind: 'ping', L: 50 }, 10)
    expect(a).toEqual(framesOfSecond(3, { kind: 'ping', L: 50 }, 10))
    const bc = a.filter((f) => f.label.includes('broadcast'))
    expect(bc.length).toBeGreaterThanOrEqual(2)
    expect(bc.length).toBeLessThanOrEqual(5)
    const req = a.find((f) => f.label === 'ping requête')!
    const rep = a.find((f) => f.label === 'ping réponse')!
    const gap = rep.t0 - (req.t0 + durationUs(req.frame) * 1e-6)
    expect(gap).toBeGreaterThan(0.5e-3)
    expect(gap).toBeLessThan(2.1e-3)
    for (let i = 1; i < a.length; i++) expect(a[i].t0).toBeGreaterThan(a[i - 1].t0 + durationUs(a[i - 1].frame) * 1e-6)
  })
  it('bouchon retiré : écho Γ = +1 après 2d/v = 150 ns, trace déformée', () => {
    const ok = salleTraffic(5, { kind: 'ping', L: 50 }, true)
    const nb = salleTraffic(5, { kind: 'ping', L: 50 }, false)
    const req = ok.framesIn(7, 8).find((f) => f.label === 'ping requête')!
    const t = req.t0 + 2e-6
    expect(nb.source.value(t)).toBeCloseTo(ok.source.value(t) + ok.source.value(t - 150e-9), 12)
    expect(Math.min(...Array.from({ length: 200 }, (_, i) => nb.source.value(req.t0 + i * 10e-9)))).toBeLessThan(-2)
  })
})

describe('API du partiel', () => {
  it('createPingExercise / gradePing', () => {
    let short = 0
    for (let s = 1; s <= 300; s++) {
      const { L, expected } = createPingExercise(s)
      expect(L).toBeGreaterThanOrEqual(1)
      expect(L).toBeLessThanOrEqual(1472)
      if (L < 18) {
        short++
        expect(expected.paddingBytes).toBe(18 - L)
        expect(expected.frameBytesOnWire).toBe(72)
      } else expect(expected.frameBytesOnWire).toBe(L + 54)
      expect(expected.durationUs).toBeCloseTo(expected.frameBytesOnWire * 0.8, 9)
    }
    expect(short / 300).toBeGreaterThan(0.2)
    expect(short / 300).toBeLessThan(0.4)
    const { expected } = createPingExercise(9)
    expect(gradePing(expected, { ...expected, durationUs: expected.durationUs * 1.015 }).score).toBe(1)
    expect(gradePing(expected, { ...expected, L: expected.L + 1 }).score).toBe(0.8)
    expect(ETH10B2.tolDuree).toBe(0.02)
  })
})
