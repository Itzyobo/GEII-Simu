import { describe, expect, it } from 'vitest'
import coursSrc from './cours.ts?raw'
import coursPage from '../pages/Cours.tsx?raw'
import partielPage from '../pages/Partiel.tsx?raw'
import { REF } from './reference'
import { COURS, corrigerCours } from './cours'
import { points } from '../models/answers'

const q = (id: string) => COURS.find((c) => c.id === id)!

describe('quiz de cours', () => {
  it('bonnes réponses calculées depuis reference.ts : 15 m, 1 200 m, 32 charges, 120 Ω, ± 200 mV', () => {
    expect(q('c-long-rs232').bonne).toBe(REF.rs232Longueur.value)
    expect(q('c-long-rs232').bonne).toBe(15)
    expect(q('c-long-rs485').bonne).toBe(1200)
    expect(q('c-charges').bonne).toBe(32)
    expect(q('c-terminaison-valeur').bonne).toBe(120)
    expect(q('c-seuil').bonne).toBe(200)
    expect(points(corrigerCours(q('c-long-rs485'), '1200'))).toBe(1)
    expect(points(corrigerCours(q('c-long-rs485'), '15'))).toBe(0)
  })
  it('QCM : la bonne réponse est une des options ; chaque correction cite sa justification', () => {
    for (const c of COURS) {
      if (c.options) expect(c.options, c.id).toContain(c.bonne)
      expect(corrigerCours(c, '').message, c.id).toContain(c.justification)
    }
  })
  it('aucune valeur du cours écrite en dur dans le quiz ni dans ses pages', () => {
    // Nombre isolé (pas une classe Tailwind comme « w-32 », pas un identifiant)
    for (const [f, src] of Object.entries({ 'cours.ts': coursSrc, 'Cours.tsx': coursPage, 'Partiel.tsx': partielPage }))
      expect(src.match(/(?<![\w.-])(15|1 ?200|32|120|2 ?500)(?![\w.])/g), f).toBeNull()
  })
})
