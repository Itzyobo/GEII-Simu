import { useEffect, useRef } from 'react'
import { MISE_EN_PAGE } from '../miseEnPage'
import { BANC_POSITION, lineaire } from '../sim/position'
import { Borne } from '../ui/Borne'
import type { PropsBornes } from '../ui/types'
import { DEGRES_PAR_TOUR } from '../unites'
import type { TempsReel } from './tempsReel'

const D = MISE_EN_PAGE.disque
const C = D.taille / 2
const RAD = Math.PI / (DEGRES_PAR_TOUR / 2)
/** Point du cercle de rayon r à l'angle a (degrés, sens horaire depuis le haut) */
const point = (r: number, a: number) => `${C + r * Math.sin(a * RAD)} ${C - r * Math.cos(a * RAD)}`
const arc = (r: number, a1: number, a2: number) => `M ${point(r, a1)} A ${r} ${r} 0 ${a2 - a1 > DEGRES_PAR_TOUR / 2 ? 1 : 0} 1 ${point(r, a2)}`

/**
 * Boîtier moteur du TP3 : disque fixé sur l'axe (antenne, balai d'essuie-glace) et potentiomètre rotatif vu de face
 * (figure 2 de l'énoncé) : piste linéaire de la borne rouge à la borne bleue, puis soudure côté bleue, isolant, soudure
 * côté rouge (angle mort). Les deux tournent à l'angle θ simulé, mis à jour à chaque image sans rendu React.
 */
export default function MoteurPosition({ bornes, tempsReel }: { bornes: PropsBornes; tempsReel: TempsReel }) {
  const disque = useRef<SVGGElement>(null)
  const curseur = useRef<SVGGElement>(null)
  const angle = useRef<HTMLSpanElement>(null)
  useEffect(
    () =>
      tempsReel.abonner((_s, _t, e) => {
        const a = e.theta - DEGRES_PAR_TOUR * Math.floor(e.theta / DEGRES_PAR_TOUR)
        disque.current?.setAttribute('transform', `rotate(${a} ${C} ${C})`)
        curseur.current?.setAttribute('transform', `rotate(${a} ${C} ${C})`)
        if (angle.current) {
          angle.current.textContent = `θ = ${a.toFixed(D.chiffres)}°`
          angle.current.dataset.theta = String(e.theta)
        }
      }),
    [tempsReel],
  )
  const b = (id: Parameters<PropsBornes['onBorne']>[0]) => ({ id, choisie: bornes.choisie === id, verrouillee: bornes.verrouillee, onClick: bornes.onBorne })
  const B = BANC_POSITION
  const L = lineaire(B)
  return (
    <section aria-label="Boîtier moteur et potentiomètre (TP3)" className="au3-sombre rounded-xl bg-[#2a2e35] p-3 shadow-xl ring-1 ring-white/10">
      <p className="text-center text-xs font-bold tracking-widest text-[#e3e6ea]">MOTEUR · POSITION</p>
      <svg width={D.taille} height={D.taille} viewBox={`0 0 ${D.taille} ${D.taille}`} className="mx-auto mt-2 block" role="img" aria-label="Disque fixé sur l’axe du moteur (antenne virtuelle)">
        <circle cx={C} cy={C} r={D.rayonDisque} fill={D.couleurs.disque} stroke="#555" />
        <g ref={disque}>
          <line x1={C} y1={C} x2={C} y2={C - D.rayonDisque} stroke="#1b1b1b" strokeWidth="4" strokeLinecap="round" />
          <circle cx={C} cy={C - D.rayonDisque + D.epaisseurPiste} r={D.epaisseurPiste / 2} fill="#1b1b1b" />
        </g>
        <circle cx={C} cy={C} r={D.epaisseurPiste / 2} fill="#1b1b1b" />
      </svg>
      <p className="text-center font-mono text-[11px] text-[#e3e6ea]">
        <span ref={angle} data-angle-disque>
          θ = —
        </span>
      </p>
      <svg width={D.taille} height={D.taille} viewBox={`0 0 ${D.taille} ${D.taille}`} className="mx-auto mt-1 block" role="img" aria-label={`Potentiomètre vu de face : piste linéaire sur ${L}°, angle mort de ${DEGRES_PAR_TOUR - L}° (soudure, isolant, soudure)`} data-potentiometre>
        <path d={arc(D.rayonPiste, 0, L)} fill="none" stroke={D.couleurs.piste} strokeWidth={D.epaisseurPiste} />
        <path d={arc(D.rayonPiste, L, L + B.soudureP12)} fill="none" stroke={D.couleurs.soudureBleue} strokeWidth={D.epaisseurPiste} data-angle-mort="soudure-bleue" />
        <path d={arc(D.rayonPiste, L + B.soudureP12, L + B.soudureP12 + B.isolant)} fill="none" stroke={D.couleurs.isolant} strokeWidth={D.epaisseurPiste} data-angle-mort="isolant" />
        <path d={arc(D.rayonPiste, L + B.soudureP12 + B.isolant, DEGRES_PAR_TOUR)} fill="none" stroke={D.couleurs.soudureRouge} strokeWidth={D.epaisseurPiste} data-angle-mort="soudure-rouge" />
        <g ref={curseur}>
          <line x1={C} y1={C} x2={C} y2={C - D.rayonCurseur} stroke={D.couleurs.curseur} strokeWidth="3" strokeLinecap="round" />
        </g>
        <circle cx={C} cy={C} r={D.epaisseurPiste / 2} fill={D.couleurs.curseur} />
      </svg>
      <p className="text-center text-[9px] text-au3-muted">angle mort : soudure (bleue) · isolant 0 V · soudure (rouge)</p>
      <div className="mt-3 flex justify-between gap-2">
        <div className="flex flex-col gap-2">
          <Borne {...b('mot.rouge')} couleur="rouge" etiquette="Alim moteur" />
          <Borne {...b('mot.noir')} couleur="noir" etiquette="Alim moteur" />
        </div>
        <div className="flex flex-col gap-2">
          <Borne {...b('pot.rouge')} couleur="rouge" etiquette="Pot. rouge" />
          <Borne {...b('pot.bleue')} couleur="bleu" etiquette="Pot. bleue" />
          <Borne {...b('pot.verte')} couleur="vert" etiquette="Pot. sortie" />
        </div>
      </div>
    </section>
  )
}
