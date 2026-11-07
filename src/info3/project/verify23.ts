/**
 * « Faire vérifier » des TP2 et TP3 : broches et noms (comme au TP1), IOC, Timer2 et carte Rotary.
 * Exigences cumulées au fil des questions ; broches et réglages attendus tirés de INFO3 (jamais écrits ici).
 */
import { INFO3 } from '../../data/reference'
import { iocOf, type IocEdge } from '../mcc/config'
import { label } from '../mcc/timers'
import type { Project, SlotId } from './project'
import { generateErrors, pinsErrors, type ExpectedPin } from './verify'

export const TP2_ORDER = ['tp2-1-1', 'tp2-1-2', 'tp2-2-1', 'tp2-2-2', 'tp2-2-3', 'tp2-2-4'] as const
export const TP3_ORDER = ['tp3-1', 'tp3-2', 'tp3-3'] as const
export type Tp2QuestionId = (typeof TP2_ORDER)[number]
export type Tp3QuestionId = (typeof TP3_ORDER)[number]
export type Tp23QuestionId = Tp2QuestionId | Tp3QuestionId

const P = INFO3.tp1.namePrefix
const R = INFO3.pins.rotary
const [S1, S2] = INFO3.pins.buttons
const SLOT_NAME: Record<SlotId, string> = { mikrobus1: 'mikroBUS 1 (MODULE 1)', mikrobus2: 'mikroBUS 2 (MODULE 2)' }

const leds = (): ExpectedPin[] => INFO3.pins.leds.map((l) => ({ name: `${P.led}${l.name}`, pin: l.pin, direction: 'output' }))
const btn = (b: (typeof INFO3.pins.buttons)[number]): ExpectedPin => ({ name: `${P.button}${b.name}`, pin: b.pin, direction: 'input' })
const encoder = (): ExpectedPin[] => [
  { name: 'ENCA', pin: R.ENCA, direction: 'input' },
  { name: 'ENCB', pin: R.ENCB, direction: 'input' },
]

function iocErrors(p: Project, pin: string, name: string, edge: IocEdge): string[] {
  const x = p.mcc.pins.find((q) => q.pin === pin)
  if (!x) return []
  const got = iocOf(x)
  return got === edge ? [] : [`${name} (${pin}) : IOC « ${edge} » attendue dans Pin Module, « ${got} » configurée`]
}

/** Carte Rotary : sur le mikroBUS prévu (2), sinon ENCA / ENCB n'arrivent pas sur RD1 / RA2 */
export function rotaryErrors(p: Project): string[] {
  const card = INFO3.clickBoards.rotary
  const slot = (Object.keys(p.bench.slots) as SlotId[]).find((s) => p.bench.slots[s] === 'rotary')
  if (!slot) return [`Carte ${card.name} absente : l’enficher sur le ${SLOT_NAME[card.expectedSlot as SlotId]}`]
  if (slot !== card.expectedSlot) return [`Carte ${card.name} sur le ${SLOT_NAME[slot]} : ENCA et ENCB n’arrivent pas sur ${R.ENCA} et ${R.ENCB}, l’enficher sur le ${SLOT_NAME[card.expectedSlot as SlotId]}`]
  return []
}

export function verifyTp2(p: Project, q: Tp2QuestionId): string[] {
  const idx = TP2_ORDER.indexOf(q)
  const at = (id: Tp2QuestionId) => idx >= TP2_ORDER.indexOf(id)
  const expected = [...leds(), btn(S1), btn(S2), ...(at('tp2-2-1') ? encoder() : [])]
  const errors = pinsErrors(p, expected)
  errors.push(...iocErrors(p, S1.pin, `${P.button}${S1.name}`, 'negative'), ...iocErrors(p, S2.pin, `${P.button}${S2.name}`, 'negative'))
  if (at('tp2-2-3')) errors.push(...iocErrors(p, R.ENCB, 'ENCB', 'any'))
  if (at('tp2-2-1')) errors.push(...rotaryErrors(p))
  return [...errors, ...generateErrors(p)]
}

export function verifyTp3(p: Project, q: Tp3QuestionId): string[] {
  const two = TP3_ORDER.indexOf(q) >= TP3_ORDER.indexOf('tp3-2')
  const errors = pinsErrors(p, [...leds(), ...(two ? [btn(S1), btn(S2)] : [])])
  const t = p.mcc.timers?.TMR2
  if (!t) errors.push('TMR2 absent : l’ajouter depuis Device Resources (Timer › TMR2)')
  else {
    if (!t.enabled) errors.push('TMR2 : cocher « Enable Timer »')
    if (!t.interrupt) errors.push('TMR2 : cocher « Enable Timer Interrupt » (Software Settings)')
    if (two) {
      errors.push(...iocErrors(p, S1.pin, `${P.button}${S1.name}`, 'negative'))
      const start = 'Starts on falling edge on {ers}'
      if (t.controlMode !== 'Monostable') errors.push(`TMR2 : Control Mode « Monostable » attendu, « ${t.controlMode} » configuré`)
      else if (t.startOption !== start) errors.push(`TMR2 : Start/Reset Option « ${label(start, 'TMR2')} » attendue, « ${label(t.startOption, 'TMR2')} » configurée`)
      if (t.ersPin !== S2.pin) errors.push(`TMR2 T2IN : ${S2.pin} attendue dans le Grid View (ligne TMR2 T2IN), ${t.ersPin ?? 'aucune broche'} choisie`)
    }
  }
  return [...errors, ...generateErrors(p)]
}

export const verifyTp23 = (p: Project, q: Tp23QuestionId): string[] => (q.startsWith('tp2') ? verifyTp2(p, q as Tp2QuestionId) : verifyTp3(p, q as Tp3QuestionId))

export function runVerifyTp23(p: Project, q: Tp23QuestionId): { project: Project; errors: string[] } {
  const errors = verifyTp23(p, q)
  return { project: errors.length ? p : { ...p, verified: true }, errors }
}
