/** Petits éléments communs aux pages Réseaux (TP1, TP3, partiel) */
import type { ReactNode } from 'react'

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-card bg-card p-4 ring-1 ring-line">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  )
}

export function Btn({ onClick, pressed, children, disabled }: { onClick: () => void; pressed?: boolean; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className={`min-h-11 rounded-lg px-3 text-sm ring-1 ring-line disabled:opacity-40 ${pressed ? 'bg-accent text-on-accent' : 'hover:ring-accent'}`}
    >
      {children}
    </button>
  )
}
