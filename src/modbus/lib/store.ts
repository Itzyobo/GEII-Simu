/**
 * Store unique et sérialisable du simulateur TP2 : session, câblage, bus, incidents, réponses, logiciel.
 * Toute modification passe par `reduce` (pure, testée) ; chaque changement est sauvegardé sous « tp2sim:v1 ».
 */
import { useSyncExternalStore } from 'react'
import { REF } from '../data/reference'

export const STORAGE_KEY = 'tp2sim:v1'
const VERSION = 1

export type CardId = 'c1' | 'c2'
export type TestPoint = 'TXD_TTL' | 'TXD_RS232' | 'TX+' | 'TX-' | 'TX_EN'
export type ProbePoint = `${CardId}.${TestPoint}`
export type ChId = 'ch1' | 'ch2'
export type Role = 'Maître' | 'Analyseur' | 'Aucun'

export interface Wiring {
  probes: Record<ChId, { tip: ProbePoint | null; ground: CardId | null }>
  /** Atténuation de la sonde physique (inverseur ×1 / ×10 sur la sonde) */
  attenuation: Record<ChId, 1 | 10>
  /** Commutateur « contrôle de flux » de chaque carte */
  flow: Record<CardId, boolean>
  /** Câble série entre les deux cartes (2.4) */
  serialCable: boolean
  /** Câble DB9/bleu-vert de chaque carte vers le pupitre (partie 3) */
  db9: Record<CardId, boolean>
}

export interface Incident {
  /** ISO 8601 */
  at: string
  kind: 'retrait-sonde' | 'retrait-db9' | 'manip-bus-actif'
  detail: string
}

/** Activité en cours : fixe le câblage attendu par « Faire vérifier ». */
export type Activity = 'demo'

export interface State {
  version: typeof VERSION
  session: { mode: 'entrainement' | 'examen'; startedAt: string | null; activity: Activity }
  wiring: Wiring
  /** Résultat du dernier « Faire vérifier » : null = câblage modifié depuis */
  check: { ok: boolean; errors: string[] } | null
  /** Nombre de « Faire vérifier » par activité (notation du câblage en examen : 1er essai, 2e, puis 0) */
  verifyAttempts: Partial<Record<Activity, number>>
  bus: { active: boolean }
  incidents: Incident[]
  /** Dernier refus, affiché à l'étudiant */
  notice: string | null
  answers: Record<string, { value: string; attempts: number; correct: boolean }>
  software: { role: Role; memorized: number[][]; messages: string[] }
}

export const initialState = (): State => ({
  version: VERSION,
  session: { mode: 'entrainement', startedAt: null, activity: 'demo' },
  wiring: {
    probes: { ch1: { tip: null, ground: null }, ch2: { tip: null, ground: null } },
    attenuation: { ch1: REF.scopeSerie1Probe.value, ch2: REF.scopeSerie1Probe.value },
    flow: { c1: false, c2: false },
    serialCable: false,
    db9: { c1: false, c2: false },
  },
  check: null,
  verifyAttempts: {},
  bus: { active: false },
  incidents: [],
  notice: null,
  answers: {},
  software: { role: 'Aucun', memorized: [], messages: [] },
})

export type Action =
  | { type: 'probe'; ch: ChId; tip: ProbePoint | null }
  | { type: 'ground'; ch: ChId; card: CardId | null }
  | { type: 'attenuation'; ch: ChId; value: 1 | 10 }
  | { type: 'flow'; card: CardId; on: boolean }
  | { type: 'serialCable'; on: boolean }
  | { type: 'db9'; card: CardId; on: boolean }
  | { type: 'verify' }
  | { type: 'startEmission' }
  | { type: 'stopEmission' }
  | { type: 'role'; role: Role }
  | { type: 'memorize'; bytes: number[] }
  | { type: 'clearMemorized' }
  | { type: 'message'; text: string }
  | { type: 'reset' }

const POINT_LABEL: Record<TestPoint, string> = { TXD_TTL: 'TXD TTL', TXD_RS232: 'TXD RS232', 'TX+': 'TX+', 'TX-': 'TX−', TX_EN: 'TX_EN' }
export const pointLabel = (p: ProbePoint) => {
  const [card, tp] = p.split('.') as [CardId, TestPoint]
  return `${POINT_LABEL[tp]} (carte ${card === 'c1' ? 1 : 2})`
}

/** Erreurs de câblage pour l'activité ; liste vide = câblage correct. */
export function checkWiring(w: Wiring, activity: Activity): string[] {
  const errors: string[] = []
  if (activity === 'demo') {
    const chans = (['ch1', 'ch2'] as const).filter((c) => w.probes[c].tip === 'c1.TXD_TTL' || w.probes[c].tip === 'c1.TXD_RS232')
    if (chans.length === 0) errors.push('Aucune sonde sur TXD TTL ou TXD RS232 de la carte 1.')
    for (const c of chans)
      if (w.probes[c].ground !== 'c1') errors.push(`Pince de masse de ${c === 'ch1' ? 'Ch1' : 'Ch2'} non reliée à la masse de la carte 1.`)
    if (REF.controleFluxRequis.value && !w.flow.c1) errors.push('Commutateur de la carte 1 hors « contrôle de flux » : aucune émission (H18).')
  }
  return errors
}

const incident = (s: State, kind: Incident['kind'], detail: string): State => ({
  ...s,
  incidents: [...s.incidents, { at: new Date().toISOString(), kind, detail }],
  notice: `Refusé : ${detail}. Arrêtez l'émission avant de toucher au câblage.`,
})

/** Câblage modifié : la vérification précédente ne vaut plus. */
const rewire = (s: State, wiring: Wiring): State => ({ ...s, wiring, check: null, notice: null })

export function reduce(s: State, a: Action): State {
  const live = s.bus.active
  const w = s.wiring
  switch (a.type) {
    case 'probe': {
      const cur = w.probes[a.ch].tip
      if (live && cur !== null && cur !== a.tip) return incident(s, 'retrait-sonde', `sonde ${a.ch === 'ch1' ? 'Ch1' : 'Ch2'} retirée de ${pointLabel(cur)} pendant une émission`)
      return rewire(s, { ...w, probes: { ...w.probes, [a.ch]: { ...w.probes[a.ch], tip: a.tip } } })
    }
    case 'ground': {
      const cur = w.probes[a.ch].ground
      if (live && cur !== null && cur !== a.card) return incident(s, 'retrait-sonde', `pince de masse ${a.ch === 'ch1' ? 'Ch1' : 'Ch2'} débranchée pendant une émission`)
      return rewire(s, { ...w, probes: { ...w.probes, [a.ch]: { ...w.probes[a.ch], ground: a.card } } })
    }
    case 'attenuation':
      // Inverseur sur la sonde : ne débranche rien, autorisé pendant une émission
      return { ...s, wiring: { ...w, attenuation: { ...w.attenuation, [a.ch]: a.value } } }
    case 'flow':
      if (live) return incident(s, 'manip-bus-actif', 'commutateur « contrôle de flux » manœuvré pendant une émission')
      return rewire(s, { ...w, flow: { ...w.flow, [a.card]: a.on } })
    case 'serialCable':
      if (live && !a.on) return incident(s, 'retrait-db9', 'câble série débranché pendant une émission')
      return rewire(s, { ...w, serialCable: a.on })
    case 'db9':
      if (live && !a.on) return incident(s, 'retrait-db9', `DB9 de la carte ${a.card === 'c1' ? 1 : 2} débranché pendant une émission`)
      return rewire(s, { ...w, db9: { ...w.db9, [a.card]: a.on } })
    case 'verify': {
      const errors = checkWiring(w, s.session.activity)
      const n = (s.verifyAttempts[s.session.activity] ?? 0) + 1
      return { ...s, check: { ok: errors.length === 0, errors }, verifyAttempts: { ...s.verifyAttempts, [s.session.activity]: n }, notice: null }
    }
    case 'startEmission':
      if (!s.check) return { ...s, notice: 'Refusé : faites vérifier le câblage avant de lancer une émission.' }
      if (!s.check.ok) return { ...s, notice: 'Refusé : le câblage vérifié comporte des erreurs.' }
      return { ...s, bus: { active: true }, notice: null }
    case 'stopEmission':
      return { ...s, bus: { active: false }, notice: null }
    case 'role':
      return { ...s, software: { ...s.software, role: a.role } }
    case 'memorize':
      return { ...s, software: { ...s.software, memorized: [...s.software.memorized, a.bytes] } }
    case 'clearMemorized':
      return { ...s, software: { ...s.software, memorized: [] } }
    case 'message':
      return { ...s, software: { ...s.software, messages: [...s.software.messages, a.text].slice(-50) } }
    case 'reset':
      return initialState()
  }
}

/* ───────────── Persistance ───────────── */

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>
const defaultStorage = (): StorageLike | null => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function load(storage: StorageLike | null = defaultStorage()): State {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return initialState()
    const s = JSON.parse(raw) as State
    return s?.version === VERSION ? { ...initialState(), ...s } : initialState()
  } catch {
    return initialState()
  }
}

export function save(s: State, storage: StorageLike | null = defaultStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    /* stockage indisponible : l'état reste en mémoire pour la session */
  }
}

let current: State = load()
const listeners = new Set<() => void>()

export function dispatch(a: Action) {
  current = reduce(current, a)
  save(current)
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useStore = () => useSyncExternalStore(subscribe, () => current)
