import { useEffect, useState } from 'react'
import type { balayageG1, ConfigBalayage } from './attendus'

type Balayage = ReturnType<typeof balayageG1>
/** Résultats mémoïsés par configuration (Z1, Z2, G2, GBF), pour toute la session de la page */
const cache = new Map<string, Balayage>()

/** Balayage de la Q5 calculé dans un Worker, une fois par configuration ; null tant qu'il n'est pas prêt ou demandé */
export function useBalayage(config: ConfigBalayage, actif: boolean): Balayage | null {
  const cle = JSON.stringify(config)
  // Le cache est la source ; ce compteur force seulement un rendu quand le Worker répond
  const [, setRecu] = useState(0)
  useEffect(() => {
    if (!actif || cache.has(cle)) return
    const w = new Worker(new URL('./balayage.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<{ cle: string; resultat: Balayage }>) => {
      cache.set(e.data.cle, e.data.resultat)
      setRecu((n) => n + 1)
      w.terminate()
    }
    w.postMessage({ cle, config })
    return () => w.terminate()
  }, [cle, actif]) // eslint-disable-line react-hooks/exhaustive-deps -- `config` est entièrement décrit par `cle`
  return actif ? (cache.get(cle) ?? null) : null
}
