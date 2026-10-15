import { describe, expect, it } from 'vitest'
import enonce from '../../../docs/modbus/enonce.md?raw'
import prd from '../../../PRD — Simulateur TP2 Liaison série MODBUS.md?raw'
import { HYPOTHESES, REF } from './reference'
import { ATTENDUS } from './attendus'
import { listeHypotheses } from './prd'
import { coverage, hasUnverified, QUESTIONS, type Question } from './questions'

describe('reference.ts', () => {
  it('toute entrée « hypothèse » a un numéro H', () => {
    for (const [k, r] of Object.entries(REF)) if (r.source === 'hypothèse') expect(r.hyp, k).toMatch(/^H\d+$/)
  })
  it('H2 et H5 ne sont plus des hypothèses (source CR)', () => {
    const resolved = Object.values(REF).filter((r) => r.hyp === 'H2' || r.hyp === 'H5')
    expect(resolved.length).toBeGreaterThan(0)
    for (const r of resolved) expect(r.source).toBe('CR')
  })
})

describe('badge « valeur non vérifiée »', () => {
  it('dépendance hypothèse → true, sinon false', () => {
    expect(hasUnverified({ deps: ['serie1StopBits'] })).toBe(true)
    expect(hasUnverified({ deps: ['serie1Baud', 'esclaves'] })).toBe(false)
  })
})

describe('accueil : couverture des attendus', () => {
  it('chaque attendu est relié à une question implémentée, sinon « non couvert »', () => {
    for (const a of ATTENDUS) {
      const c = coverage(a.id)
      expect(c.covered).toBe(c.linked.some((q) => q.statut === 'implémentée'))
    }
    const fake: Question[] = [{ ...QUESTIONS[0]!, attendus: ['debit'], statut: 'implémentée' }]
    expect(coverage('debit', fake).covered).toBe(true)
    expect(coverage('longueur', fake).covered).toBe(false)
  })
  it('les questions ne citent que des attendus existants', () => {
    const ids = new Set<string>(ATTENDUS.map((a) => a.id))
    for (const q of QUESTIONS) for (const a of q.attendus) expect(ids.has(a), q.id).toBe(true)
  })
})

describe('énoncé', () => {
  it('chaque intitulé de questions.ts apparaît mot pour mot dans docs/modbus/enonce.md', () => {
    const texte = enonce.replace(/\*+/g, '')
    expect(texte).not.toContain('[à transcrire]')
    for (const q of QUESTIONS) expect(texte.includes(q.intitule), q.id).toBe(true)
  })
})

describe('sources', () => {
  it('« cours » est réservé aux normes publiées (Modbus, EIA-485, RS232)', () => {
    const NORMES = [
      ...['modbusSilence', 'modbusEsclaveMax', 'modbusMotMax', 'modbusMotsParRequete', 'modbusBitsParRequete', 'crcPolynome', 'crcInit'],
      ...['rs485Seuil', 'rs485Longueur', 'rs485DebitLongueurMax', 'rs485Charges', 'rs485Liaison', 'terminaisonOhms', 'polarisationRole', 'propagation'],
      ...['rs232Longueur', 'rs232Capacite', 'rs232Liaison'],
    ]
    const cours = Object.entries(REF).filter(([, r]) => r.source === 'cours').map(([k]) => k)
    expect(cours.filter((k) => !NORMES.includes(k))).toEqual([])
  })
})

describe('finitions', () => {
  it('accueil : plus aucun attendu « non couvert »', () => {
    expect(ATTENDUS.filter((a) => !coverage(a.id).covered).map((a) => a.text)).toEqual([])
  })
  it('PRD §3 synchronisé avec reference.ts (H1 à la dernière)', () => {
    const lignes = prd.split(/\r?\n/).filter((l) => /^\d+\. H\d+ — /.test(l))
    expect(lignes).toEqual(listeHypotheses(HYPOTHESES))
    const numeros = Object.keys(HYPOTHESES).map((h) => Number(h.slice(1)))
    expect(numeros.sort((a, b) => a - b)).toEqual(Array.from({ length: numeros.length }, (_, k) => k + 1))
  })
})
