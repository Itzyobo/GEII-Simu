import type { ReactNode } from 'react'
import type { Action, EtatBanc } from '../banc'
import type { Borne } from '../sim/cablage'

/** Ce que chaque instrument reçoit pour dessiner ses bornes de câblage */
export interface PropsBornes {
  choisie: Borne | null
  verrouillee: boolean
  onBorne: (id: Borne) => void
}

/** Page de TP pilotée par un banc (entraînement ou examen) ; `entete` remplace l'en-tête (chrono d'examen) */
export interface PropsPage {
  etat: EtatBanc
  agir: (a: Action) => void
  entete?: ReactNode
}
