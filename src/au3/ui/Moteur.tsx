import { MISE_EN_PAGE } from '../miseEnPage'
import { Borne } from './Borne'
import type { PropsBornes } from './types'

/**
 * Boîtier « MOTEUR 1 » : capot transparent, alimentation rouge/noire à gauche, sortie DT verte/jaune à droite.
 * Liaison mécanique moteur–DT pré-câblée. L'animation suit la vitesse simulée (fraction de la pleine échelle) :
 * arrêt complet à 0 (zone morte, ampli oublié, masse absente).
 */
export default function Moteur({ bornes, vitesse }: { bornes: PropsBornes; vitesse: number }) {
  const b = (id: Parameters<PropsBornes['onBorne']>[0]) => ({ id, choisie: bornes.choisie === id, verrouillee: bornes.verrouillee, onClick: bornes.onBorne })
  return (
    <section aria-label="Boîtier MOTEUR 1" className="au3-sombre rounded-xl bg-[#2a2e35] p-3 shadow-xl ring-1 ring-white/10">
      <p className="text-center text-xs font-bold tracking-widest text-[#e3e6ea]">MOTEUR 1</p>
      <div className="relative mx-auto mt-2 grid h-32 w-32 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/20 backdrop-blur-sm">
        <div
          data-vitesse={vitesse.toFixed(MISE_EN_PAGE.oscillo.chiffres)}
          aria-label={vitesse > 0 ? 'Moteur en rotation' : 'Moteur à l’arrêt'}
          role="img"
          className={`h-20 w-20 rounded-full border-4 border-dashed border-[#9aa0a6] ${vitesse > 0 ? 'animate-spin' : ''}`}
          style={vitesse > 0 ? { animationDuration: `${MISE_EN_PAGE.moteur.tourPleineEchelle / vitesse}s` } : undefined}
        />
        <p className="absolute bottom-1 text-[9px] text-au3-muted">MCC + DT (liaison mécanique)</p>
      </div>
      <div className="mt-3 flex justify-between">
        <div className="flex flex-col gap-2">
          <Borne {...b('mot.rouge')} couleur="rouge" etiquette="Alim +" />
          <Borne {...b('mot.noir')} couleur="noir" etiquette="Alim −" />
        </div>
        <div className="flex flex-col gap-2">
          <Borne {...b('mot.verte')} couleur="vert" etiquette="DT" />
          <Borne {...b('mot.jaune')} couleur="jaune" etiquette="DT" />
        </div>
      </div>
    </section>
  )
}
