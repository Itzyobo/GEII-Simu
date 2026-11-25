import { describe as group, expect, it } from 'vitest'
import { RES3 } from '../../data/reference'
import { generateCable, type Cable } from './coax'
import { benchSources, canPlug, checkMontage, describe, MONTAGE_322B, topology, type Connections, type GenSettings } from './benchTopology'

const cable50: Cable = { seed: 0, type: 'RG58', Zc: 50, l: 100, N: 127, D: 0.25 }
const cable75: Cable = { ...cable50, type: 'RG59', Zc: 75 }
const gen: GenSettings = { on: true, eg: 8, wave: { kind: 'pulse', width: RES3.largeur, period: RES3.periode } }
const tau = 100 / RES3.v
const W = RES3.largeur
/** Crête (signée) d'une source sur [t, t + 2W] */
const crest = (s: { value(t: number): number } | null, t: number, sign = 1) => {
  let m = 0
  for (let u = t; u < t + 2 * W; u += 0.5e-9) m = Math.max(m, sign * (s?.value(u) ?? 0))
  return sign * m
}
const src = (c: Connections, cable = cable50, potR = 100) => benchSources(topology(c), gen, cable, potR)
const END = (extra: Connections): Connections => ({ ...MONTAGE_322B, 'coax.B': 'tee2.a', ...extra })

group('configurations du fascicule', () => {
  it('3.2.2 b : générateur → cordon → Té sur CH1 → câble → extrémité ouverte', () => {
    const t = topology(MONTAGE_322B)
    expect(t).toMatchObject({ ok: true, genConnected: true, line: 'coax', cordToA: true, observe: ['A', 'none'] })
    expect(describe(t)).toBe('générateur → cordon → CH1 → câble long → extrémité ouverte')
    const [ch1] = src(MONTAGE_322B)
    expect(crest(ch1, 0)).toBeCloseTo(4, 3)
    expect(crest(ch1, 2 * tau)).toBeGreaterThan(2.5)
    expect(checkMontage(t, { kind: 'ligne', end: 'ouverte' }, 50)).toEqual([])
  })
  it('3.2.2 a : générateur à vide (cordon direct sur CH1) ⇒ Eg', () => {
    const c: Connections = { 'cordon.A': 'gen', 'cordon.B': 'ch1' }
    const t = topology(c)
    expect(t).toMatchObject({ ok: true, line: null, observe: ['A', 'none'] })
    expect(crest(src(c)[0], 0)).toBeCloseTo(8, 2)
    expect(checkMontage(t, { kind: 'vide' }, 50)).toEqual([])
    expect(checkMontage(topology(MONTAGE_322B), { kind: 'vide' }, 50)[0]).toMatch(/débranchez le câble long/)
  })
  it('Té posé sur un support au bout du câble : bouchon court-circuit, sans CH2', () => {
    const c = END({ tee2: 'park1', cc: 'tee2.b' })
    expect(topology(c).observe).toEqual(['A', 'none'])
    expect(checkMontage(topology(c), { kind: 'ligne', end: 'cc' }, 50)).toEqual([])
    expect(checkMontage(topology(END({ tee2: 'park2', b50: 'tee2.b' })), { kind: 'ligne', end: 'zc' }, 50)).toEqual([])
    expect(canPlug({}, 'b50', 'park1')).toBe(false)
  })
  it('3.2.2 c : court-circuit (bouchon CC sur un Té, ou potentiomètre à 0 Ω) ⇒ écho négatif', () => {
    expect(crest(src(END({ cc: 'tee2.b' }))[0], 2 * tau, -1)).toBeLessThan(-2.5)
    const pot = { ...MONTAGE_322B, 'coax.B': 'pot' } as Connections
    expect(crest(src(pot, cable50, 0)[0], 2 * tau, -1)).toBeLessThan(-2.5)
    expect(checkMontage(topology(pot), { kind: 'ligne', end: 'cc' }, 50)).toEqual([])
  })
  it('3.2.2 d : bouchon Zc ⇒ aucun écho ; Té au bout vers CH2 ⇒ CH2 voit l’impulsion à τ', () => {
    const c = END({ b50: 'tee2.b', tee2: 'ch2' })
    const t = topology(c)
    expect(t.observe).toEqual(['A', 'B'])
    const [ch1, ch2] = src(c)
    expect(Math.abs(crest(ch1, 2 * tau))).toBeLessThan(0.05)
    expect(crest(ch2, tau)).toBeGreaterThan(3.5)
    expect(checkMontage(t, { kind: 'ligne', end: 'zc+ch2' }, 50)).toEqual([])
    expect(checkMontage(t, { kind: 'ligne', end: 'zc' }, 50)).toEqual(['CH2 au bout du câble : retirez-le pour cette étape'])
  })
})

group('erreurs de montage : conséquence physique réelle', () => {
  it('pas de Té, câble long branché directement sur CH1 : CH1 ne voit que le bout du câble', () => {
    const c: Connections = { 'coax.A': 'gen', 'coax.B': 'ch1' }
    expect(topology(c).observe[0]).toBe('B')
    const [ch1] = src(c)
    expect(Math.abs(crest(ch1, 0))).toBeLessThan(0.01)
    expect(crest(ch1, tau)).toBeGreaterThan(7)
    expect(checkMontage(topology(c), { kind: 'ligne', end: 'ouverte' }, 50)[0]).toMatch(/Té sur CH1/)
  })
  it('générateur non relié : trace plate', () => {
    const c: Connections = { tee1: 'ch1', 'coax.A': 'tee1.b' }
    const t = topology(c)
    expect(t.genConnected).toBe(false)
    expect(crest(src(c)[0], 0)).toBe(0)
    expect(src(c)[1]).toBeNull()
  })
  it('bouchon sur le Té sans câble : Eg/2', () => {
    const c: Connections = { 'cordon.A': 'gen', tee1: 'ch1', 'cordon.B': 'tee1.a', b50: 'tee1.b' }
    expect(crest(src(c)[0], 0)).toBeCloseTo(4, 2)
  })
  it('bouchon 50 Ω sur un câble 75 Ω : petit écho inversé', () => {
    const e = crest(src(END({ b50: 'tee2.b' }), cable75)[0], 2 * tau, -1)
    expect(e).toBeLessThan(-0.3)
    expect(e).toBeGreaterThan(-1.2)
  })
  it('CH2 au bout sans bouchon : ligne ouverte (1 MΩ)', () => {
    const c = { ...MONTAGE_322B, 'coax.B': 'ch2' } as Connections
    const [ch1, ch2] = src(c)
    expect(crest(ch1, 2 * tau)).toBeGreaterThan(2.5)
    expect(crest(ch2, tau)).toBeGreaterThan(7)
  })
  it('bouchon sur la sortie du générateur : le cordon n’est plus transparent', () => {
    expect(topology({ ...MONTAGE_322B, tee2: 'gen', 'cordon.A': 'tee2.a', b50: 'tee2.b' }).cordToA).toBe(false)
  })
})

group('topologies refusées, sans exception', () => {
  it('deux câbles en série', () => {
    const t = topology({ 'coax.A': 'gen', 'coax.B': 'tee2.a', 'cordon.A': 'tee2.b', 'cordon.B': 'ch1' })
    expect(t.ok).toBe(false)
    expect(t.error).toMatch(/série/)
  })
  it('montage en étoile : deux câbles depuis le même Té', () => {
    const t = topology({ tee1: 'gen', 'cordon.A': 'tee1.a', 'coax.A': 'tee1.b', 'cordon.B': 'ch1' })
    expect(t.ok).toBe(false)
    expect(t.error).toMatch(/étoile/)
  })
  it('boucle : les deux bouts du câble au même point', () => {
    const t = topology({ tee1: 'ch1', 'coax.A': 'tee1.a', 'coax.B': 'tee1.b', 'cordon.A': 'gen' })
    expect(t.ok).toBe(false)
    expect(t.error).toMatch(/boucle/)
    expect(benchSources(t, gen, cable50, 0)[0]?.value(0)).toBe(0)
  })
  it('canPlug : embase occupée, Té dans lui-même ou en boucle de Té', () => {
    expect(canPlug({ 'cordon.A': 'gen' }, 'coax.A', 'gen')).toBe(false)
    expect(canPlug({}, 'tee1', 'tee1.a')).toBe(false)
    expect(canPlug({ tee2: 'tee1.a' }, 'tee1', 'tee2.b')).toBe(false)
    expect(canPlug({}, 'tee1', 'ch1')).toBe(true)
  })
  it('aucun montage : rien sur les BNC', () => {
    expect(src({})).toEqual([null, null])
    expect(topology({}).genConnected).toBe(false)
  })
  it('câble mystère quelconque : sources définies', () => {
    expect(src(MONTAGE_322B, generateCable(5))[0]).not.toBeNull()
  })
})
