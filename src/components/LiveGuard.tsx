import { useState } from 'react'
import { useExam } from '../lib/exam'

/**
 * Garde des modifications sous tension (barrettes, switches, montage) : refuse le changement,
 * affiche une alerte et compte une pénalité en examen.
 */
export function useLiveGuard(powered: boolean) {
  const exam = useExam()
  const [what, setWhat] = useState<string | null>(null)
  const guard = (label: string, action: () => void) => {
    if (!powered) return action()
    exam.penalize('live', `${label} : modification tentée sous tension`)
    setWhat(label)
  }
  const alert = what && (
    <div className="flex items-start gap-3 rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn ring-1 ring-warn/30" role="alert">
      <span className="flex-1">⚠ {what} : modification refusée sous tension. Coupez l’alimentation avant de modifier le montage.</span>
      <button type="button" onClick={() => setWhat(null)} className="min-h-11 px-2 text-xs underline">
        OK
      </button>
    </div>
  )
  return { guard, alert }
}
