/**
 * Mode démonstration : une démo est un script de données, des étapes faites d'actions typées.
 * Les valeurs peuvent dépendre de ce que la démo a lu sur l'oscilloscope (fonction du contexte).
 */
import type { Female, Male } from '../reseaux/benchTopology'
import type { PartielAnswers, PartielSubject } from '../reseaux/partiel'
import type { Ch, ChannelSettings, ScopeSettings } from '../scope/types'
import type { BenchGen, CaptureInfo, Lab, Zone } from './lab'

/** Contexte d'exécution : le labo, le sujet, les valeurs lues et calculées, la dernière acquisition */
export interface Ctx {
  lab: Lab
  subject: PartielSubject
  /** Valeurs lues et résultats de calcul, réutilisés par les étapes suivantes et la copie */
  memo: Record<string, number | string>
  capture: CaptureInfo | null
  /** Tourner une molette (animée si une mise en scène est branchée), via le Lab */
  turn: (knob: KnobId, value: number) => Promise<void>
  /** Single, puis attente de l'acquisition (mémorisée dans capture) */
  single: () => Promise<CaptureInfo | null>
  /** Run (déclenchements calés par le holdoff) puis Stop (mémorisée dans capture) */
  runStop: (seconds: number) => Promise<CaptureInfo | null>
  /** Entourer une zone de la trace avec une étiquette */
  mark: (zone: { from: number; to: number }, label: string) => Promise<void>
}

/** Valeur fixe ou calculée au moment de l'action */
export type V<T> = T | ((ctx: Ctx) => T)

/** Commandes rotatives que la démo peut tourner */
export type KnobId = 'sdiv' | 'delay' | 'vdiv0' | 'vdiv1' | 'offset0' | 'level' | 'holdoff' | 'pot' | 'eg' | 'width' | 'period' | 'f'
export type ButtonId = 'defaultSetup' | 'single' | 'run' | 'stop' | 'runStop'
export type CursorId = 'x1' | 'x2' | 'y1' | 'y2'

/** Cible à entourer : un élément de la page (attribut data-demo) ou une zone de la trace */
export type Target = { dom: string } | { zone: V<{ from: number; to: number }> }

export type Action =
  | { type: 'connect'; male: Male; female: Female }
  | { type: 'disconnect'; male: Male }
  | { type: 'range' }
  | { type: 'setGenerator'; patch: V<Partial<BenchGen>> }
  | { type: 'setScope'; patch: V<Partial<ScopeSettings>>; dom?: string }
  | { type: 'setChannel'; ch: Ch; patch: V<Partial<ChannelSettings>>; dom?: string }
  | { type: 'setTrigger'; patch: V<Partial<ScopeSettings['trig']>>; dom?: string }
  | { type: 'turnKnob'; knob: KnobId; value: V<number>; ms?: number }
  | { type: 'pressButton'; button: ButtonId }
  | { type: 'moveCursor'; cursor: CursorId; value: V<number>; ych?: Ch }
  | { type: 'zoom'; sdiv?: V<number>; delay?: V<number> }
  | { type: 'highlight'; target: Target; label: V<string> }
  | { type: 'overlayGrid'; cells: V<Zone[]> }
  | { type: 'writeBit'; index: number; value: V<string> }
  | { type: 'calc'; key: string; formula: string; subst: V<string>; result: V<number>; unit: string; digits?: number }
  | { type: 'fillAnswer'; part: keyof PartielAnswers; field: string; value: V<string> }
  | { type: 'read'; run: (ctx: Ctx) => void }
  /** Suite de gestes dépendant de ce qu'on lit (réglage itératif, Single répété) : uniquement via ctx.lab / ctx.turn / ctx.single */
  | { type: 'run'; run: (ctx: Ctx) => Promise<void> }
  | { type: 'tab'; index: 0 | 1 | 2 }
  | { type: 'wait'; ms: number }

export interface Step {
  id: string
  /** Phase affichée (ex. « Générateur à vide ») */
  phase: string
  /** Deux phrases au plus, tutoiement */
  narration: V<string>
  actions: Action[]
  /** Vitesse ×2 pour les répétitions (caractères suivants) */
  fast?: boolean
}

/** Carte de calcul affichée : formule générale, substitution, résultat */
export interface CalcCard {
  formula: string
  subst: string
  result: string
}

export interface DemoScript {
  part: 'cable' | 'serie' | 'ping'
  title: string
  steps: Step[]
  /** Récapitulatif des déductions, en fin de partie */
  recap: (ctx: Ctx) => string[]
}

export const resolve = <T,>(v: V<T>, ctx: Ctx): T => (typeof v === 'function' ? (v as (c: Ctx) => T)(ctx) : v)
