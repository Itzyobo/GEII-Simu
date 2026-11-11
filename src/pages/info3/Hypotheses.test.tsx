/** Page Hypothèses : chaque Hx de reference.ts y figure, avec le même état (test 12). */
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { INFO3, type Info3Hypothese } from '../../data/reference'
import { hypState } from '../../info3/ui/hypState'
import HypothesesPage from './Hypotheses'

describe('page /info3/hypotheses (test 12)', () => {
  it('chaque hypothèse avec son état (non vérifiée, partielle, vérifiée, réfutée) et sa vérification', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <HypothesesPage />
      </MemoryRouter>,
    )
    const hyps = INFO3.hypotheses as readonly Info3Hypothese[]
    expect(hyps.length).toBeGreaterThan(50)
    for (const h of hyps) {
      expect(html, h.id).toContain(`data-hyp="${h.id}" data-state="${hypState(h)}"`)
      expect(html, h.id).toContain(h.commentVerifier.replace(/’/g, '’').slice(0, 20))
    }
    expect(hypState({ id: 'X', texte: '', commentVerifier: '' })).toBe('non vérifiée')
    expect(html.match(/data-hyp="/g)).toHaveLength(hyps.length)
  })
})
