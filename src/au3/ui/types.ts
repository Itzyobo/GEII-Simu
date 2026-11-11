import type { Borne } from '../sim/cablage'

/** Ce que chaque instrument reçoit pour dessiner ses bornes de câblage */
export interface PropsBornes {
  choisie: Borne | null
  verrouillee: boolean
  onBorne: (id: Borne) => void
}
