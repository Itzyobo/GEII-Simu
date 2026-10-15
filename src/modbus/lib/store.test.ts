import { describe, expect, it } from 'vitest'
import { initialState, load, reduce, save, STORAGE_KEY, type Action } from './store'

const run = (...actions: Action[]) => actions.reduce(reduce, initialState())
const WIRED: Action[] = [
  { type: 'probe', ch: 'ch1', tip: 'c1.TXD_TTL' },
  { type: 'ground', ch: 'ch1', card: 'c1' },
  { type: 'flow', card: 'c1', on: true },
]

describe('verrouillage « bus actif »', () => {
  it('émission refusée sans « Faire vérifier »', () => {
    const s = run(...WIRED, { type: 'startEmission' })
    expect(s.bus.active).toBe(false)
    expect(s.notice).toMatch(/vérifier/)
  })
  it('émission refusée si la vérification a trouvé des erreurs', () => {
    const s = run({ type: 'probe', ch: 'ch1', tip: 'c1.TXD_TTL' }, { type: 'verify' }, { type: 'startEmission' })
    expect(s.check?.errors.length).toBeGreaterThan(0)
    expect(s.bus.active).toBe(false)
  })
  it('émission active : retirer une sonde ou un DB9 est refusé et crée un incident', () => {
    let s = run(...WIRED, { type: 'db9', card: 'c1', on: true }, { type: 'verify' }, { type: 'startEmission' })
    expect(s.bus.active).toBe(true)
    s = reduce(s, { type: 'probe', ch: 'ch1', tip: null })
    expect(s.wiring.probes.ch1.tip).toBe('c1.TXD_TTL')
    s = reduce(s, { type: 'db9', card: 'c1', on: false })
    expect(s.wiring.db9.c1).toBe(true)
    expect(s.incidents.map((i) => i.kind)).toEqual(['retrait-sonde', 'retrait-db9'])
  })
  it('modifier le câblage annule la vérification ; les essais sont comptés', () => {
    const s = run(...WIRED, { type: 'verify' }, { type: 'probe', ch: 'ch2', tip: 'c1.TX_EN' }, { type: 'verify' })
    expect(s.verifyAttempts.serie1).toBe(2)
    expect(reduce(s, { type: 'probe', ch: 'ch2', tip: null }).check).toBeNull()
  })
})

describe('persistance', () => {
  it('aller-retour, et stockage indisponible sans plantage', () => {
    const mem = new Map<string, string>()
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
    const s = run(...WIRED)
    save(s, storage)
    expect(mem.has(STORAGE_KEY)).toBe(true)
    expect(load(storage)).toEqual(s)
    const fail = () => {
      throw new Error('bloqué')
    }
    expect(() => save(s, { getItem: fail, setItem: fail })).not.toThrow()
    expect(load({ getItem: fail, setItem: fail })).toEqual(initialState())
  })
})

describe('partie A', () => {
  it('graine de SERIE_2 fixée pour la session ; changement de programme refusé pendant une émission', () => {
    let s = run({ type: 'activity', activity: 'serie2' }, { type: 'serie2Graine', graine: 1 }, { type: 'serie2Graine', graine: 2 })
    expect(s.serie2.graine).toBe(1)
    s = [...WIRED, { type: 'verify' } as Action, { type: 'startEmission' } as Action, { type: 'activity', activity: 'serie3' } as Action].reduce(reduce, s)
    expect(s.bus.active).toBe(true)
    expect(s.session.activity).toBe('serie2')
  })
  it('2.4 : câble requis, mais un câble droit passe la vérification (erreur à constater dans RealTerm)', () => {
    const base: Action[] = [{ type: 'activity', activity: 'realterm' }, { type: 'flow', card: 'c1', on: true }, { type: 'flow', card: 'c2', on: true }]
    expect(run(...base, { type: 'verify' }).check?.ok).toBe(false)
    expect(run(...base, { type: 'serialCable', cable: 'droit' }, { type: 'verify' }).check?.ok).toBe(true)
  })
})
