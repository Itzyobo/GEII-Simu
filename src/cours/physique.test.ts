import { describe, expect, it } from 'vitest'
import {
  bilanMas,
  coupleMas,
  equilibrePas,
  flyback,
  flybackAt,
  hacheurPhase,
  harmoniques,
  induction,
  masVf,
  MU0,
  mli,
  nSync,
  pasParTour,
  phasesPas,
  pleineOnde,
  pointMas,
  reluctance,
  remplissageCourant,
  type ModePas,
} from './physique'

describe('circuits magnétiques', () => {
  const c = { n: 200, i: 0.1, l: 0.2, s: 4e-4, mur: 2000, e: 1e-3, bsat: 1.5 }
  it('loin de la saturation, B = n·i / (R·S)', () => {
    expect(induction(c)).toBeCloseTo((c.n * c.i) / (reluctance(c) * c.s), 3)
  })
  it('l’entrefer impose la réluctance', () => {
    expect(c.e / (MU0 * c.s) / reluctance(c)).toBeGreaterThan(0.9)
  })
  it('B plafonne à Bsat', () => {
    expect(induction({ ...c, i: 100 })).toBeLessThan(1.5)
    expect(induction({ ...c, i: 100 })).toBeGreaterThan(1.4)
  })
})

describe('flyback', () => {
  const p = { e: 24, alpha: 0.4, m: 0.5, l1: 200e-6, f: 50e3, r: 10 }
  const moyI2 = (q: typeof p) => {
    const pt = flyback(q)
    let s = 0
    for (let k = 0; k < 4000; k++) s += flybackAt(q, pt, (k + 0.5) / 4000 / q.f).i2
    return s / 4000
  }
  it('charge forte : conduction continue, Vs = m·α·E/(1−α)', () => {
    const pt = flyback(p)
    expect(pt.continu).toBe(true)
    expect(pt.vs).toBeCloseTo(8, 6)
    expect(moyI2(p)).toBeCloseTo(pt.is, 2)
  })
  it('charge faible : démagnétisation totale, toute l’énergie ½·L1·Î² passe', () => {
    const q = { ...p, r: 1000 }
    const pt = flyback(q)
    expect(pt.continu).toBe(false)
    expect(pt.t2).toBeLessThan((1 - q.alpha) / q.f)
    expect(0.5 * q.l1 * pt.i1max ** 2 * q.f).toBeCloseTo(pt.vs ** 2 / q.r, 6)
    expect(moyI2(q)).toBeCloseTo(pt.is, 3)
  })
})

describe('moteur pas à pas', () => {
  const positions = (nr: number, mode: ModePas, n: number) => {
    const out = [equilibrePas(nr, ...phasesPas(mode, 0), 0)]
    for (let k = 1; k < n; k++) out.push(equilibrePas(nr, ...phasesPas(mode, k), out[k - 1]))
    return out.map((x) => Math.round(x))
  }
  it('hybride 6 dents : 30° par pas entier, 15° en demi-pas', () => {
    expect(positions(6, 'une-phase', 5)).toEqual([0, 30, 60, 90, 120])
    expect(positions(6, 'deux-phases', 3)).toEqual([15, 45, 75])
    expect(positions(6, 'demi-pas', 5)).toEqual([0, 15, 30, 45, 60])
  })
  it('aimant à une paire de pôles : 90° par pas, le rotor suit le champ', () => {
    expect(positions(2, 'une-phase', 4)).toEqual([0, -90, -180, -270])
  })
  it('Np = ns·nr/|nr − ns|', () => {
    expect(pasParTour(40, 50)).toBe(200)
    expect(pasParTour(4, 6)).toBe(12)
  })
  it('pont en H : rampe U/L puis régulation entre les seuils', () => {
    const h = { u: 50, l: 0.022, ih: 3, il: 2.4, tp: 3.8e-3 }
    const s = hacheurPhase(h, 2e-6)
    const k = s.inst.indexOf(3)
    expect(k * 2e-6).toBeCloseTo((h.l * h.ih) / h.u, 4)
    expect(Math.max(...s.ia)).toBeCloseTo(3, 6)
    expect(Math.min(...s.ia)).toBeCloseTo(-3, 6)
  })
  it('le courant n’a plus le temps de s’établir quand fh monte', () => {
    expect(remplissageCourant(10, 24, 2, 5e-3, 2)).toBeGreaterThan(0.99)
    expect(remplissageCourant(20000, 24, 2, 5e-3, 2)).toBeLessThan(0.15)
  })
})

describe('machines tournantes et onduleur', () => {
  const m = { f: 50, p: 2, cmax: 100, gm: 0.2 }
  it('Kloss : Cmax à gm, nul à Ns, négatif au-delà', () => {
    expect(coupleMas(m, nSync(50, 2) * (1 - 0.2))).toBeCloseTo(100, 6)
    expect(coupleMas(m, 1500)).toBe(0)
    expect(coupleMas(m, 1550)).toBeLessThan(0)
  })
  it('point de fonctionnement et décrochage', () => {
    const pt = pointMas(m, () => 40)!
    expect(coupleMas(m, pt.n)).toBeCloseTo(40, 3)
    expect(pointMas(m, () => 120)).toBeNull()
  })
  it('V/f constant : même écart de vitesse au couple maximal', () => {
    const m25 = masVf(m, 25)
    expect(coupleMas(m25, 750 - 0.2 * 1500)).toBeCloseTo(100, 6)
  })
  it('bilan : Pjr = g·Ptr et Pa = somme des pertes + Pu', () => {
    const b = bilanMas({ c: 50, n: 1425, ns: 1500, pjs: 300, pfs: 200, pm: 100 })
    expect(b.pjr).toBeCloseTo(0.05 * b.ptr, 6)
    expect(b.pa).toBeCloseTo(b.pu + b.pjs + b.pfs + b.pjr + b.pm, 6)
  })
  it('pleine onde : fondamental 4E/π, harmonique 3 au tiers', () => {
    const h = harmoniques((t) => pleineOnde(t, 1, 50), 50, 3)
    expect(h[0]).toBeCloseTo(4 / Math.PI, 2)
    expect(h[2]).toBeCloseTo(4 / Math.PI / 3, 2)
  })
  it('MLI : fondamental ma·E, basses fréquences quasi nulles', () => {
    const h = harmoniques((t) => mli(t, 1, 50, 2000, 0.8), 50, 7)
    expect(h[0]).toBeCloseTo(0.8, 1)
    expect(Math.max(...h.slice(1))).toBeLessThan(0.05)
  })
})
