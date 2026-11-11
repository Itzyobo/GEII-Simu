/** Mode examen : aucun élément Diagnostic ni infobulle d'aide dans le DOM (test 9). */
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { INFO3 } from '../../data/reference'
import { drawSubject, startSession } from '../../info3/exam/exam'
import { blankProject } from '../../info3/project/project'
import { ExamRunning } from './Examen'

describe('épreuve en cours (test 9)', () => {
  for (const variant of ['mcc', 'registres'] as const) {
    it(`${variant} : ni Diagnostic, ni infobulle d’aide (texte d’hypothèse), badges sans explication`, () => {
      const s = startSession(drawSubject(2, 3, variant), blankProject('examen', 'Examen', 'examen'), Date.now())
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <ExamRunning session={s} onChange={() => {}} />
        </MemoryRouter>,
      )
      expect(html).toContain('Faire vérifier')
      expect(html).toContain('role="timer"')
      expect(html).not.toMatch(/Diagnostic/i)
      for (const h of INFO3.hypotheses) expect(html, h.id).not.toContain(h.texte.slice(0, 40))
      if (variant === 'registres') expect(html).not.toContain('Project Resources')
    })
  }
})
