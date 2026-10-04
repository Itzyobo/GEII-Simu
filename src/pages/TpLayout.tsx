import type { ReactNode } from 'react'
import { Link } from 'react-router'

interface TpLayoutProps {
  title: string
  /** Schéma de platine (gauche) */
  schematic: ReactNode
  /** Instruments de mesure (droite) */
  instruments: ReactNode
  /** Questions de l'énoncé (bas) */
  questions: ReactNode
  /** Onglets éventuels, affichés à droite du titre */
  tabs?: ReactNode
}

/** Mise en page commune des TP : schéma à gauche, instruments à droite, questions en bas. */
export default function TpLayout({ title, schematic, instruments, questions, tabs }: TpLayoutProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-5 flex flex-wrap items-baseline gap-4">
        <Link to="/" className="text-sm text-muted hover:text-accent">
          ← Accueil
        </Link>
        <h1 className="text-2xl font-bold">{title}</h1>
        {tabs}
      </header>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-label="Schéma de la platine" className="min-w-0 space-y-4">
          {schematic}
        </section>
        <section aria-label="Instruments" className="min-w-0 space-y-4">
          {instruments}
        </section>
      </div>
      <section aria-label="Questions" className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted">QUESTIONS</h2>
        {questions}
      </section>
    </div>
  )
}
