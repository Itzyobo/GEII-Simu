import { au3 } from '../../data/reference'
import { gainAffichage } from '../sim/regulateur'
import type { ReglagesPlatine } from '../sim/simulate'
import type { Borne as IdBorne } from '../sim/cablage'
import { Borne, type CouleurBorne } from './Borne'
import type { PropsBornes } from './types'

const G2_CHOIX = [au3('G2_X1'), au3('G2_X10'), au3('G2_X100')]

function Douille({ id, couleur, etiquette, bornes }: { id: IdBorne; couleur: CouleurBorne; etiquette: string; bornes: PropsBornes }) {
  return <Borne id={id} couleur={couleur} etiquette={etiquette} choisie={bornes.choisie === id} verrouillee={bornes.verrouillee} onClick={bornes.onBorne} />
}

function Support({ nom }: { nom: string }) {
  return (
    <div className="grid h-12 w-20 place-items-center rounded border border-dashed border-[#6b5a3a] bg-black/20 text-[10px] text-[#3b3122]" title="Support de composant (vide à cette étape)">
      {nom} · vide
    </div>
  )
}

/** Platine « Régulateur analogique » (poste 4) : face avant non visible sur les photos, disposition approximative */
export default function Platine({ platine, onReglage, onInterrupteur, bornes }: { platine: ReglagesPlatine; onReglage: (p: { g1?: number; g2?: number }) => void; onInterrupteur: () => void; bornes: PropsBornes }) {
  const k = gainAffichage(platine.g1, platine.g2)
  return (
    <section aria-label="Platine Régulateur analogique" className="rounded-xl bg-au3-bois p-2 shadow-xl">
      <div className="rounded-lg bg-[#e9e4d8] p-3 text-[#1d1d1d]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-bold tracking-wide">RÉGULATEUR ANALOGIQUE · poste 4</p>
            <p className="mt-0.5 inline-block rounded bg-au3-warn/20 px-1.5 text-[10px] font-semibold text-[#8a4a00]">disposition approximative</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className={`h-3.5 w-3.5 rounded-full ring-2 ring-black/40 ${platine.sousTension ? 'bg-[#ff2d2d] shadow-[0_0_10px_#ff2d2d]' : 'bg-[#5a1d1d]'}`} aria-hidden />
            <button type="button" role="switch" aria-checked={platine.sousTension} onClick={onInterrupteur} className={`rounded px-2 py-1 text-[11px] font-bold text-white ${platine.sousTension ? 'bg-[#2e7d32]' : 'bg-[#444]'}`}>
              {platine.sousTension ? 'I · marche' : 'O · arrêt'}
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 items-start gap-3">
          <Douille id="plat.consigne" couleur="vert" etiquette="Consigne" bornes={bornes} />
          <Douille id="plat.mesure" couleur="vert" etiquette="Mesure" bornes={bornes} />
          <Douille id="plat.erreur" couleur="jaune" etiquette="Erreur" bornes={bornes} />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 rounded bg-white/50 p-2">
          <div>
            <p className="text-[10px] font-semibold">Affichage G1</p>
            <div className="mt-0.5 flex items-center gap-1">
              <button type="button" className="rounded bg-[#333] px-1.5 text-white" aria-label="Diminuer G1" onClick={() => onReglage({ g1: Math.max(0, platine.g1 - 1) })}>
                −
              </button>
              <input
                aria-label="Affichage G1 (00 à 99)"
                type="number"
                min={0}
                max={au3('AFFICHAGE_G1_MAX')}
                value={platine.g1}
                onChange={(e) => onReglage({ g1: Math.max(0, Math.min(au3('AFFICHAGE_G1_MAX'), Math.round(Number(e.target.value) || 0))) })}
                className="w-12 rounded bg-[#111] px-1 text-center font-mono text-[#ff5b3a]"
              />
              <button type="button" className="rounded bg-[#333] px-1.5 text-white" aria-label="Augmenter G1" onClick={() => onReglage({ g1: Math.min(au3('AFFICHAGE_G1_MAX'), platine.g1 + 1) })}>
                +
              </button>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold">G2</p>
            <div className="mt-0.5 flex" role="radiogroup" aria-label="Sélecteur G2">
              {G2_CHOIX.map((g) => (
                <button key={g} type="button" role="radio" aria-checked={platine.g2 === g} onClick={() => onReglage({ g2: g })} className={`px-1.5 text-[11px] ring-1 ring-black/30 ${platine.g2 === g ? 'bg-[#333] text-white' : 'bg-white'}`}>
                  ×{g}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-1 text-[10px] text-[#3b3122]">
          K = G1 × G2 / 100 = <span className="font-mono font-semibold">{k.toString().replace('.', ',')}</span>
        </p>

        <div className="mt-3 flex justify-around">
          <div className="flex flex-col items-center gap-1">
            <Support nom="Z1" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <Support nom="Z2" />
          </div>
          <Douille id="plat.sortieG2" couleur="rouge" etiquette="Sortie G2 <25 mA" bornes={bornes} />
        </div>

        <div className="mt-4 grid grid-cols-4 items-start gap-2">
          <Douille id="plat.p12" couleur="rouge" etiquette="+12 V" bornes={bornes} />
          <Douille id="plat.m12" couleur="bleu" etiquette="−12 V" bornes={bornes} />
          <div className="col-span-2 rounded bg-white/50 p-1.5">
            <p className="text-center text-[10px] font-semibold">Ampli de courant (×1, &lt;1 A)</p>
            <div className="mt-1 flex justify-around">
              <Douille id="plat.ampliIn" couleur="vert" etiquette="Entrée" bornes={bornes} />
              <Douille id="plat.ampliOut" couleur="bleu" etiquette="Sortie" bornes={bornes} />
            </div>
          </div>
        </div>

        <div className="mt-3 flex justify-around">
          {(['plat.masse1', 'plat.masse2', 'plat.masse3', 'plat.masse4'] as const).map((id) => (
            <Douille key={id} id={id} couleur="noir" etiquette="Masse" bornes={bornes} />
          ))}
        </div>
      </div>
    </section>
  )
}
