import { au3 } from '../../data/reference'
import { MISE_EN_PAGE } from '../miseEnPage'
import type { FormeGbf, ReglagesGbf } from '../instruments/gbf'
import { Borne } from './Borne'
import { formatSi } from './format'
import type { PropsBornes } from './types'

const G = MISE_EN_PAGE.gbf
const FORMES: { id: FormeGbf; label: string; symbole: string }[] = [
  { id: 'carre', label: 'Carré', symbole: '⊓⊔' },
  { id: 'triangle', label: 'Triangle', symbole: '/\\/' },
]

function Champ({ label, valeur, unite, pas, min, max, onChange }: { label: string; valeur: number; unite: string; pas: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-au3-muted">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          step={pas}
          min={min}
          max={max}
          value={valeur}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)))
          }}
          className="w-20 rounded bg-field px-1.5 py-1 text-right font-mono text-au3-ink ring-1 ring-au3-line focus:ring-au3-accent"
        />
        <span className="w-6 text-au3-muted">{unite}</span>
      </span>
    </label>
  )
}

/** GBF TTi TG315 : afficheur de fréquence, boutons de forme enfonçables, amplitude, offset, atténuation 20 dB, MAIN OUT 50 Ω */
export default function Gbf({ gbf, onChange, bornes }: { gbf: ReglagesGbf; onChange: (p: Partial<ReglagesGbf>) => void; bornes: PropsBornes }) {
  return (
    <section aria-label="GBF TTi TG315" className="rounded-lg bg-[#d9d6cf] p-2 text-[#1d1d1d] shadow-lg">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold tracking-wider">TTi TG315 · FUNCTION GENERATOR</p>
        <label className="flex items-center gap-1 text-[11px]">
          <input type="checkbox" checked={gbf.attenuation} onChange={(e) => onChange({ attenuation: e.target.checked })} />
          −{au3('GBF_ATTENUATION_DB')} dB
        </label>
      </div>
      <div className="mt-1 flex items-stretch gap-2">
        <div className="flex-1 rounded bg-[#1b2a1b] px-2 py-1 font-mono text-[#7dff9a]" aria-live="polite">
          <p className="text-lg leading-tight">{gbf.forme === 'continu' ? 'DC' : formatSi(gbf.frequence, 'Hz', G.chiffres)}</p>
          <p className="text-[10px] text-[#7dff9a]/70">
            {gbf.forme === 'continu' ? `offset ${formatSi(gbf.offset, 'V', G.chiffres)}` : `${formatSi(gbf.vpp, 'Vpp', G.chiffres)} · offset ${formatSi(gbf.offset, 'V', G.chiffres)}`}
            {gbf.attenuation ? ' · −20 dB' : ''}
          </p>
        </div>
        <div className="flex flex-col gap-1" role="group" aria-label="Forme du signal">
          {FORMES.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={gbf.forme === f.id}
              title={`${f.label} (relâcher tous les boutons = tension continue)`}
              onClick={() => onChange({ forme: gbf.forme === f.id ? 'continu' : f.id })}
              className={`rounded px-2 py-0.5 font-mono text-[11px] ring-1 ring-black/30 ${gbf.forme === f.id ? 'translate-y-px bg-[#7a7a7a] text-white shadow-inner' : 'bg-[#efede8] shadow'}`}
            >
              {f.symbole}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 space-y-1 rounded bg-au3-panel-2 p-2 text-au3-ink">
        <Champ label="Fréquence" valeur={gbf.frequence} unite="Hz" pas={G.pasFreq} min={au3('GBF_FREQ_MIN')} max={au3('GBF_FREQ_MAX')} onChange={(frequence) => onChange({ frequence })} />
        <Champ label="Amplitude" valeur={gbf.vpp} unite="Vpp" pas={G.pasVpp} min={0} max={au3('GBF_VPP_MAX')} onChange={(vpp) => onChange({ vpp })} />
        <Champ label="Offset" valeur={gbf.offset} unite="V" pas={G.pasOffset} min={-au3('GBF_OFFSET_MAX')} max={au3('GBF_OFFSET_MAX')} onChange={(offset) => onChange({ offset })} />
      </div>
      <div className="mt-2 flex items-end justify-between">
        <label className="flex items-center gap-1 text-[11px]">
          <input type="checkbox" checked={gbf.sortie} onChange={(e) => onChange({ sortie: e.target.checked })} />
          OUTPUT ON
        </label>
        <Borne id="gbf.out" couleur="bnc" etiquette="MAIN OUT 50 Ω" choisie={bornes.choisie === 'gbf.out'} verrouillee={bornes.verrouillee} onClick={bornes.onBorne} />
      </div>
    </section>
  )
}
