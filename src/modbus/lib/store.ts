/**
 * Store unique et sérialisable du simulateur TP2 : session, câblage, bus, incidents, réponses, logiciel.
 * Toute modification passe par `reduce` (pure, testée) ; chaque changement est sauvegardé sous « tp2sim:v1 ».
 */
import { useSyncExternalStore } from 'react'
import { REF } from '../data/reference'
import { realtermDefaut, type CableSerie, type RealtermSettings } from '../models/serie'
import type { Liaison } from '../models/uart'
import { busRun, parcoursComplet, type BusFrame, type Emetteur, type Memorisee, type Parcours } from '../models/bus'
import { pupitreInitial, type PupitreState } from '../models/slaves'

export const STORAGE_KEY = 'tp2sim:v1'
const VERSION = 4
/** Trames gardées dans le journal du bus : au moins un parcours complet et ses réponses */
const JOURNAL_MAX = 2 * REF.parcoursAdresses.value + 100

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
  /** Câble série entre les deux cartes (2.4) : null = débranché */
  serialCable: CableSerie | null
  /** Câble DB9/bleu-vert de chaque carte vers le pupitre (partie 3) */
  db9: Record<CardId, boolean>
}

export interface Incident {
  /** ISO 8601 */
  at: string
  kind: 'retrait-sonde' | 'retrait-db9' | 'manip-bus-actif'
  detail: string
}

/** Activité en cours : programme lancé sur le PC n°1 (partie A) ou réseau Modbus (partie B), et câblage attendu par « Faire vérifier ». */
export type Activity = 'serie1' | 'serie2' | 'serie3' | 'realterm' | 'reseau'
export type SerieActivity = Exclude<Activity, 'reseau'>
export const ACTIVITY_LABEL: Record<Activity, string> = { serie1: 'SERIE_1', serie2: 'SERIE_2', serie3: 'SERIE_3', realterm: 'SERIE_3 → RealTerm', reseau: 'réseau Modbus' }

/** Logiciel SERVEUR JBUS/MODBUS d'un PC */
export interface Logiciel {
  role: Role
  memorized: Memorisee[]
  /** Instant (horloge de simulation) de la première trame mémorisée : début des émissions périodiques */
  memStart: number
  messages: string[]
}

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
  answers: Record<string, { value: string; attempts: number; /** 1, ½ ou 0 */ points: number }>
  /** Un logiciel par PC : binôme 1 (carte 1) et binôme 2 (carte 2) */
  software: Record<CardId, Logiciel>
  /** Dernier parcours réseau de chaque carte (horloge de simulation, s), gardé après sa fin pour l'historique */
  parcours: Record<CardId, Parcours | null>
  /** Horloge de simulation du bus Modbus : t (s), vitesse, heure murale (ms) correspondant à t = 0 */
  sim: { t: number; speed: 1 | 10; wall0: number | null }
  /** Réglages du pupitre ; « polarisation absente » (H9) prévue pour l'étape 5 */
  reglages: { polarisation: boolean }
  /** État des modules du pupitre, modifié par les trames et par les interrupteurs et potentiomètres */
  pupitre: PupitreState
  /** Trames passées sur le bus (ou sur les broches d'une carte non branchée), dans l'ordre, les plus récentes */
  journal: BusFrame[]
  /** Octet saisi dans la console de SERIE_1 et SERIE_2 (H28) */
  octets: { serie1: number; serie2: number }
  /** Graine du format de SERIE_2, tirée au premier lancement et fixée pour la session (H3) ; vrai format saisi dans Réglages */
  serie2: { graine: number | null; reel: Liaison | null }
  realterm: RealtermSettings
}

const logicielVide = (): Logiciel => ({ role: 'Aucun', memorized: [], memStart: 0, messages: [] })

export const initialState = (): State => ({
  version: VERSION,
  session: { mode: 'entrainement', startedAt: null, activity: 'serie1' },
  wiring: {
    probes: { ch1: { tip: null, ground: null }, ch2: { tip: null, ground: null } },
    attenuation: { ch1: REF.scopeSerie1Probe.value, ch2: REF.scopeSerie1Probe.value },
    flow: { c1: false, c2: false },
    serialCable: null,
    db9: { c1: false, c2: false },
  },
  check: null,
  verifyAttempts: {},
  bus: { active: false },
  incidents: [],
  notice: null,
  answers: {},
  software: { c1: logicielVide(), c2: logicielVide() },
  parcours: { c1: null, c2: null },
  sim: { t: 0, speed: 1, wall0: null },
  reglages: { polarisation: true },
  pupitre: pupitreInitial(),
  journal: [],
  octets: { serie1: 0x55, serie2: 0x55 },
  serie2: { graine: null, reel: null },
  realterm: realtermDefaut(),
})

export type Action =
  | { type: 'probe'; ch: ChId; tip: ProbePoint | null }
  | { type: 'ground'; ch: ChId; card: CardId | null }
  | { type: 'attenuation'; ch: ChId; value: 1 | 10 }
  | { type: 'flow'; card: CardId; on: boolean }
  | { type: 'serialCable'; cable: CableSerie | null }
  | { type: 'db9'; card: CardId; on: boolean }
  | { type: 'verify' }
  | { type: 'startEmission' }
  | { type: 'stopEmission' }
  | { type: 'role'; card: CardId; role: Role }
  | { type: 'memorize'; card: CardId; bytes: number[]; periode: number; wall: number }
  | { type: 'interrupteur'; k: number }
  | { type: 'potentiometre'; k: 0 | 1; value: number }
  | { type: 'resetPupitre' }
  | { type: 'clearMemorized'; card: CardId }
  | { type: 'message'; card: CardId; text: string }
  | { type: 'parcours'; card: CardId; on: boolean; wall: number }
  | { type: 'speed'; speed: 1 | 10 }
  | { type: 'tick'; dt: number }
  | { type: 'activity'; activity: Activity }
  | { type: 'octet'; programme: 'serie1' | 'serie2'; value: number }
  | { type: 'serie2Graine'; graine: number }
  | { type: 'serie2Reel'; reel: Liaison | null }
  | { type: 'realterm'; patch: Partial<RealtermSettings> }
  | { type: 'answer'; key: string; value: string; points: number }
  | { type: 'reset' }

const POINT_LABEL: Record<TestPoint, string> = { TXD_TTL: 'TXD TTL', TXD_RS232: 'TXD RS232', 'TX+': 'TX+', 'TX-': 'TX−', TX_EN: 'TX_EN' }
export const pointLabel = (p: ProbePoint) => {
  const [card, tp] = p.split('.') as [CardId, TestPoint]
  return `${POINT_LABEL[tp]} (carte ${card === 'c1' ? 1 : 2})`
}

/** Erreurs de câblage pour l'activité ; liste vide = câblage correct. */
export function checkWiring(w: Wiring, activity: Activity): string[] {
  const errors: string[] = []
  if (activity === 'reseau') {
    for (const c of ['c1', 'c2'] as const) if (!w.db9[c]) errors.push(`Carte ${c === 'c1' ? 1 : 2} non reliée au pupitre (câble DB9/bleu-vert).`)
    const chans = (['ch1', 'ch2'] as const).filter((c) => w.probes[c].tip !== null)
    if (chans.length === 0) errors.push('Aucune sonde posée (TX+, TX− ou TX_EN).')
    for (const c of chans)
      if (w.probes[c].ground === null) errors.push(`Pince de masse de ${c === 'ch1' ? 'Ch1' : 'Ch2'} non reliée.`)
    return errors
  }
  if (activity === 'realterm') {
    // Le type de câble n'est pas contrôlé : un câble droit est une erreur de manip à constater dans RealTerm
    if (!w.serialCable) errors.push('Aucun câble série entre les deux cartes.')
    if (!w.flow.c2) errors.push('Commutateur de la carte 2 hors « contrôle de flux » (l’énoncé le demande sur les deux cartes).')
  } else {
    const chans = (['ch1', 'ch2'] as const).filter((c) => w.probes[c].tip === 'c1.TXD_TTL' || w.probes[c].tip === 'c1.TXD_RS232')
    if (chans.length === 0) errors.push('Aucune sonde sur TXD TTL ou TXD RS232 de la carte 1.')
    for (const c of chans)
      if (w.probes[c].ground !== 'c1') errors.push(`Pince de masse de ${c === 'ch1' ? 'Ch1' : 'Ch2'} non reliée à la masse de la carte 1.`)
  }
  if (REF.controleFluxRequis.value && !w.flow.c1) errors.push('Commutateur de la carte 1 hors « contrôle de flux » : aucune émission (H18).')
  return errors
}

const incident = (s: State, kind: Incident['kind'], detail: string): State => ({
  ...s,
  incidents: [...s.incidents, { at: new Date().toISOString(), kind, detail }],
  notice: `Refusé : ${detail}. Arrêtez l'émission avant de toucher au câblage.`,
})

/** Câblage modifié : la vérification précédente ne vaut plus. */
const rewire = (s: State, wiring: Wiring): State => ({ ...s, wiring, check: null, notice: null })

/** Une carte en Maître émet : parcours en cours ou trames mémorisées envoyées périodiquement. */
export const parcoursEnCours = (s: State, c: CardId) => s.parcours[c] !== null && s.sim.t < s.parcours[c]!.fin
export const masterEmitting = (s: State, c: CardId) => s.software[c].role === 'Maître' && (parcoursEnCours(s, c) || s.software[c].memorized.length > 0)
/** Maître actif ou ayant fait un parcours : ses trames restent dans l'historique de l'analyseur */
export const masterHistory = (s: State, c: CardId) => s.software[c].role === 'Maître' && (s.parcours[c] !== null || s.software[c].memorized.length > 0)
const stop = (s: State, c: CardId): State => (parcoursEnCours(s, c) ? { ...s, parcours: { ...s.parcours, [c]: { ...s.parcours[c]!, fin: s.sim.t } } } : s)
const anyMaster = (s: State) => masterEmitting(s, 'c1') || masterEmitting(s, 'c2')
const other = (c: CardId): CardId => (c === 'c1' ? 'c2' : 'c1')
const soft = (s: State, c: CardId, patch: Partial<Logiciel>): State => ({ ...s, software: { ...s.software, [c]: { ...s.software[c], ...patch } } })
/** Démarre l'horloge murale de l'analyseur à la première émission */
const withWall = (s: State, wall: number): State => (s.sim.wall0 === null ? { ...s, sim: { ...s.sim, wall0: wall - s.sim.t * 1000 } } : s)

export function reduce(s: State, a: Action): State {
  const live = s.bus.active || anyMaster(s)
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
      if (live && w.serialCable && a.cable !== w.serialCable) return incident(s, 'retrait-db9', 'câble série débranché pendant une émission')
      return rewire(s, { ...w, serialCable: a.cable })
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
      if (s.session.activity === 'serie2' && s.serie2.graine === null) return { ...s, notice: 'Refusé : SERIE_2 n’a pas de format de session.' }
      return { ...s, bus: { active: true }, notice: null }
    case 'stopEmission':
      return { ...s, bus: { active: false }, notice: null }
    case 'role': {
      // Passer en Analyseur arrête le parcours de cette carte
      const r = soft(s, a.card, { role: a.role })
      return a.role === 'Maître' ? r : stop(r, a.card)
    }
    case 'memorize': {
      const sw = s.software[a.card]
      const m = { bytes: a.bytes, periode: a.periode }
      return withWall(soft(s, a.card, { role: 'Maître', memorized: [...sw.memorized, m], memStart: sw.memorized.length ? sw.memStart : s.sim.t }), a.wall)
    }
    case 'clearMemorized':
      return soft(s, a.card, { memorized: [] })
    case 'message':
      return soft(s, a.card, { messages: [...s.software[a.card].messages, a.text].slice(-50) })
    case 'parcours': {
      if (!a.on) return stop(s, a.card)
      // Second maître pendant un parcours : calé sur les créneaux du premier (H37)
      const I = REF.parcoursIntervalle.value
      const o = s.parcours[other(a.card)]
      const start = o && parcoursEnCours(s, other(a.card)) ? o.debut + Math.ceil((s.sim.t - o.debut) / I) * I + REF.deuxMaitresDecalage.value : s.sim.t
      return withWall(soft({ ...s, parcours: { ...s.parcours, [a.card]: parcoursComplet(start) } }, a.card, { role: 'Maître' }), a.wall)
    }
    case 'speed':
      // Accélération interdite en mode partiel
      return s.session.mode === 'examen' ? s : { ...s, sim: { ...s.sim, speed: a.speed } }
    case 'tick': {
      if (!anyMaster(s)) return s
      const t = s.sim.t + a.dt * s.sim.speed
      // Trames qui commencent pendant ce pas : exécutées par les esclaves (l'état du pupitre suit) et journalisées.
      // La fenêtre déborde d'une marge pour voir les chevauchements avec les pas voisins.
      const M = REF.esclaveDelaiReponse.value + REF.parcoursIntervalle.value / 4
      const run = busRun(emetteurs(s), s.sim.t - M, t + M, s.pupitre, [s.sim.t, t])
      // Parcours qui se termine pendant ce pas
      const fin = (c: CardId) => parcoursEnCours(s, c) && t >= s.parcours[c]!.fin
      let r: State = { ...s, sim: { ...s.sim, t }, pupitre: run.etat, journal: [...s.journal, ...run.frames].slice(-JOURNAL_MAX) }
      for (const c of ['c1', 'c2'] as const) if (fin(c)) r = soft(r, c, { messages: [...r.software[c].messages, 'Parcours réseau terminé'].slice(-50) })
      return r
    }
    case 'activity':
      if (live) return { ...s, notice: 'Refusé : arrêtez le programme en cours avant d’en lancer un autre.' }
      return { ...s, session: { ...s.session, activity: a.activity }, check: null, notice: null }
    case 'octet':
      return { ...s, octets: { ...s.octets, [a.programme]: a.value & 0xff } }
    case 'serie2Graine':
      // Fixée pour la session : un second tirage n'écrase pas le premier
      return s.serie2.graine === null ? { ...s, serie2: { ...s.serie2, graine: a.graine } } : s
    case 'serie2Reel':
      return { ...s, serie2: { ...s.serie2, reel: a.reel } }
    case 'realterm':
      return { ...s, realterm: { ...s.realterm, ...a.patch } }
    case 'answer': {
      const prev = s.answers[a.key]
      return { ...s, answers: { ...s.answers, [a.key]: { value: a.value, attempts: (prev?.attempts ?? 0) + 1, points: a.points } } }
    }
    case 'interrupteur': {
      // Inverseur du panneau : manipulation permise pendant que le bus tourne
      const p = s.pupitre
      return { ...s, pupitre: { ...p, otb: { ...p.otb, entrees: p.otb.entrees ^ (1 << a.k) } } }
    }
    case 'potentiometre': {
      const pots = [...s.pupitre.otb.pots] as [number, number]
      pots[a.k] = Math.min(1, Math.max(0, a.value))
      return { ...s, pupitre: { ...s.pupitre, otb: { ...s.pupitre.otb, pots } } }
    }
    case 'resetPupitre':
      // Remise sous tension : adresses, configuration et sorties d'origine ; les inverseurs restent où ils sont
      return { ...s, pupitre: { ...pupitreInitial(), otb: { ...pupitreInitial().otb, entrees: s.pupitre.otb.entrees, pots: s.pupitre.otb.pots } } }
    case 'reset':
      return initialState()
  }
}

/** Cartes en Maître : parcours (en cours ou passé) et trames mémorisées */
export const emetteurs = (s: State): Emetteur[] =>
  (['c1', 'c2'] as const)
    .filter((c) => masterHistory(s, c))
    .map((c) => ({ card: c, connected: s.wiring.db9[c], parcours: s.parcours[c], memorized: s.software[c].memorized, memStart: s.software[c].memStart }))

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

/** Les pas d'horloge (10 par seconde) ne sauvegardent qu'une fois par seconde : le journal du bus pèse quelques dizaines de ko */
const SAVE_TICK_MS = 1000
let lastSave = 0

export function dispatch(a: Action) {
  const next = reduce(current, a)
  if (next === current) return
  current = next
  const now = Date.now()
  if (a.type !== 'tick' || now - lastSave >= SAVE_TICK_MS) {
    save(current)
    lastSave = now
  }
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useStore = () => useSyncExternalStore(subscribe, () => current)
