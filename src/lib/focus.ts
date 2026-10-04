import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'

/**
 * Question ciblée par l'URL (?q=id, lien « revoir » des résultats d'examen) :
 * renvoie true pour la mettre en évidence et la fait défiler à l'écran au montage.
 */
export function useQuestionFocus<T extends HTMLElement>(id: string) {
  const [params] = useSearchParams()
  const focused = params.get('q') === id
  const ref = useRef<T>(null)
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'center' })
  }, [focused])
  return { ref, focused }
}
