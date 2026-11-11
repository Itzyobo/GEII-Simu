import type { Info3Hypothese } from '../../data/reference'

/** État affiché d'une hypothèse : « non vérifiée » tant que la séance n'a rien confirmé */
export const hypState = (h: Info3Hypothese) => (h.statut === 'vérifiée' ? 'vérifiée' : h.statut === 'partielle' ? 'partielle' : h.statut === 'réfutée' ? 'réfutée' : 'non vérifiée')
