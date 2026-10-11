import { useEffect, useRef } from 'react'
import { nextTick } from './scope'

/**
 * Rotation continue d'un groupe SVG (un tour en `period` s, sens `dir`), mise à jour à l'horloge commune
 * des animations : une animation CSS ferait tourner tout le rendu du navigateur à la fréquence de l'écran.
 * period ≤ 0 : arrêt, groupe remis à 0°.
 */
export function useSpin(period: number, dir: 1 | -1) {
  const ref = useRef<SVGGElement>(null)
  useEffect(() => {
    const g = ref.current!
    if (!(period > 0)) return
    const ms = period * 1000
    let id = 0
    const tick = () => {
      g.setAttribute('transform', `rotate(${(dir * 360 * (performance.now() % ms)) / ms})`)
      id = window.setTimeout(tick, nextTick())
    }
    tick()
    return () => {
      clearTimeout(id)
      g.removeAttribute('transform')
    }
  }, [period, dir])
  return ref
}
