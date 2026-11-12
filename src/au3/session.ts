import { au3 } from '../data/reference'
import { MISE_EN_PAGE } from './miseEnPage'
import { GBF_DEFAUT, type ReglagesGbf } from './instruments/gbf'
import type { Curseurs, ReglagesOscillo } from './instruments/oscillo'
import type { Cable } from './sim/cablage'
import type { ReglagesPlatine } from './sim/simulate'

/**
 * Session AU3 conservée dans localStorage, versionnée : un changement de schéma ajoute une migration explicite
 * (MIGRATIONS), qui fait monter SESSION_VERSION ; une session ancienne est migrée, une version inconnue ignorée.
 * Le mode examen (étape 5) réutilise ce schéma : chrono, réponses, essais de vérification,
 * événements sous tension et câblage survivent à un rechargement.
 */

export type ModeSession = 'libre' | 'examen'
/** Page qui porte la session : banc libre ou TP (chacune garde son câblage et ses réponses) */
export type EspaceSession = 'banc' | 'tp1' | 'tp2' | 'tp4'
export const cleSession = (mode: ModeSession, espace: EspaceSession = 'banc') => (espace === 'banc' ? `au3.session.${mode}` : `au3.session.${mode}.${espace}`)

export interface EvenementManip {
  /** Date (ms depuis l'époque Unix) */
  instant: number
  type: 'manip-sous-tension' | 'autoscale'
  detail: string
}

/** Croix posée sur l'abaque : abscisse z et ordonnée lue sur la courbe */
export interface Croix {
  z: number
  y: number
}

/** Paramètres trouvés par les moindres carrés (ordre 1 : g0, tau ; ordre 2 : g0, z, wn) */
export interface ResultatFit {
  ordre: 1 | 2
  g0: number
  tau?: number
  z?: number
  wn?: number
  critere: number
  iterations: number
}

/** Progression du TP1 hors réponses saisies : abaque, .csv exporté, identifications */
export interface ProgressionTp1 {
  croixT3T1: Croix | null
  croixWnT: Croix | null
  /** Méthode du calcul de ωn : t3 (énoncé) ou t1 (écart de méthode signalé) */
  methodeWn: 't3' | 't1'
  csv: string | null
  ordre1: ResultatFit | null
  ordre2: ResultatFit | null
}

/** Même progression pour chaque essai du TP2 (K = 3,8 et K = 40) */
export type ProgressionEssai = ProgressionTp1

export const progressionNeuve = (): ProgressionTp1 => ({ croixT3T1: null, croixWnT: null, methodeWn: 't3', csv: null, ordre1: null, ordre2: null })

export interface SessionAu3 {
  version: typeof SESSION_VERSION
  mode: ModeSession
  chrono: { debut: number | null; ecouleMs: number }
  /** Réponses par id de question */
  reponses: Record<string, { valeur: string; essais: number }>
  /** Nombre de « Faire vérifier » demandés */
  essaisVerification: number
  /** Signature du câblage au dernier « Faire vérifier » (null = jamais vérifié) */
  verifieSur: string | null
  /** Signature du câblage à la dernière vérification réussie (toutes les liaisons correctes) */
  verifieReussiSur: string | null
  evenementsSousTension: EvenementManip[]
  /** Autres fautes journalisées (Autoscale) */
  fautes: EvenementManip[]
  cablage: Cable[]
  gbf: ReglagesGbf
  platine: ReglagesPlatine
  oscillo: ReglagesOscillo
  curseurs: Curseurs
  tp1: ProgressionTp1
  tp2: { k38: ProgressionEssai; k40: ProgressionEssai }
}

const D = MISE_EN_PAGE.oscillo.defaut

export function sessionNeuve(mode: ModeSession): SessionAu3 {
  return {
    version: SESSION_VERSION,
    mode,
    chrono: { debut: null, ecouleMs: 0 },
    reponses: {},
    essaisVerification: 0,
    verifieSur: null,
    verifieReussiSur: null,
    evenementsSousTension: [],
    fautes: [],
    cablage: [],
    gbf: GBF_DEFAUT,
    platine: { sousTension: false, ampli: 'normal', g1: au3('TP2_K38_G1'), g2: au3('TP2_K38_G2'), z1: null, z2: null },
    oscillo: {
      voies: D.vdiv.map((vdiv) => ({ active: true, vdiv, position: 0, couplage: 'DC' as const })),
      sdiv: D.sdiv,
      declenchement: { source: 0, front: 'montant', niveau: 0, mode: 'normal' },
      moyennage: 1,
      run: true,
    },
    curseurs: { ...D.curseurs, source: 1, suivre: false },
    tp1: progressionNeuve(),
    tp2: { k38: progressionNeuve(), k40: progressionNeuve() },
  }
}

type SessionBrute = Record<string, unknown> & { version?: unknown; mode?: unknown; platine?: Record<string, unknown> }

/** Migrations explicites, une par version : v1 → v2 (ampli de courant, progression TP1), v2 → v3 (vérification réussie, TP2) */
const MIGRATIONS: Record<number, (s: SessionBrute) => SessionBrute> = {
  1: (s) => ({ ...s, version: Number(s.version) + 1, platine: { ...s.platine, ampli: 'normal' }, tp1: progressionNeuve() }),
  2: (s) => ({ ...s, version: Number(s.version) + 1, verifieReussiSur: null, tp2: { k38: progressionNeuve(), k40: progressionNeuve() } }),
}

/** Version courante du schéma = nombre de migrations + 1 (ajouter une migration fait monter la version) */
export const SESSION_VERSION = Object.keys(MIGRATIONS).length + 1

/** Amène une session d'une version antérieure à SESSION_VERSION ; null si version inconnue */
export function migrerSession(brute: SessionBrute): SessionAu3 | null {
  let s = brute
  while (typeof s.version === 'number' && s.version < SESSION_VERSION) {
    const m = MIGRATIONS[s.version]
    if (!m) return null
    s = m(s)
  }
  return s.version === SESSION_VERSION ? (s as unknown as SessionAu3) : null
}

/** Relit une session (migrée si elle est d'une version antérieure) ; null si absente, illisible ou d'une version inconnue */
export function chargerSession(stockage: Pick<Storage, 'getItem'>, mode: ModeSession, espace: EspaceSession = 'banc'): SessionAu3 | null {
  try {
    const brut = stockage.getItem(cleSession(mode, espace))
    if (!brut) return null
    const s = migrerSession(JSON.parse(brut) as SessionBrute)
    return s && s.mode === mode ? s : null
  } catch {
    return null
  }
}

export function sauverSession(stockage: Pick<Storage, 'setItem'>, s: SessionAu3, espace: EspaceSession = 'banc'): void {
  try {
    stockage.setItem(cleSession(s.mode, espace), JSON.stringify(s))
  } catch {
    // stockage plein ou interdit (navigation privée) : la session reste en mémoire
  }
}
