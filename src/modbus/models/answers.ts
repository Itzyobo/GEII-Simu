/** Lecture et correction des réponses saisies (débit, tensions, bits, parité, texte). */
import { REF, type Parity } from '../data/reference'

export const PIEGE_BASE_DE_TEMPS = 'C’est la base de temps de l’écran, pas la durée d’un bit.'

const TIME: Record<string, number> = { s: 1, ms: 1e-3, µs: 1e-6, us: 1e-6, μs: 1e-6, ns: 1e-9 }
const RATE: Record<string, number> = { '': 1, k: 1e3 }

/** « 2 400 », « 2,4 kbauds », « 416,7 µs », « 0.42 ms », « 1200 bit/s » → valeur SI et nature. */
export function parseQuantite(text: string): { value: number; kind: 'time' | 'rate' } | null {
  const m = text
    .trim()
    .replace(/[\s  ]/g, '')
    .replace(',', '.')
    .match(/^([0-9]*\.?[0-9]+(?:e-?[0-9]+)?)([a-zµμ/]*)$/i)
  if (!m) return null
  const n = Number(m[1])
  const unit = (m[2] ?? '').toLowerCase()
  if (unit in TIME) return { value: n * TIME[unit]!, kind: 'time' }
  const r = unit.match(/^(k?)(bauds?|bd|bits?\/s|bps|b\/s)?$/)
  if (r && Number.isFinite(n)) return { value: n * RATE[r[1] ?? '']!, kind: 'rate' }
  return null
}

const near = (a: number, b: number, tol: number) => Math.abs(a / b - 1) <= tol

export interface Verdict {
  ok: boolean
  message: string
}

/**
 * Débit répondu, en bauds ou en durée de bit. Si la réponse est la base de temps de l'écran (ou son inverse),
 * on le dit explicitement (H30).
 */
export function checkDebit(text: string, baud: number, tdiv: number): Verdict {
  const q = parseQuantite(text)
  if (!q) return { ok: false, message: 'Réponse illisible : donnez un débit (ex. 9600 bauds) ou une durée de bit (ex. 104 µs).' }
  const tol = REF.toleranceBaseDeTemps.value
  if ((q.kind === 'time' && near(q.value, tdiv, tol)) || (q.kind === 'rate' && near(q.value * tdiv, 1, tol))) return { ok: false, message: PIEGE_BASE_DE_TEMPS }
  const debit = q.kind === 'time' ? 1 / q.value : q.value
  if (near(debit, baud, REF.toleranceDebit.value)) return { ok: true, message: `Juste : ${baud} bauds, soit ${(1e6 / baud).toFixed(1).replace('.', ',')} µs par bit.` }
  return { ok: false, message: `Faux : ${Math.round(debit)} bauds. Mesurez la durée d’un bit (le plus court palier), puis D = 1 / T_bit.` }
}

export function checkTension(text: string, attendu: number): Verdict {
  const v = Number(text.trim().replace(/[\s ]/g, '').replace(',', '.').replace(/v$/i, '').replace('−', '-'))
  if (!Number.isFinite(v) || text.trim() === '') return { ok: false, message: 'Réponse illisible : donnez une tension en volts.' }
  const ok = Math.abs(v - attendu) <= Math.abs(attendu) * REF.toleranceTension.value
  return { ok, message: ok ? 'Juste.' : 'Faux.' }
}

/** Ne garde que les 0 et 1 : « 0·10101010·1·1 » → « 01010101011 ». */
export const bitsOf = (text: string) => text.replace(/[^01]/g, '')

export function checkBits(text: string, attendu: string): Verdict {
  const ok = bitsOf(text) === bitsOf(attendu)
  return { ok, message: ok ? 'Juste.' : `Faux : ${attendu}.` }
}

export function parseParite(text: string): Parity | null {
  const t = text.trim().toLowerCase()
  if (/^(aucune|sans|non|none|n|pas de parité)$/.test(t)) return 'none'
  if (/^(paire|even|e)$/.test(t)) return 'even'
  if (/^(impaire|odd|o)$/.test(t)) return 'odd'
  return null
}

export const PARITE_LABEL: Record<Parity, string> = { none: 'aucune', even: 'paire', odd: 'impaire' }

/** Comparaison exacte (espaces comprises) ou après normalisation pour les champs à choix. */
export function checkExact(text: string, attendu: string, normalize = (s: string) => s.trim().toLowerCase()): Verdict {
  const ok = normalize(text) === normalize(attendu)
  return { ok, message: ok ? 'Juste.' : `Faux : ${attendu}.` }
}
