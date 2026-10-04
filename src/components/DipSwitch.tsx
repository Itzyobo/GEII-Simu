interface DipSwitchProps {
  /** true = ON (curseur en haut) */
  values: readonly boolean[]
  onChange: (values: boolean[]) => void
  /** Préfixe des repères (S1, S2…) */
  prefix?: string
}

/** Bloc de micro-switches rouge, comme sur le driver TB6600. */
export default function DipSwitch({ values, onChange, prefix = 'S' }: DipSwitchProps) {
  return (
    <div className="inline-flex flex-col items-center rounded-md bg-[#c0262d] px-2 pt-1 pb-1.5 shadow-inner ring-1 ring-black/40">
      <span className="self-start font-mono text-[10px] font-bold text-white/90">ON ▲</span>
      <div className="flex">
        {values.map((on, i) => (
          <button
            key={i}
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={`${prefix}${i + 1} ${on ? 'ON' : 'OFF'}`}
            onClick={() => onChange(values.map((v, k) => (k === i ? !v : v)))}
            className="flex h-12 w-11 items-center justify-center"
          >
            {/* Zone tactile 44 × 48 px autour du curseur dessiné */}
            <span className="relative h-10 w-5 rounded-sm bg-[#7d1418] ring-1 ring-black/50">
              <span className={`absolute left-0.5 h-4 w-4 rounded-[2px] bg-white shadow transition-all ${on ? 'top-0.5' : 'top-[22px]'}`} />
            </span>
          </button>
        ))}
      </div>
      <div className="mt-0.5 flex">
        {values.map((_, i) => (
          <span key={i} className="w-11 text-center font-mono text-[10px] font-bold text-white/90">
            {i + 1}
          </span>
        ))}
      </div>
    </div>
  )
}
