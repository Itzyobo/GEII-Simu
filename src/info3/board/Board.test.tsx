/** Banc dessiné d'après curiosity_hpc_banc_info3.svg : l'état de la simulation se lit sur le dessin. */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { INFO3 } from '../../data/reference'
import Board, { type BoardProps } from './Board'

const noop = () => {}
const props = (p: Partial<BoardProps> = {}): BoardProps => ({
  duty: {},
  bench: { usbBlack: true, usbWhite: false, slots: { mikrobus1: 'matrix8x8', mikrobus2: 'rotary' }, cover: false, lockAttempts: 0 },
  onButton: noop,
  onUsbBlack: noop,
  onUsbWhite: noop,
  onCard: noop,
  message: null,
  ...p,
})
const count = (html: string, s: string) => html.split(s).length - 1

describe('Board (banc INFO3)', () => {
  it('LED D2 à D5, LED RGB, matrice 8x8 et anneau ROTARY suivent la simulation', () => {
    const lit = Array.from({ length: 64 }, (_, i) => (i < 8 ? 1 : 0))
    const ring = Array.from({ length: 16 }, (_, i) => (i === 0 ? 1 : 0))
    const html = renderToStaticMarkup(<Board {...props({ duty: { D2: 1, D4: 1, [INFO3.rgb.signals.r]: 1 }, matrix: lit, ring })} />)
    expect(count(html, 'class="info3-led" data-on="1"')).toBe(2)
    expect(count(html, 'class="info3-mx-led" data-on="1"')).toBe(8)
    expect(count(html, 'class="info3-ring-led" data-on="1"')).toBe(1)
    expect(html).toContain('aria-label="LED RGB (R 100 %, G 0 %, B 0 %)')
    expect(html).toContain('ROTARY O click')
  })

  it('cartes retirées et USB débranchés : emplacements vides, ni carte ni câble', () => {
    const html = renderToStaticMarkup(<Board {...props({ bench: { usbBlack: false, usbWhite: false, slots: { mikrobus1: null, mikrobus2: null }, cover: false, lockAttempts: 0 } })} />)
    expect(html).toContain('aria-label="MODULE 1 : vide"')
    expect(html).not.toContain('info3-mx-led')
    expect(html).not.toContain('Molette ROTARY')
    expect(html).not.toContain('stroke="#1c1f22"')
  })

  it('carte enfichée sur le mauvais emplacement : dessinée sur cet emplacement', () => {
    const html = renderToStaticMarkup(<Board {...props({ bench: { usbBlack: false, usbWhite: false, slots: { mikrobus1: 'rotary', mikrobus2: null }, cover: false, lockAttempts: 0 }, onRotary: noop })} />)
    expect(html).toContain('transform="translate(0 -225)"')
    expect(html).toContain('Molette ROTARY')
  })
})
