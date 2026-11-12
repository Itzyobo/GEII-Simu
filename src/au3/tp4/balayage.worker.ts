import { balayageG1, type ConfigBalayage } from './attendus'

/** Worker de la Q5 : 100 simulations hors du fil principal (aucune image bloquée pendant la correction) */
self.onmessage = (e: MessageEvent<{ cle: string; config: ConfigBalayage }>) => {
  self.postMessage({ cle: e.data.cle, resultat: balayageG1(e.data.config) })
}
