import { contexteTp3 } from '../examen/catalogue'
import { alleger } from './useContexte'

/** Worker du TP3 : simulations des réponses attendues hors du fil principal */
self.onmessage = () => {
  self.postMessage(alleger(contexteTp3()))
}
