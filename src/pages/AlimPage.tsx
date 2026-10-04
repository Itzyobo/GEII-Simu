import { useState } from 'react'
import { useSearchParams } from 'react-router'
import AlimPart1 from './AlimPart1'
import AlimPart2 from './AlimPart2'
import type { Tp } from './tps'

const TABS = [
  { id: 1, label: 'Partie 1 — Transfo d’impulsions' },
  { id: 2, label: 'Partie 2 — Flyback MAX17691B' },
] as const

/** TP alimentation à découpage isolée : deux onglets, chacun avec son banc et ses questions. */
export default function AlimPage({ tp }: { tp: Tp }) {
  const [params] = useSearchParams()
  // Lien « revoir » vers une question de la partie 2 : ouvrir directement le bon onglet
  const [tab, setTab] = useState<1 | 2>(() => (params.get('q')?.startsWith('alim2-') ? 2 : 1))
  const tabs = (
    <div role="tablist" className="flex gap-1 rounded-card bg-card p-1 ring-1 ring-line">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          onClick={() => setTab(t.id)}
          className={`min-h-11 rounded-lg px-3 py-1 text-sm ${tab === t.id ? 'bg-accent font-semibold text-[#1a1306]' : 'text-muted hover:text-ink'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
  return tab === 1 ? <AlimPart1 title={tp.title} tabs={tabs} /> : <AlimPart2 title={tp.title} tabs={tabs} />
}
