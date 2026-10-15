import { describe, expect, it } from 'vitest'
import { REF } from '../data/reference'
import { toHex } from './crc'
import { busSimulate, frameDuration, lireLigne, parcoursComplet, rs485Lines, type BusFrame, type Emetteur } from './bus'
import { scopeView, valueAt, type ProbeInput, type ScopeSettings } from './scope'
import { analyzerDecode, crcOk, slaveRespond } from './slaves'

const I = REF.parcoursIntervalle.value
const near = (x: number, target: number, tol: number) => expect(Math.abs(x / target - 1)).toBeLessThanOrEqual(tol)
const maitre = (o: Partial<Emetteur> = {}): Emetteur => ({ card: 'c1', connected: true, parcours: parcoursComplet(0), memorized: [], memStart: 0, ...o })
const PARCOURS = busSimulate([maitre()], 0, 256 * I)
const requetes = PARCOURS.filter((f) => f.type === 'MAITRE')
const reponses = PARCOURS.filter((f) => f.type === 'ESCLAVE')

describe('parcours réseau', () => {
  it('exactement 256 requêtes [adr] 07 [CRC] de 00 à FF', () => {
    expect(requetes).toHaveLength(256)
    requetes.forEach((f, adr) => {
      expect(f.bytes.slice(0, 2)).toEqual([adr, 7])
      expect(f.crcOk).toBe(true)
    })
    expect(requetes.slice(0, 6).map((f) => toHex(f.bytes))).toEqual([toHex(requetes[0]!.bytes), '01 07 41 E2', '02 07 41 12', '03 07 40 82', '04 07 42 B2', '05 07 43 22'])
    expect(requetes[0]!.bytes.slice(0, 2)).toEqual([0, 7])
  })
  it('exactement 4 esclaves répondent, avec les exceptions du CR ; adresse 00 → aucune réponse', () => {
    expect(reponses.map((f) => toHex(f.bytes))).toEqual(['17 87 01 63 F4', '1E 87 01 B3 F6', '23 87 03 A3 FB', '29 87 01 02 38'])
    expect(PARCOURS.filter((f) => f.t0 >= 0 && f.t0 < I).map((f) => f.type)).toEqual(['MAITRE'])
    expect(crcOk(slaveRespond('TDS', [0x1e, 7, 0, 0])!)).toBe(true)
  })
  it('durées à 38 400 bauds en 8E1 : requête 1,146 ms, exception 1,432 ms, parcours 51,6 s (± 1 %)', () => {
    near(frameDuration(4), 1.146e-3, 0.01)
    near(requetes[1]!.t1 - requetes[1]!.t0, 1.146e-3, 0.01)
    near(reponses[0]!.t1 - reponses[0]!.t0, 1.432e-3, 0.01)
    near(requetes.at(-1)!.t0 + I - requetes[0]!.t0, 51.6, 0.01)
  })
})

describe('signaux RS485', () => {
  const slot = (adr: number, frames: BusFrame[] = PARCOURS, opts = {}) => rs485Lines(frames, 'c1', adr * I, (adr + 1) * I, opts)
  it('TX_EN à 1 sans interruption du start du 1er octet au stop du 4e, à 0 en dehors (H33)', () => {
    const { txen } = slot(0x17)
    const req = requetes[0x17]!
    const t0 = req.t0 - 0x17 * I
    const t1 = req.t1 - 0x17 * I
    for (let t = t0; t < t1; t += 1e-6) expect(valueAt(txen, t)).toBe(REF.ttlHigh.value)
    for (const t of [t0 - REF.txEnAvance.value - 1e-6, t1 + REF.txEnRetard.value + 1e-6, t1 + 4e-3, I / 2]) expect(valueAt(txen, t)).toBe(REF.ttlLow.value)
    // pendant la réponse de l'esclave, la carte n'émet pas
    expect(valueAt(txen, reponses[0]!.t0 - 0x17 * I + 1e-4)).toBe(REF.ttlLow.value)
  })
  it('haute impédance polarisée (H9) : TX+ 2,65 V, TX− 2,35 V, Math = +0,30 V ± 2 %', () => {
    const { txp, txm } = rs485Lines([], 'c1', 0, I)
    for (const t of [0, I / 3, I / 2]) {
      near(valueAt(txp, t), 2.65, 0.02)
      near(valueAt(txm, t), 2.35, 0.02)
      near(valueAt(txp, t) - valueAt(txm, t), 0.3, 0.02)
    }
  })
  it('polarisation : le récepteur ne décode aucun caractère pendant les silences ; sans elle, des parasites', () => {
    const lus = (polarisation: boolean) => lireLigne(slot(0x17, PARCOURS, { polarisation }), 3)
    const attendu = [...requetes[0x17]!.bytes, ...reponses[0]!.bytes]
    expect(lus(true).map((r) => r.byte)).toEqual(attendu)
    expect(lus(true).some((r) => r.framingError || r.parityError)).toBe(false)
    expect(lus(false).length).toBeGreaterThan(attendu.length + 10)
    expect(rs485Lines([], 'c1', 0, I, { polarisation: false }).txp.samples.map((s) => s.v)).toEqual([REF.rs485SansPolarisation.value])
  })

  const capture = (math = true): ScopeSettings => ({
    ch: [
      { on: true, vdiv: REF.captureVoltDiv.value, offset: 0, probe: REF.captureProbe.value },
      { on: true, vdiv: REF.captureVoltDiv.value, offset: 0, probe: REF.captureProbe.value },
    ],
    tdiv: REF.captureTimeDiv.value,
    position: 4 * REF.captureTimeDiv.value,
    trigger: { source: 0, slope: 'rising', level: REF.captureTriggerLevel.value },
    mode: 'normal',
    math: { on: math, src1: 0, src2: 1, vdiv: REF.captureMathVoltDiv.value, offset: REF.captureMathOffset.value },
    cursors: { on: false, x1: 0, x2: 0, y1: 0, y2: 0 },
  })
  const view = (parasite: boolean) => {
    const l = slot(5, PARCOURS, { parasite })
    const inp: [ProbeInput, ProbeInput] = [
      { signal: l.txp, probe: 10, ground: true },
      { signal: l.txm, probe: 10, ground: true },
    ]
    return scopeView(inp, capture(), { seed: 7, phase: 0 }).measures
  }
  it('Math pendant une émission = 2 × amplitude d’une voie (± 2 %)', () => {
    const l = slot(5)
    const req = requetes[5]!
    const vals = (w: typeof l.txp) => Array.from({ length: 44 }, (_, k) => valueAt(w, req.t0 - 5 * I + (k + 0.5) / REF.modbusBaud.value))
    const p = vals(l.txp)
    const m = vals(l.txm)
    const math = p.map((v, k) => v - m[k]!)
    near(Math.max(...math) - Math.min(...math), 2 * (Math.max(...p) - Math.min(...p)), 0.02)
    const [c1, , mth] = view(false)
    near(mth!.pkpk, 2 * c1!.pkpk, 0.02)
  })
  it('parasite de mode commun : chaque voie change, Math varie de moins de 2 %', () => {
    const [a1, a2, am] = view(false)
    const [b1, b2, bm] = view(true)
    expect(Math.abs(b1!.pkpk - a1!.pkpk)).toBeGreaterThan(0.5)
    expect(Math.abs(b2!.pkpk - a2!.pkpk)).toBeGreaterThan(0.5)
    near(bm!.pkpk, am!.pkpk, 0.02)
  })
})

describe('erreurs de manip', () => {
  it('deux maîtres simultanés → 0 réponse valide, CRC faux signalé par l’analyseur', () => {
    const f = busSimulate([maitre(), maitre({ card: 'c2', parcours: parcoursComplet(REF.deuxMaitresDecalage.value) })], 0, 256 * I)
    expect(f.filter((x) => x.type === 'ESCLAVE' && x.crcOk)).toHaveLength(0)
    const collisions = f.filter((x) => x.collision)
    expect(collisions.length).toBeGreaterThan(200)
    expect(collisions.some((x) => analyzerDecode(x.bytes).some((l) => l.startsWith('CRC faux')))).toBe(true)
  })
  it('conflit de drivers (H39) : bits opposés → |différentiel| < 200 mV ; bits lus déterministes à graine fixée', () => {
    const deux = () => busSimulate([maitre(), maitre({ card: 'c2', parcours: parcoursComplet(REF.deuxMaitresDecalage.value) })], 0x17 * I, 0x18 * I)
    const f = deux()
    const c = f.find((x) => x.collision)!
    expect(c.parts).toHaveLength(2)
    const { txp, txm } = rs485Lines(f, 'c1', 0x17 * I, 0x18 * I)
    const diffs = txp.samples.map((s) => valueAt(txp, s.t) - valueAt(txm, s.t))
    // Paliers de conflit, proches de 0 V, à côté des 1 et 0 francs (± 3 V)
    expect(diffs.some((d) => Math.abs(d) < 0.2)).toBe(true)
    expect(diffs.some((d) => d > 2)).toBe(true)
    expect(deux().find((x) => x.collision)!.bytes).toEqual(c.bytes)
  })
  it('trame mémorisée non supprimée + parcours → les deux flux mêlés', () => {
    const memo = [0x17, 0x06, 0x00, 0x64, 0x00, 0x5a, 0x4a, 0xd8]
    const f = busSimulate([maitre({ memorized: [memo] })], 0, 10 * I)
    const fns = f.filter((x) => x.type === 'MAITRE').map((x) => x.bytes[1])
    expect(fns).toContain(7)
    expect(fns).toContain(6)
    expect(f.some((x) => x.collision)).toBe(false)
    expect(f.filter((x) => toHex(x.bytes) === toHex(memo)).length).toBeGreaterThanOrEqual(2)
  })
  it('carte non branchée au pupitre : aucune réponse', () => {
    expect(busSimulate([maitre({ connected: false })], 0, 256 * I).filter((x) => x.type === 'ESCLAVE')).toHaveLength(0)
  })
})

describe('analyzerDecode', () => {
  it('17 87 01 63 F4 → adresse 17H, fonction en erreur 07H, code 01H', () => {
    expect(analyzerDecode([0x17, 0x87, 0x01, 0x63, 0xf4])).toEqual([
      'Trame type ESCLAVE : 17 87 01 63 F4',
      'Réponse d’exception',
      'adresse esclave : 17H',
      'fonction en erreur : 07H',
      'code exception : 01H -> Code fonction inconnu',
    ])
  })
  it('23 87 03 A3 FB → code 03H', () => {
    expect(analyzerDecode([0x23, 0x87, 0x03, 0xa3, 0xfb])).toContain('code exception : 03H -> Valeur de donnée incorrecte')
  })
  it('CRC faux signalé', () => {
    expect(analyzerDecode([0x17, 0x87, 0x01, 0x63, 0xf5])[1]).toMatch(/^CRC faux/)
  })
})
