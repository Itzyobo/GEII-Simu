import { au3, AU3_INSTRUMENTS } from '../data/reference'
import { GBF_DEFAUT, type ReglagesGbf } from './instruments/gbf'
import type { Curseurs, ReglagesOscillo } from './instruments/oscillo'
import type { Cable } from './sim/cablage'
import type { ReglagesPlatine } from './sim/simulate'

/**
 * Session AU3 conservée dans localStorage, versionnée : un changement de schéma incrémente
 * SESSION_VERSION et les sessions d'une autre version sont ignorées (jamais mal relues).
 * Le mode examen (étape 5) réutilise ce schéma : chrono, réponses, essais de vérification,
 * événements sous tension et câblage survivent à un rechargement.
 */
export const SESSION_VERSION = 1
export type ModeSession = 'libre' | 'examen'
export const cleSession = (mode: ModeSession) => `au3.session.${mode}`

export interface EvenementManip {
  /** Date (ms depuis l'époque Unix) */
  instant: number
  type: 'manip-sous-tension' | 'autoscale'
  detail: string
}

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
  evenementsSousTension: EvenementManip[]
  /** Autres fautes journalisées (Autoscale) */
  fautes: EvenementManip[]
  cablage: Cable[]
  gbf: ReglagesGbf
  platine: ReglagesPlatine
  oscillo: ReglagesOscillo
  curseurs: Curseurs
}

const D = AU3_INSTRUMENTS.oscillo.defaut

export function sessionNeuve(mode: ModeSession): SessionAu3 {
  return {
    version: SESSION_VERSION,
    mode,
    chrono: { debut: null, ecouleMs: 0 },
    reponses: {},
    essaisVerification: 0,
    verifieSur: null,
    evenementsSousTension: [],
    fautes: [],
    cablage: [],
    gbf: GBF_DEFAUT,
    platine: { sousTension: false, g1: au3('TP2_K38_G1'), g2: au3('TP2_K38_G2'), z1: null, z2: null },
    oscillo: {
      voies: D.vdiv.map((vdiv) => ({ active: true, vdiv, position: 0, couplage: 'DC' as const })),
      sdiv: D.sdiv,
      declenchement: { source: 0, front: 'montant', niveau: 0, mode: 'normal' },
      moyennage: 1,
      run: true,
    },
    curseurs: { ...D.curseurs, source: 1, suivre: false },
  }
}

/** Relit une session ; null si absente, illisible ou d'une autre version */
export function chargerSession(stockage: Pick<Storage, 'getItem'>, mode: ModeSession): SessionAu3 | null {
  try {
    const brut = stockage.getItem(cleSession(mode))
    if (!brut) return null
    const s = JSON.parse(brut) as Partial<SessionAu3>
    return s.version === SESSION_VERSION && s.mode === mode ? (s as SessionAu3) : null
  } catch {
    return null
  }
}

export function sauverSession(stockage: Pick<Storage, 'setItem'>, s: SessionAu3): void {
  try {
    stockage.setItem(cleSession(s.mode), JSON.stringify(s))
  } catch {
    // stockage plein ou interdit (navigation privée) : la session reste en mémoire
  }
}
