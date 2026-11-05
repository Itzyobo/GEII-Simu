/**
 * « Faire vérifier » du TP1 : contrôle la configuration MCC (noms exacts, broches, sens, Analog) et
 * la cohérence de l'horloge, avant la première mise sous tension.
 * Les exigences s'accumulent au fil des questions : LED_D2 dès 3.1, BP_S1 dès 3.4, LED_D3 à D5 dès 3.5,
 * BP_S2 pour §4. Les broches attendues viennent de INFO3.pins (jamais écrites ici).
 */
import { INFO3 } from '../../data/reference'
import type { PinConfig } from '../mcc/config'
import { clockCheck, isGenerateStale, type Project } from './project'

export interface ExpectedPin {
  name: string
  pin: string
  direction: 'input' | 'output'
}

/** Ordre des questions du TP1 (clés = ancres de l'énoncé) */
export const TP1_ORDER = ['tp1-3-1', 'tp1-3-2', 'tp1-3-3', 'tp1-3-4', 'tp1-3-5', 'tp1-3-6', 'tp1-3-7', 'tp1-4-1', 'tp1-4-2', 'tp1-4-3'] as const
export type Tp1QuestionId = (typeof TP1_ORDER)[number]

const P = INFO3.tp1.namePrefix
const led = (name: string) => INFO3.pins.leds.find((l) => l.name === name)!
const button = (name: string) => INFO3.pins.buttons.find((b) => b.name === name)!

/** Broches exigées à partir de chaque question (cumulatif) */
function requirementsFrom(): { from: Tp1QuestionId; pins: () => ExpectedPin[] }[] {
  return [
    { from: 'tp1-3-1', pins: () => [{ name: `${P.led}D2`, pin: led('D2').pin, direction: 'output' }] },
    { from: 'tp1-3-4', pins: () => [{ name: `${P.button}S1`, pin: button('S1').pin, direction: 'input' }] },
    { from: 'tp1-3-5', pins: () => ['D3', 'D4', 'D5'].map((d) => ({ name: `${P.led}${d}`, pin: led(d).pin, direction: 'output' as const })) },
    { from: 'tp1-4-1', pins: () => [{ name: `${P.button}S2`, pin: button('S2').pin, direction: 'input' }] },
  ]
}

export function expectedPins(question: Tp1QuestionId): ExpectedPin[] {
  const idx = TP1_ORDER.indexOf(question)
  return requirementsFrom()
    .filter((r) => TP1_ORDER.indexOf(r.from) <= idx)
    .flatMap((r) => r.pins())
}

const fmtHz = (hz: number) => `${hz} Hz`

/** Liste des erreurs de configuration (vide = validé) */
export function verifyTp1(p: Project, question: Tp1QuestionId): string[] {
  const errors: string[] = []
  const pins = p.mcc.pins
  for (const exp of expectedPins(question)) {
    const exact = pins.find((x) => x.customName === exp.name)
    const nearMiss = pins.find((x) => x.customName !== exp.name && x.customName.toUpperCase() === exp.name.toUpperCase())
    if (!exact) {
      if (nearMiss) errors.push(`Nom « ${nearMiss.customName} » sur ${nearMiss.pin} : le nom exact attendu est « ${exp.name} » (majuscules comprises)`)
      else errors.push(`${exp.name} absente : attendue sur ${exp.pin} en ${exp.direction === 'output' ? 'sortie' : 'entrée'}`)
      continue
    }
    errors.push(...pinErrors(exact, exp))
  }
  if (!p.generated) errors.push('Generate n’a pas été fait : les fichiers MCC n’existent pas')
  else {
    const { xtal, fosc } = clockCheck(p)
    if (isGenerateStale(p)) errors.push('La configuration MCC a changé depuis le dernier Generate')
    else if (xtal === null) errors.push('_XTAL_FREQ absent de mcc.h')
    else if (xtal !== fosc) errors.push(`_XTAL_FREQ (${fmtHz(xtal)}) différent du Fosc configuré dans le System Module (${fmtHz(fosc)})`)
  }
  return errors
}

function pinErrors(x: PinConfig, exp: ExpectedPin): string[] {
  const out: string[] = []
  if (x.pin !== exp.pin) out.push(`${exp.name} est sur ${x.pin} : ${exp.direction === 'output' ? 'attendue' : 'attendu'} sur ${exp.pin}`)
  if (x.direction !== exp.direction) out.push(`${exp.name} (${x.pin}) doit être en ${exp.direction === 'output' ? 'sortie' : 'entrée'}`)
  else if (exp.direction === 'input' && x.analog) out.push(`${exp.name} (${x.pin}) est en Analog : décocher Analog pour une entrée numérique (sinon la broche est lue à 0)`)
  return out
}

/** Applique « Faire vérifier » : renvoie le projet (verified = true si aucune erreur) et les erreurs */
export function runVerify(p: Project, question: Tp1QuestionId): { project: Project; errors: string[] } {
  const errors = verifyTp1(p, question)
  return { project: errors.length ? p : { ...p, verified: true }, errors }
}
