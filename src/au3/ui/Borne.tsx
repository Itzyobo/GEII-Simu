import { BORNES, type Borne as Id } from '../sim/cablage'

/** Couleur des douilles, d'après les photos du banc (bornes rouges / vertes / noires / jaunes / bleues) */
export type CouleurBorne = 'rouge' | 'vert' | 'noir' | 'jaune' | 'bleu' | 'bnc'
const STYLE: Record<CouleurBorne, string> = {
  rouge: 'bg-[#c62828] ring-[#ff8a80]',
  vert: 'bg-[#2e7d32] ring-[#9ccc65]',
  noir: 'bg-[#111] ring-[#777]',
  jaune: 'bg-[#f9c80e] ring-[#fff59d]',
  bleu: 'bg-[#1565c0] ring-[#90caf9]',
  bnc: 'bg-[#9aa0a6] ring-[#e0e0e0]',
}

/** Douille de câblage : 1er clic = choisir, 2e clic sur une autre borne = poser un câble */
export function Borne({ id, couleur, etiquette, choisie, verrouillee, onClick }: { id: Id; couleur: CouleurBorne; etiquette?: string; choisie: boolean; verrouillee: boolean; onClick: (id: Id) => void }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <button
        type="button"
        data-borne={id}
        aria-label={`${BORNES[id].appareil} · ${BORNES[id].nom}${verrouillee ? ' (sous tension : verrouillée)' : ''}`}
        aria-pressed={choisie}
        onClick={() => onClick(id)}
        className={`relative grid h-7 w-7 place-items-center rounded-full ring-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] transition ${STYLE[couleur]} ${choisie ? 'outline-2 outline-offset-2 outline-au3-accent' : ''} ${verrouillee ? 'opacity-60' : 'hover:scale-110'}`}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-black/70" aria-hidden />
        {verrouillee && (
          <span className="absolute -top-2 -right-2 text-[10px]" aria-hidden>
            🔒
          </span>
        )}
      </button>
      {etiquette && <span className="max-w-20 text-center text-[10px] leading-tight text-au3-muted">{etiquette}</span>}
    </span>
  )
}
