/**
 * Quiz de cours (PRD §2, partie D) : haute impédance et TX_EN, terminaison, polarisation, RS232 contre RS485.
 * Toutes les bonnes réponses chiffrées viennent de reference.ts ; chaque correction cite sa justification physique.
 */
import { REF, type RefKey } from './reference'
import type { AttenduId } from './attendus'
import { checkExact, checkValeur, type Verdict } from '../models/answers'

export type Theme = 'impedance' | 'longueur' | 'rs'

export interface QuestionCours {
  id: string
  theme: Theme
  /** Ligne de la note du partiel : RS232 / RS485 comptent dans « Longueur de câble » */
  attendu: Extract<AttenduId, 'impedance' | 'longueur'>
  enonce: string
  /** QCM : options ; sinon réponse numérique dans `unite` */
  options?: string[]
  unite?: string
  /** Bonne réponse : texte de l'option, ou nombre */
  bonne: string | number
  justification: string
  deps: RefKey[]
}

const fr = (n: number) => n.toLocaleString('fr-FR')

/** Bonne réponse affichée : option, ou nombre et unité */
export const bonneReponse = (q: QuestionCours) => (typeof q.bonne === 'number' ? `${fr(q.bonne)} ${q.unite ?? ''}`.trim() : q.bonne)

/** Correction d'une question de cours : verdict, bonne réponse et justification physique. */
export function corrigerCours(q: QuestionCours, v: string): Verdict {
  const base = typeof q.bonne === 'number' ? checkValeur(v, q.bonne) : checkExact(v, q.bonne)
  return { ...base, message: `${base.ok ? 'Juste' : `Faux : ${bonneReponse(q)}`}. ${q.justification}` }
}
const pF = REF.rs232Capacite.value * 1e12
const mV = REF.rs485Seuil.value * 1000

export const COURS: QuestionCours[] = [
  /* ── Impédance : haute impédance, terminaison, polarisation ── */
  {
    id: 'c-hz',
    theme: 'impedance',
    attendu: 'impedance',
    enonce: 'Quand TX_EN est à l’état bas, le driver DS3695 de la carte est…',
    options: ['à 0 V sur les deux fils', 'en haute impédance : il libère la paire', 'à 5 V sur TX+'],
    bonne: 'en haute impédance : il libère la paire',
    justification:
      'Le DS3695 est un driver à trois états. TX_EN bas le met en haute impédance : la même paire peut alors porter la réponse de l’esclave. C’est le retournement du bus, obligatoire en half duplex.',
    deps: [],
  },
  {
    id: 'c-terminaison-valeur',
    theme: 'impedance',
    attendu: 'impedance',
    enonce: 'Valeur de la résistance de terminaison placée à chaque extrémité d’une paire RS485',
    unite: 'Ω',
    bonne: REF.terminaisonOhms.value,
    justification: `${fr(REF.terminaisonOhms.value)} Ω, l’impédance caractéristique de la paire torsadée : l’onde arrivée en bout de ligne est absorbée au lieu d’être réfléchie. Chaque réflexion revient après un aller-retour, 2 × L × ${fr(REF.propagation.value * 1e9)} ns/m : au banc (≈ 20 ns pour 2 m), elle ne dépasse pas le temps de montée du driver et se noie dans le front : la ligne est électriquement courte. La terminaison devient nécessaire quand l’aller-retour dépasse nettement la durée des fronts.`,
    deps: ['terminaisonOhms', 'propagation'],
  },
  {
    id: 'c-terminaison-place',
    theme: 'impedance',
    attendu: 'impedance',
    enonce: 'Où place-t-on les résistances de terminaison ?',
    options: ['sur chaque esclave', 'aux deux extrémités de la paire', 'seulement côté maître'],
    bonne: 'aux deux extrémités de la paire',
    justification:
      'Une réflexion naît à chaque bout de ligne où l’impédance change. Il faut donc adapter les deux extrémités, et seulement elles : une résistance par esclave chargerait trop la ligne.',
    deps: ['terminaisonOhms'],
  },
  {
    id: 'c-polarisation',
    theme: 'impedance',
    attendu: 'impedance',
    enonce: 'À quoi sert la polarisation (failsafe) d’une paire RS485 ?',
    options: ['à adapter l’impédance de la ligne', REF.polarisationRole.value, 'à augmenter le débit'],
    bonne: REF.polarisationRole.value,
    justification: `Sans polarisation, une paire en haute impédance a un différentiel nul, sous le seuil de ± ${fr(mV)} mV : le récepteur lit des bits au hasard et l’analyseur affiche des caractères parasites. Les résistances de polarisation tirent TX+ au-dessus de TX− : repos = 1.`,
    deps: ['polarisationRole', 'rs485Seuil'],
  },
  {
    id: 'c-seuil',
    theme: 'impedance',
    attendu: 'impedance',
    enonce: 'Seuil de sensibilité d’un récepteur RS485 (valeur absolue)',
    unite: 'mV',
    bonne: mV,
    justification: `EIA-485 : au-dessus de +${fr(mV)} mV le récepteur lit un 1, en dessous de −${fr(mV)} mV un 0 ; entre les deux l’état est indéterminé.`,
    deps: ['rs485Seuil'],
  },

  /* ── Longueur de câble ── */
  {
    id: 'c-long-rs232',
    theme: 'longueur',
    attendu: 'longueur',
    enonce: 'Longueur maximale usuelle d’une liaison RS232',
    unite: 'm',
    bonne: REF.rs232Longueur.value,
    justification: `Environ ${fr(REF.rs232Longueur.value)} m : la norme limite la capacité du câble à ${fr(pF)} pF, et le signal est référencé à la masse, donc sensible aux écarts de potentiel et aux parasites.`,
    deps: ['rs232Longueur', 'rs232Capacite'],
  },
  {
    id: 'c-long-rs485',
    theme: 'longueur',
    attendu: 'longueur',
    enonce: 'Longueur maximale d’une liaison RS485 à bas débit',
    unite: 'm',
    bonne: REF.rs485Longueur.value,
    justification: `Environ ${fr(REF.rs485Longueur.value)} m jusqu’à ${fr(REF.rs485DebitLongueurMax.value / 1000)} kbit/s : la transmission différentielle rejette le mode commun et ne dépend pas de la masse de l’émetteur.`,
    deps: ['rs485Longueur', 'rs485DebitLongueurMax'],
  },
  {
    id: 'c-debit-longueur',
    theme: 'longueur',
    attendu: 'longueur',
    enonce: 'Sur une liaison RS485, quand la longueur du câble augmente, le débit maximal…',
    options: ['augmente', 'ne change pas', 'diminue'],
    bonne: 'diminue',
    justification:
      'La capacité et la résistance du câble croissent avec la longueur : les fronts s’arrondissent et s’atténuent, et un bit court finit par ne plus atteindre le seuil. Il faut donc ralentir quand on allonge.',
    deps: ['rs485DebitLongueurMax'],
  },
  {
    id: 'c-capacite',
    theme: 'longueur',
    attendu: 'longueur',
    enonce: 'Capacité de câble maximale admise par la norme RS232',
    unite: 'pF',
    bonne: pF,
    justification: `${fr(pF)} pF : au-delà, le driver ne charge plus le câble assez vite et les fronts se déforment. C’est cette capacité, donc la longueur, qui limite la liaison.`,
    deps: ['rs232Capacite'],
  },

  /* ── RS232 contre RS485 ── */
  {
    id: 'c-charges',
    theme: 'rs',
    attendu: 'longueur',
    enonce: 'Nombre de charges unitaires sur une même paire RS485',
    unite: 'charges',
    bonne: REF.rs485Charges.value,
    justification: `${fr(REF.rs485Charges.value)} charges unitaires : chaque récepteur, même au repos, consomme un peu de courant sur la paire, et les drivers sont dimensionnés pour cette charge totale.`,
    deps: ['rs485Charges'],
  },
  {
    id: 'c-masse',
    theme: 'rs',
    attendu: 'longueur',
    enonce: 'Quelle liaison transmet un niveau référencé à la masse ?',
    options: ['RS485', 'RS232'],
    bonne: 'RS232',
    justification: `RS232 : ${REF.rs232Liaison.value}. RS485 : ${REF.rs485Liaison.value} ; le récepteur lit TX+ − TX−, sans référence à la masse.`,
    deps: ['rs232Liaison', 'rs485Liaison'],
  },
  {
    id: 'c-multipoint',
    theme: 'rs',
    attendu: 'longueur',
    enonce: 'Laquelle permet de relier plusieurs esclaves sur la même paire ?',
    options: ['RS232', 'RS485'],
    bonne: 'RS485',
    justification: `RS485 est multipoint (jusqu’à ${fr(REF.rs485Charges.value)} charges) grâce aux drivers trois états ; RS232 est une liaison point à point entre deux équipements.`,
    deps: ['rs485Charges', 'rs232Liaison'],
  },
  {
    id: 'c-duplex',
    theme: 'rs',
    attendu: 'longueur',
    enonce: 'Pourquoi la carte a-t-elle besoin de TX_EN en RS485 à 2 fils ?',
    options: ['pour alimenter le driver', 'pour choisir le débit', 'la même paire sert à émettre et à recevoir : half duplex'],
    bonne: 'la même paire sert à émettre et à recevoir : half duplex',
    justification: `RS485 à 2 fils : ${REF.rs485Liaison.value}. RS232 est full duplex, TXD et RXD sont séparés et n’ont pas besoin de retournement.`,
    deps: ['rs485Liaison', 'rs232Liaison'],
  },
  {
    id: 'c-differentiel',
    theme: 'rs',
    attendu: 'longueur',
    enonce: 'Pourquoi RS485 résiste-t-il mieux aux parasites que RS232 ?',
    options: ['ses tensions sont plus élevées', 'le récepteur lit une différence : un parasite commun aux deux fils s’annule', 'son câble est plus court'],
    bonne: 'le récepteur lit une différence : un parasite commun aux deux fils s’annule',
    justification:
      'Les deux fils torsadés captent presque le même parasite (mode commun). Le récepteur lit TX+ − TX− : le parasite disparaît de la différence. Le bouton « parasite de mode commun » du banc le montre sur Math.',
    deps: ['rs485Liaison'],
  },
]
