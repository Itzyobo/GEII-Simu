import { afterEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { REF } from '../data/reference'
import { genererSujet } from '../lib/partiel'
import { initialState, reduce, setState, type Action, type State } from '../lib/store'
import { PIEGE_BASE_DE_TEMPS } from '../models/answers'
import { Parcours } from '../components/ServeurModbus'
import Banc from './Banc'
import PagePartiel from './Partiel'
import Cours from './Cours'
import Exercices from './Exercices'
import Questions from './Questions'
import { COURS } from '../data/cours'

const BANC_B: Action[] = [
  { type: 'activity', activity: 'reseau' },
  { type: 'db9', card: 'c1', on: true },
  { type: 'db9', card: 'c2', on: true },
  { type: 'parcours', card: 'c1', on: true, wall: 0 },
  { type: 'parcours', card: 'c2', on: true, wall: 0 },
]
const etat = (partiel: boolean): State => {
  const debut: Action[] = partiel ? [{ type: 'partielDebut', graine: 3, duree: REF.partielDuree.value, manip: true, maintenant: Date.now() }] : []
  return [...debut, ...BANC_B].reduce(reduce, initialState())
}
const rendre = (s: State, el: React.ReactElement) => {
  setState(s)
  return renderToStaticMarkup(<MemoryRouter>{el}</MemoryRouter>)
}
afterEach(() => setState(initialState()))

describe('rendu en mode partiel', () => {
  it('banc : ni annotations, ni parasite, ni démonstrations de cours (présents en entraînement)', () => {
    const libelles = ['Annotations', 'Parasite de mode commun', 'Polarisation absente', 'Terminaison absente']
    const entrainement = rendre(etat(false), <Banc />)
    for (const l of libelles) expect(entrainement).toContain(l)
    const partiel = rendre(etat(true), <Banc />)
    for (const l of libelles) expect(partiel).not.toContain(l)
  })
  it('parcours réseau : aucun bouton ×10, aucune note sur les collisions', () => {
    expect(rendre(etat(false), <Parcours card="c1" onClose={() => {}} />)).toContain('Accélérer ×10')
    const html = rendre(etat(true), <Parcours card="c1" onClose={() => {}} />)
    expect(html).not.toContain('Accélérer ×10')
    expect(html).not.toContain('collisions')
  })
  it('page du partiel : aucun message de piège ni correction avant le rendu, badges conservés', () => {
    const s = etat(true)
    const sujet = genererSujet(s.partiel!.graine, true)
    const tdivUs = `${sujet.exercice.tdiv * 1e6} µs`
    const avecPiege = reduce(s, { type: 'partielReponse', id: 'm-debit', value: tdivUs })
    const html = rendre(avecPiege, <PagePartiel />)
    expect(html).not.toContain(PIEGE_BASE_DE_TEMPS)
    expect(html).not.toContain('Correction :')
    expect(html).toContain('Rendre')
    // Après le rendu, le piège et la correction apparaissent
    const rendu = rendre(reduce(avecPiege, { type: 'partielRendre', maintenant: Date.now() }), <PagePartiel />)
    expect(rendu).toContain('Correction :')
    expect(rendu).toContain(PIEGE_BASE_DE_TEMPS)
  })
})

describe('pages d’entraînement : correction hors partiel, masquée pendant un partiel', () => {
  const q = COURS.find((c) => c.id === 'c-hz')!
  const avecReponse = (s: State) => reduce(s, { type: 'answer', key: `${q.id}.r`, value: q.bonne as string, points: 1 })
  const BANDEAU = 'Partiel en cours'
  it('Cours : justification affichée hors partiel ; bandeau et lien vers le partiel pendant', () => {
    const hors = rendre(avecReponse(etat(false)), <Cours />)
    expect(hors).toContain(q.justification.slice(0, 40))
    expect(hors).not.toContain(BANDEAU)
    const pendant = rendre(avecReponse(etat(true)), <Cours />)
    expect(pendant).not.toContain(q.justification.slice(0, 40))
    expect(pendant).toContain(BANDEAU)
    expect(pendant).toContain('href="/modbus/partiel"')
  })
  it('Questions : formulaires de correction hors partiel ; masqués pendant', () => {
    const hors = rendre(etat(false), <Questions />)
    expect(hors).toContain('Corriger')
    expect(hors).not.toContain(BANDEAU)
    const pendant = rendre(etat(true), <Questions />)
    expect(pendant).not.toContain('Corriger')
    expect(pendant).toContain(BANDEAU)
    expect(pendant).toContain('href="/modbus/partiel"')
  })
  it('Message codé : pas de bandeau hors partiel ; bandeau et lien vers le partiel pendant', () => {
    expect(rendre(etat(false), <Exercices />)).not.toContain(BANDEAU)
    const pendant = rendre(etat(true), <Exercices />)
    expect(pendant).toContain(BANDEAU)
    expect(pendant).toContain('href="/modbus/partiel"')
  })
})
