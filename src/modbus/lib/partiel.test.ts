import { describe, expect, it } from 'vitest'
import { REF } from '../data/reference'
import { genererSujet, noter, pointsCablage, tempsRestant } from './partiel'
import { initialState, load, reduce, save, type Action, type State } from './store'

const debut = (graine = 7, manip = true): Action => ({ type: 'partielDebut', graine, duree: REF.partielDuree.value, manip, maintenant: 1_000_000 })
const run = (...a: Action[]) => a.reduce(reduce, initialState())
const BRANCHE: Action[] = [
  { type: 'activity', activity: 'reseau' },
  { type: 'db9', card: 'c1', on: true },
  { type: 'db9', card: 'c2', on: true },
  { type: 'probe', ch: 'ch1', tip: 'c1.TX+' },
  { type: 'ground', ch: 'ch1', card: 'c1' },
]

describe('sujet', () => {
  it('même graine → même sujet ; graines différentes → sujets différents', () => {
    const a = genererSujet(123)
    const b = genererSujet(123)
    expect(b.trame).toEqual(a.trame)
    expect(b.echange).toEqual(a.echange)
    expect(b.cours.map((c) => c.id)).toEqual(a.cours.map((c) => c.id))
    expect(b.exercice).toEqual(a.exercice)
    expect(b.items.map((i) => i.id)).toEqual(a.items.map((i) => i.id))
    const autres = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((g) => JSON.stringify([genererSujet(g).trame.bytes, genererSujet(g).echange.reponse])))
    expect(autres.size).toBeGreaterThan(1)
  })
  it('contenu : message codé, trame à écrire, réponse à interpréter, 3 questions de cours (impédance, longueur, RS232/RS485)', () => {
    for (let g = 1; g <= 50; g++) {
      const s = genererSujet(g)
      expect(s.items.filter((i) => i.bloc === 'message')).toHaveLength(4)
      expect(s.items.filter((i) => i.bloc === 'trame')).toHaveLength(1)
      expect(s.items.filter((i) => i.bloc === 'reponse')).toHaveLength(3)
      expect(s.cours.map((c) => c.theme)).toEqual(['impedance', 'longueur', 'rs'])
      // Jamais le registre 2 (vitesse, H14) dans une trame à écrire
      expect(s.trame.bytes.slice(2, 4)).not.toEqual([0, 2])
    }
  })
})

describe('notation', () => {
  it('fin de partiel : chaque question non traitée apparaît avec sa correction ; la note par attendu somme à la note globale', () => {
    const sujet = genererSujet(42, true)
    const juste = sujet.items.find((i) => i.id === 't-trame')!.correction.split(' (')[0]!
    const note = noter(sujet, { 't-trame': juste, 'm-bits': String(sujet.exercice.liaison.dataBits) }, { cablageEssai: 2, penalites: 1 })
    const nonTraitees = note.details.filter((d) => !d.traite)
    expect(nonTraitees.length).toBe(sujet.items.length - 2)
    for (const d of nonTraitees) {
      expect(d.points).toBe(0)
      expect(d.item.correction.length).toBeGreaterThan(3)
    }
    expect(note.lignes.reduce((s, l) => s + l.points, 0)).toBeCloseTo(note.total, 9)
    expect(note.lignes.reduce((s, l) => s + l.max, 0)).toBeCloseTo(note.max, 9)
    // 2 questions justes, câblage au 2e essai (½), 1 pénalité (−½)
    expect(note.total).toBeCloseTo(2 + 0.5 - REF.partielBareme.value.penalite, 9)
  })
  it('CRC faux dans la trame à écrire : moitié des points', () => {
    const sujet = genererSujet(5)
    const juste = sujet.items.find((i) => i.id === 't-trame')!.correction.split(' (')[0]!
    const faux = `${juste.slice(0, -5)} 00 00`
    expect(noter(sujet, { 't-trame': faux }, { cablageEssai: null, penalites: 0 }).total).toBe(0.5)
  })
})

describe('câblage noté et pénalités (store)', () => {
  const verifier: Action = { type: 'verify' }
  it('1er essai réussi → 100 % ; réussite au 2e → 50 % ; au 3e → 0', () => {
    const p1 = run(debut(), ...BRANCHE, verifier).partiel!
    expect(pointsCablage(p1.cablageEssai) / REF.partielBareme.value.cablage).toBe(1)
    const p2 = run(debut(), verifier, ...BRANCHE, verifier, verifier).partiel!
    expect([p2.cablageEssai, pointsCablage(p2.cablageEssai) / REF.partielBareme.value.cablage]).toEqual([2, 0.5])
    const p3 = run(debut(), verifier, verifier, ...BRANCHE, verifier).partiel!
    expect([p3.cablageEssai, pointsCablage(p3.cablageEssai)]).toEqual([3, 0])
  })
  it('1 débranchement pendant une émission → barème appliqué une fois et incident enregistré', () => {
    const s = run(debut(), ...BRANCHE, { type: 'parcours', card: 'c1', on: true, wall: 0 }, { type: 'db9', card: 'c1', on: false })
    expect(s.wiring.db9.c1).toBe(true)
    expect(s.incidents).toHaveLength(1)
    expect(s.partiel!.penalites).toBe(1)
    const note = noter(genererSujet(7, true), {}, s.partiel!)
    expect(note.lignes.find((l) => l.id === 'manip')!.points).toBe(-REF.partielBareme.value.penalite)
  })
  it('mode partiel : pas de ×10, pas de démonstration ; le rendu rétablit l’entraînement', () => {
    let s = run(debut(), { type: 'speed', speed: 10 }, { type: 'reglage', patch: { polarisation: false } })
    expect(s.sim.speed).toBe(1)
    expect(s.reglages.polarisation).toBe(true)
    s = reduce(s, { type: 'partielRendre', maintenant: 2_000_000 })
    expect(s.session.mode).toBe('entrainement')
    expect(s.partiel!.rendu).toBe(true)
  })
})

describe('persistance', () => {
  it('store sérialisé en plein partiel puis rechargé → mêmes réponses ; temps restant = durée − (maintenant − début) à 1 s près', () => {
    const mem = new Map<string, string>()
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
    const s = run(debut(9), { type: 'partielReponse', id: 'm-message', value: 'Ab3' }, { type: 'partielReponse', id: 't-trame', value: '17 06' })
    save(s, storage)
    const r: State = load(storage)
    expect(r.partiel).toEqual(s.partiel)
    expect(r.session.mode).toBe('examen')
    const now = r.partiel!.debut + 125_400
    expect(Math.abs(tempsRestant(r.partiel!, now) - (REF.partielDuree.value - 125.4))).toBeLessThan(1)
  })
})
