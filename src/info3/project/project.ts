/**
 * Projet MPLAB X simulé : fichiers de l'étudiant, configuration MCC, fichiers générés, banc (USB, cartes).
 * Fonctions pures : chaque action renvoie un nouveau projet et, le cas échéant, un message.
 */
import { INFO3 } from '../../data/reference'
import { configErrors, defaultMccConfig, parseMccConfig, systemFosc, type MccConfig } from '../mcc/config'
import { generate, MAIN_TEMPLATE, XTAL_FILE, xtalOf } from '../mcc/generator'

export type ProjectKind = 'tp1' | 'libre'
export type SlotId = 'mikrobus1' | 'mikrobus2'
export type CardId = keyof typeof INFO3.clickBoards

export interface Bench {
  usbBlack: boolean
  usbWhite: boolean
  slots: Record<SlotId, CardId | null>
  /** Cache posé sur la LED RGB */
  cover: boolean
  /** Manipulations de cartes tentées sous tension (pénalité d'examen, étape 7) */
  lockAttempts: number
}

export interface Project {
  version: 1
  id: string
  name: string
  kind: ProjectKind
  /** Fichiers de l'étudiant (main.c, autres .c et .h) */
  files: Record<string, string>
  /** Sortie du dernier Generate (mcc_generated_files/…), null avant le premier */
  generated: Record<string, string> | null
  /** Configuration au moment du dernier Generate (détection d'un Generate oublié) */
  generatedFrom: string | null
  mcc: MccConfig
  bench: Bench
  /** « Faire vérifier » validé dans ce projet */
  verified: boolean
}

export const PROJECT_VERSION = 1 as const
export const LOCK_MESSAGE = 'Débrancher l’USB avant de manipuler une carte'

export const blankBench = (): Bench => ({ usbBlack: false, usbWhite: false, slots: { mikrobus1: null, mikrobus2: null }, cover: false, lockAttempts: 0 })

export function blankProject(kind: ProjectKind, name: string, id = `${kind}-${Date.now().toString(36)}`): Project {
  return { version: PROJECT_VERSION, id, name, kind, files: {}, generated: null, generatedFrom: null, mcc: defaultMccConfig(), bench: blankBench(), verified: false }
}

/** Fichiers à compiler : main.c d'abord, puis les autres fichiers de l'étudiant, puis les fichiers générés */
export function projectFiles(p: Project): Record<string, string> {
  const out: Record<string, string> = {}
  if ('main.c' in p.files) out['main.c'] = p.files['main.c']
  for (const [k, v] of Object.entries(p.files)) if (k !== 'main.c') out[k] = v
  return { ...out, ...(p.generated ?? {}) }
}

export type Result = { project: Project; ok: boolean; message?: string }

/** Generate : réécrit les fichiers MCC ; crée main.c au premier Generate seulement */
export function runGenerate(p: Project): Result {
  const errors = configErrors(p.mcc)
  if (errors.length) return { project: p, ok: false, message: `Generate refusé : ${errors.join(' ; ')}` }
  const files = 'main.c' in p.files ? p.files : { 'main.c': MAIN_TEMPLATE, ...p.files }
  return { project: { ...p, files, generated: generate(p.mcc), generatedFrom: JSON.stringify(p.mcc) }, ok: true, message: 'Generation complete.' }
}

export const isGenerateStale = (p: Project) => p.generated !== null && p.generatedFrom !== JSON.stringify(p.mcc)

/** _XTAL_FREQ du device_config.h généré et Fosc du System Module */
export function clockCheck(p: Project): { xtal: number | null; fosc: number } {
  return { xtal: xtalOf(p.generated?.[XTAL_FILE]), fosc: systemFosc(p.mcc.system) }
}

/* ───────────── Banc : USB et cartes Click ───────────── */

export function setUsbBlack(p: Project, plugged: boolean): Result {
  if (plugged && p.kind !== 'libre' && !p.verified) return { project: p, ok: false, message: 'Faire vérifier avant la première mise sous tension' }
  return { project: { ...p, bench: { ...p.bench, usbBlack: plugged } }, ok: true }
}

export function setUsbWhite(p: Project, plugged: boolean): Result {
  return { project: { ...p, bench: { ...p.bench, usbWhite: plugged } }, ok: true }
}

/** Enficher (card) ou retirer (null) une carte : refusé sous tension, tentative comptée */
export function setCard(p: Project, slot: SlotId, card: CardId | null): Result {
  if (p.bench.usbBlack) return { project: { ...p, bench: { ...p.bench, lockAttempts: p.bench.lockAttempts + 1 } }, ok: false, message: LOCK_MESSAGE }
  const slots = { ...p.bench.slots }
  if (card) for (const s of Object.keys(slots) as SlotId[]) if (slots[s] === card) slots[s] = null
  slots[slot] = card
  return { project: { ...p, bench: { ...p.bench, slots } }, ok: true }
}

/** Conditions de « Make and Program Device » (le Build est vérifié à part) */
export function programCheck(p: Project): string | null {
  if (!p.bench.usbBlack) return 'Programmation impossible : brancher l’USB noir (PKOB), la carte n’est pas alimentée'
  if (p.kind !== 'libre' && !p.verified) return 'Programmation bloquée : faire vérifier la configuration avant la première mise sous tension'
  return null
}

/* ───────────── Validation (persistance, import JSON) ───────────── */

const isStrRecord = (x: unknown): x is Record<string, string> => !!x && typeof x === 'object' && !Array.isArray(x) && Object.values(x).every((v) => typeof v === 'string')

export function parseProject(x: unknown): Project | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  if (o.version !== PROJECT_VERSION || typeof o.id !== 'string' || typeof o.name !== 'string') return null
  if (o.kind !== 'tp1' && o.kind !== 'libre') return null
  if (!isStrRecord(o.files)) return null
  if (o.generated !== null && !isStrRecord(o.generated)) return null
  const mcc = parseMccConfig(o.mcc)
  if (!mcc) return null
  const b = o.bench as Record<string, unknown> | undefined
  if (!b || typeof b !== 'object') return null
  const slots = (b.slots ?? {}) as Record<string, unknown>
  const card = (v: unknown): CardId | null => (typeof v === 'string' && v in INFO3.clickBoards ? (v as CardId) : null)
  const bench: Bench = {
    usbBlack: !!b.usbBlack,
    usbWhite: !!b.usbWhite,
    slots: { mikrobus1: card(slots.mikrobus1), mikrobus2: card(slots.mikrobus2) },
    cover: !!b.cover,
    lockAttempts: typeof b.lockAttempts === 'number' && b.lockAttempts >= 0 ? b.lockAttempts : 0,
  }
  return {
    version: PROJECT_VERSION,
    id: o.id,
    name: o.name,
    kind: o.kind,
    files: o.files,
    generated: (o.generated as Record<string, string> | null) ?? null,
    generatedFrom: typeof o.generatedFrom === 'string' ? o.generatedFrom : null,
    mcc,
    bench,
    verified: !!o.verified,
  }
}
