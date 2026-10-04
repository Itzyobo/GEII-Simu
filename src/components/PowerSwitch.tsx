interface PowerSwitchProps {
  on: boolean
  onToggle: (on: boolean) => void
  disabled?: boolean
  label?: string
  /** Raison affichée au survol quand l'interrupteur est grisé */
  disabledReason?: string
}

/** Interrupteur de mise sous tension avec voyant. */
export default function PowerSwitch({ on, onToggle, disabled, label = 'Mise sous tension', disabledReason }: PowerSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={() => onToggle(!on)}
      className="flex min-h-11 items-center gap-3 rounded-card bg-card-2 px-3 py-2 ring-1 ring-line transition disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className={`relative h-7 w-12 rounded-full ring-1 ring-black transition ${on ? 'bg-accent' : 'bg-[#15171a]'}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-ink shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
      <span className="text-sm font-medium">{label}</span>
      <span
        className={`h-2.5 w-2.5 rounded-full ${on ? 'bg-err shadow-[0_0_8px_2px_rgba(248,113,113,0.7)]' : 'bg-[#3a1d1d]'}`}
        aria-hidden
      />
    </button>
  )
}
