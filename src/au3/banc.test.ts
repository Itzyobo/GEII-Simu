import { describe, expect, it } from 'vitest'
import { MESSAGE_SOUS_TENSION, MESSAGE_VERIFIER, reduire, type Action, type EtatBanc } from './banc'
import { sessionNeuve } from './session'
import { MONTAGE_TP1, PRESET_TP1, signature, verifier } from './sim/cablage'

const T0 = 1_000
const etat = (): EtatBanc => ({ session: sessionNeuve('libre'), montage: 'tp1', verdict: null, message: null })
const suite = (e: EtatBanc, ...actions: Action[]) => actions.reduce((x, a, i) => reduire(x, a, T0 + i), e)

describe('câblage par bornes nommées', () => {
  it('10. « Faire vérifier » sur le préréglage TP1 → 6/6 liaisons correctes', () => {
    const v = verifier(PRESET_TP1, MONTAGE_TP1)
    expect(v.correctes.length).toBe(6)
    expect(v.total).toBe(6)
    expect(v.massesNonNoires).toEqual([])
  })

  it('10. une liaison manquante → 5/6, avec la liaison nommée', () => {
    const v = verifier(
      PRESET_TP1.filter((c) => c.id !== 'tp1-4'),
      MONTAGE_TP1,
    )
    expect(v.correctes.length).toBe(5)
    expect(v.manquantes.map((l) => l.nom)).toEqual([MONTAGE_TP1[3]!.nom])
    expect(v.manquantes[0]!.nom).toMatch(/voie verte de l’oscilloscope/)
  })

  it('toutes les masses sont équivalentes ; une masse non noire est signalée', () => {
    const autreMasse = PRESET_TP1.map((c) => (c.id === 'tp1-3' ? { ...c, b: 'plat.masse4' as const, couleur: '#d62828' } : c))
    const v = verifier(autreMasse, MONTAGE_TP1)
    expect(v.correctes.length).toBe(6)
    expect(v.massesNonNoires.map((c) => c.id)).toEqual(['tp1-3'])
  })

  it('la signature ne dépend ni de l’ordre ni du sens des câbles', () => {
    const inverse = [...PRESET_TP1].reverse().map((c) => ({ ...c, a: c.b, b: c.a }))
    expect(signature(inverse)).toBe(signature(PRESET_TP1))
  })
})

describe('établi : verrouillage sous tension et « Faire vérifier »', () => {
  const cable = { type: 'remplacer-cablage', cablage: PRESET_TP1 } as const

  it('10. interrupteur bloqué sans vérification', () => {
    const e = suite(etat(), cable, { type: 'interrupteur' })
    expect(e.session.platine.sousTension).toBe(false)
    expect(e.message).toBe(MESSAGE_VERIFIER)
  })

  it('vérification puis mise sous tension ; un câble modifié après vérification rebloque l’interrupteur', () => {
    const e = suite(etat(), cable, { type: 'faire-verifier' }, { type: 'interrupteur' })
    expect(e.session.platine.sousTension).toBe(true)
    expect(e.verdict?.correctes.length).toBe(6)
    expect(e.session.essaisVerification).toBe(1)
    const f = suite(etat(), cable, { type: 'faire-verifier' }, { type: 'retirer-cable', id: 'tp1-6' }, { type: 'interrupteur' })
    expect(f.session.platine.sousTension).toBe(false)
  })

  it('10. modifier un câble sous tension → refusé et événement journalisé', () => {
    const on = suite(etat(), cable, { type: 'faire-verifier' }, { type: 'interrupteur' })
    for (const a of [
      { type: 'retirer-cable', id: 'tp1-1' },
      { type: 'ajouter-cable', a: 'gbf.out', b: 'osc.v3', couleur: '#ffffff' },
      { type: 'couleur-cable', id: 'tp1-1', couleur: '#ffffff' },
      { type: 'composant', support: 'z1', z: { composants: ['R1'], montage: 'serie' } },
    ] as const) {
      const e = reduire(on, a, T0)
      expect(e.session.cablage).toEqual(on.session.cablage)
      expect(e.session.platine).toEqual(on.session.platine)
      expect(e.message).toBe(MESSAGE_SOUS_TENSION)
      expect(e.session.evenementsSousTension).toEqual([{ instant: T0, type: 'manip-sous-tension', detail: expect.any(String) }])
    }
  })

  it('les réglages restent libres sous tension ; Autoscale est journalisé comme faute', () => {
    const on = suite(etat(), cable, { type: 'faire-verifier' }, { type: 'interrupteur' }, { type: 'gbf', patch: { vpp: 3 } }, { type: 'autoscale' })
    expect(on.session.gbf.vpp).toBe(3)
    expect(on.session.evenementsSousTension).toEqual([])
    expect(on.session.fautes.map((f) => f.type)).toEqual(['autoscale'])
  })
})
