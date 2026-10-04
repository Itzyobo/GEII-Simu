import { describe, expect, it } from 'vitest'
import referenceSource from './reference.ts?raw'
import * as REF from './reference'
import { ATTENDUS, QUESTIONS, UNVERIFIED, UNVERIFIED_BY_MODE, type TpSlug } from './questions'

const OFFICIAL: Record<TpSlug, string[]> = {
  'alim-decoupage': [
    'Savoir câbler les platines hacheurs.',
    'Savoir câbler / mesurer / calculer un rendement d’une platine hacheur.',
    'Savoir régler / mesurer / retrouver le rapport cyclique, fréquence de fonctionnement sur les deux platines.',
    'Savoir différencier / régler un fonctionnement conduction continu / discontinu.',
    'Savoir mesurer / calculer l’inductance du primaire du transformateur.',
  ],
  'pas-a-pas': [
    'Savoir câbler les platines moteurs pas à pas.',
    'Savoir calculer la vitesse de rotation à partir d’une fréquence d’impulsion.',
    'Savoir mesurer une tension et courant dans un enroulement et expliquer le fonctionnement mode courant.',
    'Déterminer le mode courant et mode tension, trouver les fréquences correspondantes.',
    'Savoir différencier un mode demi pas d’un mode pas complet.',
    'Savoir expliquer l’inversion de sens de fonctionnement par des relevés.',
  ],
  'machine-asynchrone': [
    'Savoir câbler un couplage étoile ou triangle, identifier la tension aux bornes d’un enroulement.',
    'Savoir relever les informations d’une plaque signalétique, calculer un couple utile, calculer le nombre de paires de pôles.',
    'Savoir câbler une machine asynchrone sur le réseau ou à l’aide d’un variateur.',
    'Savoir mesurer puissances absorbées actives, réactives et apparentes, courant tension aux bornes d’une phase.',
    'Savoir mesurer / calculer un bilan de puissance et rendement.',
    'Savoir mesurer / calculer les pertes joules statoriques Pjs.',
    'Savoir exploiter les courbes Cu=f(N) et Cu = f(g).',
    'Montrer que la relation V/f est constante pour une alimentation par variateur de fréquence.',
  ],
}

const norm = (t: string) => t.replace(/[’']/g, "'")

describe('attendus officiels', () => {
  it('liste complète, mot pour mot, groupée par TP', () => {
    for (const tp of Object.keys(OFFICIAL) as TpSlug[])
      expect(ATTENDUS.filter((a) => a.tp === tp).map((a) => norm(a.text))).toEqual(OFFICIAL[tp].map(norm))
    expect(ATTENDUS).toHaveLength(19)
  })

  it('chaque lien pointe vers une question existante du même TP ; plus aucun attendu non couvert', () => {
    for (const a of ATTENDUS)
      for (const id of a.ids) expect(QUESTIONS[a.tp].some((q) => q.id === id), `${a.text} → ${id}`).toBe(true)
    expect(ATTENDUS.filter((a) => a.ids.length === 0)).toEqual([])
    const dcm = ATTENDUS.find((a) => a.text.includes('conduction continu / discontinu'))!
    expect(dcm.ids).toEqual(['alim2-dcm-mode', 'alim2-dcm-courant'])
  })

  it('chaque TP ou partie a une ligne « Câblage » notée comme une question', () => {
    expect(QUESTIONS['pas-a-pas'].map((q) => q.id)).toContain('pap-cablage')
    expect(QUESTIONS['alim-decoupage'].map((q) => q.id)).toEqual(expect.arrayContaining(['alim1-cablage', 'alim2-cablage']))
    expect(QUESTIONS['machine-asynchrone'].map((q) => q.id)).toContain('mas-cablage')
  })
})

describe('badge « valeur non vérifiée »', () => {
  const lines = referenceSource.split('\n')
  /** Commentaire de la constante (« GROUPE.nom » ou export de premier niveau) dans reference.ts. */
  const commentOf = (dep: string) => {
    const [group, name] = dep.split('.')
    if (!name) {
      expect((REF as unknown as Record<string, unknown>)[group], dep).toBeDefined()
      const k = lines.findIndex((l) => l.startsWith(`export const ${group}`))
      return lines.slice(Math.max(0, k - 4), k).join(' ')
    }
    expect((REF as unknown as Record<string, Record<string, unknown>>)[group]?.[name], dep).toBeDefined()
    const groupStart = lines.findIndex((l) => l.startsWith(`export const ${group} `))
    const k = lines.findIndex((l, i) => i > groupStart && l.trim().startsWith(`${name}:`))
    return lines[k - 1]
  }

  it('chaque constante citée (registre et dépendances par mode) existe et porte la mention « hypothèse »', () => {
    const all = [...Object.entries(UNVERIFIED), ...Object.values(UNVERIFIED_BY_MODE).flatMap((m) => Object.entries(m ?? {}))]
    for (const [id, deps] of all) {
      expect(Object.values(QUESTIONS).flat().some((q) => q.id === id), id).toBe(true)
      for (const dep of deps) expect(commentOf(dep), dep).toMatch(/hypothèse/)
    }
  })

  it('badges attendus : seuil de conduction discontinue, décrochage, table S1–S3 en 1/4 de pas', () => {
    expect(UNVERIFIED['alim2-dcm-mode']).toContain('FLYBACK.iDiscontinu')
    expect(UNVERIFIED['alim2-dcm-courant']).toContain('FLYBACK.iDiscontinu')
    expect(UNVERIFIED['pap-q6']).toContain('PAP.fDecrochage')
    expect(UNVERIFIED['pap-q7']).toContain('PAP.fDecrochage')
    expect(UNVERIFIED_BY_MODE.quart?.['pap-q10']).toEqual(['TB6600_MODES'])
    expect(UNVERIFIED_BY_MODE.quart?.['pap-q11']).toEqual(['TB6600_MODES'])
    expect(UNVERIFIED_BY_MODE.entier).toBeUndefined()
    // Uh n'entre dans aucune réponse attendue : U/f est demandé sur le fondamental (mode harmonique)
    expect(Object.values(UNVERIFIED).flat()).not.toContain('MAS.variateurUh')
  })
})
