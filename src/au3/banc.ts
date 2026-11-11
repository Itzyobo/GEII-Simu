import type { ReglagesGbf } from './instruments/gbf'
import type { Curseurs, ReglagesOscillo } from './instruments/oscillo'
import { MONTAGES, signature, verifier, type Borne, type Cablage, type MontageId, type Verdict } from './sim/cablage'
import type { Impedance } from './sim/regulateur'
import type { EvenementManip, SessionAu3 } from './session'

/**
 * Établi : règles de manipulation, en réducteur pur.
 * - Sous tension, toute modification de câble ou de composant est refusée, avec un message, et journalisée
 *   (« manip sous tension »).
 * - L'interrupteur reste bloqué tant que « Faire vérifier » n'a pas été demandé sur le câblage actuel.
 * Les réglages (GBF, Affichage G1, G2, oscilloscope) restent libres, comme en salle.
 */
export interface EtatBanc {
  session: SessionAu3
  montage: MontageId
  verdict: Verdict | null
  message: string | null
}

export type Action =
  | { type: 'ajouter-cable'; a: Borne; b: Borne; couleur: string }
  | { type: 'retirer-cable'; id: string }
  | { type: 'couleur-cable'; id: string; couleur: string }
  | { type: 'remplacer-cablage'; cablage: Cablage }
  | { type: 'composant'; support: 'z1' | 'z2'; z: Impedance | null }
  | { type: 'faire-verifier' }
  | { type: 'interrupteur' }
  | { type: 'gbf'; patch: Partial<ReglagesGbf> }
  | { type: 'platine'; patch: { g1?: number; g2?: number } }
  | { type: 'oscillo'; patch: Partial<ReglagesOscillo> }
  | { type: 'curseurs'; patch: Partial<Curseurs> }
  | { type: 'autoscale' }
  | { type: 'effacer-message' }

export const MESSAGE_SOUS_TENSION = 'Platine sous tension : éteignez-la avant de modifier un câble ou un composant.'
export const MESSAGE_VERIFIER = 'Faites vérifier le câblage avant la mise sous tension.'
export const MESSAGE_AUTOSCALE = 'NE JAMAIS APPUYER SUR AUTOSCALE (fiche oscilloscope) : faute enregistrée.'

const modifieCablage = (a: Action) => a.type === 'ajouter-cable' || a.type === 'retirer-cable' || a.type === 'couleur-cable' || a.type === 'remplacer-cablage' || a.type === 'composant'

const decrire = (a: Action): string => {
  switch (a.type) {
    case 'ajouter-cable':
      return `ajout d’un câble ${a.a} — ${a.b}`
    case 'retirer-cable':
      return `retrait du câble ${a.id}`
    case 'couleur-cable':
      return `changement de câble ${a.id}`
    case 'remplacer-cablage':
      return 'remplacement du câblage'
    case 'composant':
      return `modification du support ${a.support.toUpperCase()}`
    default:
      return a.type
  }
}

export function reduire(e: EtatBanc, a: Action, maintenant: number): EtatBanc {
  const s = e.session
  const avec = (session: Partial<SessionAu3>, message: string | null = null): EtatBanc => ({ ...e, session: { ...s, ...session }, message })

  if (modifieCablage(a) && s.platine.sousTension) {
    const ev: EvenementManip = { instant: maintenant, type: 'manip-sous-tension', detail: decrire(a) }
    return avec({ evenementsSousTension: [...s.evenementsSousTension, ev] }, MESSAGE_SOUS_TENSION)
  }

  switch (a.type) {
    case 'ajouter-cable':
      if (a.a === a.b) return e
      return avec({ cablage: [...s.cablage, { id: `c${maintenant}-${s.cablage.length}`, a: a.a, b: a.b, couleur: a.couleur }] })
    case 'retirer-cable':
      return avec({ cablage: s.cablage.filter((c) => c.id !== a.id) })
    case 'couleur-cable':
      return avec({ cablage: s.cablage.map((c) => (c.id === a.id ? { ...c, couleur: a.couleur } : c)) })
    case 'remplacer-cablage':
      return avec({ cablage: [...a.cablage] })
    case 'composant':
      return avec({ platine: { ...s.platine, [a.support]: a.z } })
    case 'faire-verifier': {
      const verdict = verifier(s.cablage, MONTAGES[e.montage].liaisons)
      return { ...avec({ verifieSur: signature(s.cablage), essaisVerification: s.essaisVerification + 1 }), verdict }
    }
    case 'interrupteur':
      if (!s.platine.sousTension && s.verifieSur !== signature(s.cablage)) return avec({}, MESSAGE_VERIFIER)
      return avec({ platine: { ...s.platine, sousTension: !s.platine.sousTension } })
    case 'gbf':
      return avec({ gbf: { ...s.gbf, ...a.patch } }, e.message)
    case 'platine':
      return avec({ platine: { ...s.platine, ...a.patch } }, e.message)
    case 'oscillo':
      return avec({ oscillo: { ...s.oscillo, ...a.patch } }, e.message)
    case 'curseurs':
      return avec({ curseurs: { ...s.curseurs, ...a.patch } }, e.message)
    case 'autoscale':
      return avec({ fautes: [...s.fautes, { instant: maintenant, type: 'autoscale', detail: 'Autoscale' }] }, MESSAGE_AUTOSCALE)
    case 'effacer-message':
      return { ...e, message: null }
  }
}
