interface ToggleProps {
  on: boolean
  onChange: (on: boolean) => void
  label: string
  disabled?: boolean
}

/** Interrupteur à glissière avec libellé (réglages de banc). */
export default function Toggle({ on, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="flex min-h-11 items-center gap-2 rounded-lg bg-card-2 px-2 py-1.5 text-sm ring-1 ring-line disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className={`relative h-5 w-9 shrink-0 rounded-full ring-1 ring-line ${on ? 'bg-accent' : 'bg-line'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  )
}
