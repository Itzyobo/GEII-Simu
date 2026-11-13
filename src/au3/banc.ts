import type { ReglagesGbf } from './instruments/gbf'
import type { Curseurs, ReglagesOscillo } from './instruments/oscillo'
import { MASSES, MONTAGES, nomImpedance, reseaux, signature as signatureCablage, TOUTES_BORNES, verifier, type Borne, type Cable, type Cablage, type Montage, type MontageId, type Verdict } from './sim/cablage'
import type { ReglagesPlatine } from './sim/simulate'
import type { Impedance } from './sim/regulateur'
import type { EtatAmpli } from './sim/simulate'
import { sessionNeuve, type EvenementManip, type IncidentExamen, type ProgressionEssai, type ProgressionTp1, type SessionAu3, type TpExamen } from './session'

/**
 * Établi : règles de manipulation, en réducteur pur.
 * - Sous tension, toute modification de câble ou de composant est refusée, avec un message, et journalisée
 *   (« manip sous tension »). Seule exception (énoncé TP1, remarque après « Mettre sous tension ») : quand
 *   l'ampli de courant est bloqué, déplacer l'extrémité « masse » du câble de son entrée vers la source vérifiée.
 * - L'interrupteur reste bloqué tant que « Faire vérifier » n'a pas été demandé sur le câblage actuel
 *   (sauf procédure de déblocage exacte depuis la dernière vérification réussie : voir procedureExacte).
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
  | { type: 'reponse'; id: string; valeur: string; lectures?: number[] }
  /** Examen : démarrage (session neuve, incident appliqué), fin (réponses figées), effacement */
  | { type: 'demarrer-examen'; tp: TpExamen; graine: number; incident: IncidentExamen; duree: number }
  | { type: 'terminer-examen' }
  | { type: 'effacer-examen' }
  | { type: 'tp1'; patch: Partial<ProgressionTp1> }
  | { type: 'tp2'; essai: 'k38' | 'k40'; patch: Partial<ProgressionEssai> }
  | { type: 'effacer-message' }

export const MESSAGE_SOUS_TENSION = 'Platine sous tension : éteignez-la avant de modifier un câble ou un composant.'
export const MESSAGE_VERIFIER = 'Faites vérifier le câblage avant la mise sous tension.'
export const MESSAGE_AUTOSCALE = 'NE JAMAIS APPUYER SUR AUTOSCALE (fiche oscilloscope) : faute enregistrée.'

const modifieCablage = (a: Action) => a.type === 'ajouter-cable' || a.type === 'retirer-cable' || a.type === 'couleur-cable' || a.type === 'rebrancher' || a.type === 'remplacer-cablage' || a.type === 'composant'

const estMasse = (b: Borne) => MASSES.includes(b)
/** Câble « entrée de l'ampli de courant ↔ masse » */
const ampliAMasse = (c: Cable) => (c.a === 'plat.ampliIn' && estMasse(c.b)) || (c.b === 'plat.ampliIn' && estMasse(c.a))

export const ampliBloque = (etat: EtatAmpli) => etat !== 'normal'

/** Signature du banc vérifié : câblage + composants des supports Z1 et Z2 */
const signatureBanc = (cablage: Cablage, p: Pick<ReglagesPlatine, 'z1' | 'z2'>) => `${signatureCablage(cablage)}#Z1=${nomImpedance(p.z1)}#Z2=${nomImpedance(p.z2)}`

/** Câblage où l'extrémité `de` du câble `id` est rebranchée sur `vers` */
const rebranche = (cablage: Cablage, id: string, de: Borne, vers: Borne): Cable[] => cablage.map((c) => (c.id !== id ? c : c.a === de ? { ...c, a: vers } : c.b === de ? { ...c, b: vers } : c))

/**
 * Exception de l'énoncé (dernière étape de la procédure) : ampli bloqué, l'extrémité masse du câble de l'entrée
 * ampli est rebranchée sur la source vérifiée (GBF MAIN OUT au TP1, sortie G2 au TP2) : le câblage redevient
 * exactement celui de la dernière vérification.
 */
export function exceptionSousTension(s: SessionAu3, a: Action): boolean {
  if (a.type !== 'rebrancher' || !ampliBloque(s.platine.ampli)) return false
  const c = s.cablage.find((x) => x.id === a.id)
  return !!c && ampliAMasse(c) && estMasse(a.de) && s.verifieSur === signatureBanc(rebranche(s.cablage, a.id, a.de, a.vers), s.platine)
}

/**
 * Rallumage sans « Faire vérifier » (procédure de déblocage) : ampli bloqué, et la SEULE différence avec le câblage
 * de la dernière vérification réussie est « entrée ampli ↔ masse » à la place de « entrée ampli ↔ source ».
 */
export function procedureExacte(s: SessionAu3): boolean {
  if (!ampliBloque(s.platine.ampli) || s.verifieReussiSur === null) return false
  const attendu = s.verifieReussiSur
  return s.cablage.some((c) => {
    if (!ampliAMasse(c)) return false
    const masse = estMasse(c.a) ? c.a : c.b
    return TOUTES_BORNES.some((v) => !estMasse(v) && signatureBanc(rebranche(s.cablage, c.id, masse, v), s.platine) === attendu)
  })
}

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

  // Examen terminé : tout est figé (consultation seule), sauf l'effacement
  if (s.examen?.termine && a.type !== 'effacer-examen') return e

  if (modifieCablage(a) && s.platine.sousTension) {
    if (exceptionSousTension(s, a) && a.type === 'rebrancher') {
      const ampli: EtatAmpli = s.platine.ampli.startsWith('reamorce') ? 'normal' : s.platine.ampli
      return avec({ cablage: rebranche(s.cablage, a.id, a.de, a.vers), platine: { ...s.platine, ampli } })
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
    case 'rebrancher': {
      const c = s.cablage.find((x) => x.id === a.id)
      return c && c.a !== a.vers && c.b !== a.vers ? avec({ cablage: rebranche(s.cablage, a.id, a.de, a.vers) }) : e
    }
    case 'remplacer-cablage':
      return avec({ cablage: [...a.cablage] })
    case 'composant':
      return avec({ platine: { ...s.platine, [a.support]: a.z } })
    case 'faire-verifier': {
      const m: Montage = MONTAGES[e.montage]
      const verdict = verifier(s.cablage, m.liaisons, s.platine, m.impedances)
      const sig = signatureBanc(s.cablage, s.platine)
      // Un essai = « Faire vérifier » sur un câblage modifié depuis la vérification précédente
      const essais = sig === s.verifieSur ? s.essaisVerification : s.essaisVerification + 1
      return { ...avec({ verifieSur: sig, verifieReussiSur: verdict.reussi ? sig : s.verifieReussiSur, essaisVerification: essais, essaiReussi: s.essaiReussi ?? (verdict.reussi ? essais : null) }), verdict }
    }
    case 'interrupteur': {
      if (s.platine.sousTension) return avec({ platine: { ...s.platine, sousTension: false } })
      const verifie = s.verifieSur === signatureBanc(s.cablage, s.platine) || procedureExacte(s)
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
      return avec({ reponses: { ...s.reponses, [a.id]: { valeur: a.valeur, essais: (s.reponses[a.id]?.essais ?? 0) + 1, ...(a.lectures ? { lectures: a.lectures } : {}) } } }, e.message)
    case 'demarrer-examen': {
      const neuve = sessionNeuve('examen')
      const ampli = a.incident === 'ampli-bloque' ? 'bloque-haut' : 'normal'
      return { session: { ...neuve, chrono: { debut: maintenant, ecouleMs: 0 }, platine: { ...neuve.platine, ampli }, examen: { tp: a.tp, graine: a.graine, incident: a.incident, debut: maintenant, duree: a.duree, termine: false, finA: null } }, montage: a.tp, verdict: null, message: null }
    }
    case 'terminer-examen':
      return s.examen ? avec({ examen: { ...s.examen, termine: true, finA: maintenant }, platine: { ...s.platine, sousTension: false } }) : e
    case 'effacer-examen':
      return { session: sessionNeuve('examen'), montage: e.montage, verdict: null, message: null }
    case 'tp1':
      return avec({ tp1: { ...s.tp1, ...a.patch } }, e.message)
    case 'tp2':
      return avec({ tp2: { ...s.tp2, [a.essai]: { ...s.tp2[a.essai], ...a.patch } } }, e.message)
    case 'effacer-message':
      return { ...e, message: null }
  }
}
