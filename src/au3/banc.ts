import type { ReglagesGbf } from './instruments/gbf'
import type { Curseurs, ReglagesOscillo } from './instruments/oscillo'
import { MASSES, MONTAGES, reseaux, signature, verifier, type Borne, type Cable, type Cablage, type MontageId, type Verdict } from './sim/cablage'
import type { Impedance } from './sim/regulateur'
import type { EtatAmpli } from './sim/simulate'
import type { EvenementManip, ProgressionTp1, SessionAu3 } from './session'

/**
 * Établi : règles de manipulation, en réducteur pur.
 * - Sous tension, toute modification de câble ou de composant est refusée, avec un message, et journalisée
 *   (« manip sous tension »). Seule exception (énoncé TP1, remarque après « Mettre sous tension ») : quand
 *   l'ampli de courant est bloqué, déplacer l'extrémité « masse » du câble de son entrée vers GBF MAIN OUT.
 * - L'interrupteur reste bloqué tant que « Faire vérifier » n'a pas été demandé sur le câblage actuel
 *   (la procédure de déblocage, qui met l'entrée de l'ampli à la masse, ne demande pas de nouvelle vérification).
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
  /** Débrancher une extrémité `de` du câble et la rebrancher sur `vers` */
  | { type: 'rebrancher'; id: string; de: Borne; vers: Borne }
  | { type: 'remplacer-cablage'; cablage: Cablage }
  | { type: 'composant'; support: 'z1' | 'z2'; z: Impedance | null }
  | { type: 'faire-verifier' }
  | { type: 'interrupteur' }
  /** Variante de l'enseignant : ampli de courant bloqué (sortie collée à +USAT ou 0 V) ou normal */
  | { type: 'variante-ampli'; etat: 'normal' | 'bloque-haut' | 'bloque-zero' }
  | { type: 'gbf'; patch: Partial<ReglagesGbf> }
  | { type: 'platine'; patch: { g1?: number; g2?: number } }
  | { type: 'oscillo'; patch: Partial<ReglagesOscillo> }
  | { type: 'curseurs'; patch: Partial<Curseurs> }
  | { type: 'autoscale' }
  /** Réponse saisie à une question (le nombre d'essais compte les validations) */
  | { type: 'reponse'; id: string; valeur: string }
  | { type: 'tp1'; patch: Partial<ProgressionTp1> }
  | { type: 'effacer-message' }

export const MESSAGE_SOUS_TENSION = 'Platine sous tension : éteignez-la avant de modifier un câble ou un composant.'
export const MESSAGE_VERIFIER = 'Faites vérifier le câblage avant la mise sous tension.'
export const MESSAGE_AUTOSCALE = 'NE JAMAIS APPUYER SUR AUTOSCALE (fiche oscilloscope) : faute enregistrée.'

const modifieCablage = (a: Action) => a.type === 'ajouter-cable' || a.type === 'retirer-cable' || a.type === 'couleur-cable' || a.type === 'rebrancher' || a.type === 'remplacer-cablage' || a.type === 'composant'

const estMasse = (b: Borne) => MASSES.includes(b)
/** Câble « entrée de l'ampli de courant ↔ masse » */
const ampliAMasse = (c: Cable) => (c.a === 'plat.ampliIn' && estMasse(c.b)) || (c.b === 'plat.ampliIn' && estMasse(c.a))

export const ampliBloque = (etat: EtatAmpli) => etat !== 'normal'

/** Exception de l'énoncé : ampli bloqué, extrémité masse du câble de l'entrée ampli déplacée vers GBF MAIN OUT */
export function exceptionSousTension(s: SessionAu3, a: Action): boolean {
  if (a.type !== 'rebrancher' || !ampliBloque(s.platine.ampli)) return false
  const c = s.cablage.find((x) => x.id === a.id)
  return !!c && ampliAMasse(c) && estMasse(a.de) && a.vers === 'gbf.out'
}

/** Câblage de la procédure ramené au montage : la masse de l'entrée ampli remplacée par GBF MAIN OUT */
const sansProcedure = (cablage: Cablage): Cablage => cablage.map((c) => (ampliAMasse(c) ? { ...c, a: 'plat.ampliIn', b: 'gbf.out' } : c))

const decrire = (a: Action): string => {
  switch (a.type) {
    case 'ajouter-cable':
      return `ajout d’un câble ${a.a} — ${a.b}`
    case 'retirer-cable':
      return `retrait du câble ${a.id}`
    case 'couleur-cable':
      return `changement de câble ${a.id}`
    case 'rebrancher':
      return `câble ${a.id} déplacé de ${a.de} vers ${a.vers}`
    case 'remplacer-cablage':
      return 'remplacement du câblage'
    case 'composant':
      return `modification du support ${a.support.toUpperCase()}`
    default:
      return a.type
  }
}

/** À la mise sous tension, un ampli non normal se réamorce si son entrée est à la masse, sinon il reste (ou redevient) bloqué */
function allumerAmpli(etat: EtatAmpli, cablage: Cablage): EtatAmpli {
  if (etat === 'normal') return etat
  const r = reseaux(cablage)
  const sortie = etat === 'bloque-haut' || etat === 'reamorce-haut' ? 'haut' : 'zero'
  return r.de('plat.ampliIn') === r.masse ? `reamorce-${sortie}` : `bloque-${sortie}`
}

export function reduire(e: EtatBanc, a: Action, maintenant: number): EtatBanc {
  const s = e.session
  const avec = (session: Partial<SessionAu3>, message: string | null = null): EtatBanc => ({ ...e, session: { ...s, ...session }, message })

  if (modifieCablage(a) && s.platine.sousTension) {
    if (exceptionSousTension(s, a) && a.type === 'rebrancher') {
      const ampli: EtatAmpli = s.platine.ampli.startsWith('reamorce') ? 'normal' : s.platine.ampli
      return avec({ cablage: s.cablage.map((c) => (c.id === a.id ? { ...c, ...(c.a === a.de ? { a: a.vers } : { b: a.vers }) } : c)), platine: { ...s.platine, ampli } })
    }
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
    case 'rebrancher':
      return avec({ cablage: s.cablage.map((c) => (c.id !== a.id ? c : c.a === a.de && c.b !== a.vers ? { ...c, a: a.vers } : c.b === a.de && c.a !== a.vers ? { ...c, b: a.vers } : c)) })
    case 'remplacer-cablage':
      return avec({ cablage: [...a.cablage] })
    case 'composant':
      return avec({ platine: { ...s.platine, [a.support]: a.z } })
    case 'faire-verifier': {
      const verdict = verifier(s.cablage, MONTAGES[e.montage].liaisons)
      return { ...avec({ verifieSur: signature(s.cablage), essaisVerification: s.essaisVerification + 1 }), verdict }
    }
    case 'interrupteur': {
      if (s.platine.sousTension) return avec({ platine: { ...s.platine, sousTension: false } })
      const verifie = s.verifieSur === signature(s.cablage) || (ampliBloque(s.platine.ampli) && s.verifieSur === signature(sansProcedure(s.cablage)))
      if (!verifie) return avec({}, MESSAGE_VERIFIER)
      return avec({ platine: { ...s.platine, sousTension: true, ampli: allumerAmpli(s.platine.ampli, s.cablage) } })
    }
    case 'variante-ampli':
      return avec({ platine: { ...s.platine, ampli: a.etat } }, e.message)
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
    case 'reponse':
      return avec({ reponses: { ...s.reponses, [a.id]: { valeur: a.valeur, essais: (s.reponses[a.id]?.essais ?? 0) + 1 } } }, e.message)
    case 'tp1':
      return avec({ tp1: { ...s.tp1, ...a.patch } }, e.message)
    case 'effacer-message':
      return { ...e, message: null }
  }
}
