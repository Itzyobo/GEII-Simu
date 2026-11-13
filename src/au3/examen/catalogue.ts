import { au3 } from '../../data/reference'
import { facteurAttenuation, GBF_DEFAUT } from '../instruments/gbf'
import { MISE_EN_PAGE } from '../miseEnPage'
import type { SessionAu3 } from '../session'
import { gainAffichage, polynomeBoucle, regulateur, routhStable } from '../sim/regulateur'
import { BANC_REEL } from '../sim/simulate'
import { afficher, fenetreDeCsv, nombre, valeurDe } from '../tp1/affichage'
import { attendusTp1 } from '../tp1/attendus'
import { corriger, corrigerAbsolu, corrigerTr5, valeursTr5, type Correction } from '../tp1/correction'
import { partNonExpliquee, penteMesure, penteOrigine, residus } from '../tp1/identification'
import { attenduQ12, attendusTp2, essaiK38, essaiK40, theoriqueBf, type AttendusTp2 } from '../tp2/attendus'
import { corrigerFormule } from '../tp2/correction'
import { AFFICHAGE_TP4, attendusTp4, balayageG1, essaiTp4, gbfTp4, respecte, scenarioII, type ConfigBalayage } from '../tp4/attendus'
import { corrigerG1 } from '../tp4/correction'

/**
 * Réponses attendues de chaque question, une seule source pour la page d'entraînement ET la correction de l'examen :
 * chaque champ (« id » ou « id#partie ») porte sa valeur attendue calculée par le modèle (jamais en dur), sa
 * tolérance et sa fonction de correction ; chaque question qualitative porte son choix attendu.
 */
export interface ChampDef {
  id: string
  unite: string
  attendu: number | null
  /** Tolérance relative affichée (null : correction particulière) */
  tolerance: number | null
  /** Valeur attendue lisible (« 12,15 ms », « une valeur de 10 à 65 ») et formule éventuelle */
  texte: string
  corriger: (saisie: string, lectures?: readonly number[]) => Correction
}
export interface OuverteDef {
  id: string
  choix: readonly string[]
  attendu: string | null
  /** Justification courte, pour la liste des questions non traitées */
  texte: string
}
export interface Catalogue {
  champs: Record<string, ChampDef>
  ouvertes: Record<string, OuverteDef>
}

const TOL_M = () => au3('TOL_MESURE')
const TOL_A = () => au3('TOL_ABAQUE')
const PC = MISE_EN_PAGE.pourcent
export const OUI_NON = ['Oui', 'Non'] as const
export const ORDRES = ['Ordre 1', 'Ordre 2'] as const

/** Mémoïsation des simulations coûteuses par entrée (la page recalcule le contexte à chaque action) */
const memoire = new Map<string, unknown>()
function memo<T>(cle: string, f: () => T): T {
  if (!memoire.has(cle)) {
    if (memoire.size > au3('AFFICHAGE_G1_MAX')) memoire.clear()
    memoire.set(cle, f())
  }
  return memoire.get(cle) as T
}

const champ = (id: string, unite: string, attendu: number | null, tolerance: number, formule = ''): ChampDef => ({
  id,
  unite,
  attendu,
  tolerance,
  texte: `${afficher(attendu, unite)}${formule ? ` (${formule})` : ''}`,
  corriger: (saisie) => corriger(saisie, attendu ?? NaN, unite, tolerance),
})
/** TR5% : lectures de la trace affichée au moment de la réponse (corrections de l'étape 4) */
const champTr5 = (id: string, attendu: number | null): ChampDef => ({
  id,
  unite: 's',
  attendu,
  tolerance: au3('TOL_MESURE'),
  texte: `${afficher(attendu, 's')} (dernier franchissement de la bande ±5 % sur la trace sans bruit${MARQUE_TR5})`,
  corriger: (saisie, lectures) => corrigerTr5(saisie, attendu ?? NaN, lectures),
})
const pourcentAbsolu = (id: string, attendu: number): ChampDef => ({
  id,
  unite: '%',
  attendu: attendu * PC,
  tolerance: null,
  texte: `${nombre(attendu * PC)} % (tolérance ±${nombre(au3('TP4_ERREUR_MAX') * PC)} point)`,
  corriger: (saisie) => corrigerAbsolu(saisie, attendu * PC, '%', au3('TP4_ERREUR_MAX') * PC),
})
/** Repère des champs TR5% (affichage d'une ou deux lectures) */
const MARQUE_TR5 = ' ; ou sur votre trace affichée'
const ouverte = (id: string, choix: readonly string[], attendu: string | null, texte: string): OuverteDef => ({ id, choix, attendu, texte })
const cat = (champs: ChampDef[], ouvertes: OuverteDef[]): Catalogue => ({ champs: Object.fromEntries(champs.map((c) => [c.id, c])), ouvertes: Object.fromEntries(ouvertes.map((o) => [o.id, o])) })

/** Valeurs du fit comparées aux réponses de l'étudiant : « Oui » si toutes dans la tolérance, null si incomplet */
export const memes = (lignes: readonly { a: number | null | undefined; b: number | null; tol: number }[]) =>
  lignes.some((l) => l.a == null || l.b === null) ? null : lignes.every((l) => Math.abs(l.a! / l.b! - 1) <= l.tol) ? 'Oui' : 'Non'

/* ───────────── TP1 ───────────── */

export function contexteTp1(s: SessionAu3) {
  const att = memo(`tp1:${JSON.stringify(s.gbf)}`, () => attendusTp1(s.gbf))
  const v = (id: string, unite: string) => valeurDe(s, id, unite)
  const fen = fenetreDeCsv(s.tp1.csv)
  const o1 = s.tp1.ordre1
  const o2 = s.tp1.ordre2
  const pente1 = fen && o1 ? penteOrigine(fen, o1) : null
  const penteMes = fen && o1 ? penteMesure(fen, o1.tau!) : null
  const tangenteH = pente1 !== null && penteMes !== null ? Math.abs(penteMes) < pente1 / 2 : null
  const meilleurOrdre = o1 && o2 ? (o2.critere < o1.critere ? ORDRES[1] : ORDRES[0]) : null
  const l12 = [
    { nom: 'G0', a: o1?.g0, b: v('tp1-i21-g0', ''), tol: TOL_M() },
    { nom: 'τ (s)', a: o1?.tau, b: v('tp1-i21-q3', 's'), tol: TOL_M() },
  ]
  const lo2 = [
    { nom: 'G0', a: o2?.g0, b: v('tp1-i22-q1', ''), tol: TOL_M() },
    { nom: 'z', a: o2?.z, b: v('tp1-i22-q2', ''), tol: TOL_A() },
    { nom: 'ωn (rad/s)', a: o2?.wn, b: v('tp1-i22-q3', 'rad/s'), tol: TOL_A() },
  ]
  return { att, fen, o1, o2, pente1, penteMes, tangenteH, meilleurOrdre, l12, lo2 }
}

export function catalogueTp1(c: ReturnType<typeof contexteTp1>): Catalogue {
  const { att } = c
  const sansFit = 'Dépend de votre identification moindres carrés (non faite).'
  return cat(
    [
      champ('tp1-numeros#moteur', '', au3('NUMERO_MOTEUR'), 0),
      champ('tp1-numeros#poste', '', au3('NUMERO_POSTE'), 0),
      champ('tp1-i21-q1', 'V', att.dm, TOL_M(), 'm(∞) = ΔY sur la voie 2'),
      champ('tp1-i21-q2', 'V', att.du, TOL_M(), 'U0 = ΔY sur la voie 1'),
      champ('tp1-i21-g0', '', att.g0, TOL_M(), 'G0 = m(∞)/U0'),
      champ('tp1-i21-q3', 's', att.tau, TOL_M(), 'à 0,632·m(∞)'),
      champ('tp1-i21-g1#g0', '', att.g0, TOL_M()),
      champ('tp1-i21-g1#tau', 's', att.tau, TOL_M()),
      champ('tp1-i21-q4#seuil', 'V', au3('NIVEAU_TR5') * att.dm, TOL_M(), '0,95·m(∞)'),
      champTr5('tp1-i21-q4', att.tr5),
      champ('tp1-i22-q1', '', att.g0, TOL_M()),
      champ('tp1-i22-q2#t1', 's', att.t1, TOL_M(), 'à 26,4 % de m(∞)'),
      champ('tp1-i22-q2#t3', 's', att.t3, TOL_M(), 'à 80,1 % de m(∞)'),
      champ('tp1-i22-q2#rapport', '', att.rapport, TOL_M()),
      champ('tp1-i22-q2', '', att.z, TOL_A(), 'abaque t3/t1'),
      champ('tp1-i22-q3#wnt3', '', att.wnT3, TOL_A(), 'abaque ωn·t3'),
      champ('tp1-i22-q3', 'rad/s', att.wn, TOL_A(), 'ωn = (ωn·t3)/t3'),
      champ('tp1-i22-g2#g0', '', att.g0, TOL_M()),
      champ('tp1-i22-g2#z', '', att.z, TOL_A()),
      champ('tp1-i22-g2#wn', 'rad/s', att.wn, TOL_A()),
      champTr5('tp1-i22-q4', att.tr5),
    ],
    [
      ouverte('tp1-i23-q11', OUI_NON, c.tangenteH === null ? null : c.tangenteH ? 'Non' : 'Oui', c.tangenteH === null ? sansFit : 'Non : le 1er ordre démarre avec une pente G0·ΔU/τ non nulle, la mesure avec une tangente horizontale.'),
      ouverte('tp1-i23-q12', OUI_NON, memes(c.l12), c.o1 ? 'Comparer G0 et τ du fit à vos mesures (±5 %).' : sansFit),
      ouverte('tp1-i23-o2-q1', OUI_NON, c.o2 ? (c.o1 && c.o2.critere >= c.o1.critere ? 'Non' : 'Oui') : null, c.o2 ? 'Oui : tangente horizontale et même valeur finale que la mesure.' : sansFit),
      ouverte('tp1-i23-o2-q2', OUI_NON, memes(c.lo2), c.o2 ? 'Comparer G0 (±5 %), z et ωn (±10 %) du fit à vos lectures.' : sansFit),
      ouverte('tp1-conclusion', ORDRES, c.meilleurOrdre, c.meilleurOrdre ? `${c.meilleurOrdre} : plus petit critère des moindres carrés et tangente horizontale.` : sansFit),
      ouverte('tp1-deviner', OUI_NON, c.tangenteH === null ? null : c.tangenteH ? 'Oui' : 'Non', 'Oui : la tangente à l’origine de la réponse à un échelon est horizontale, donc l’ordre est au moins 2.'),
    ],
  )
}

/* ───────────── TP2 ───────────── */

const K38 = () => gainAffichage(au3('TP2_K38_G1'), au3('TP2_K38_G2'))
const K40 = () => gainAffichage(au3('TP2_K40_G1'), au3('TP2_K40_G2'))

/** Valeurs TP1 de l'étudiant (G0, z, ωn) si sa session TP1 les contient, sinon réponses attendues du TP1 */
export function valeursTp1(t: SessionAu3 | null) {
  const v = (id: string, u: string) => (t ? valeurDe(t, id, u) : null)
  const att = memo(`tp1:${JSON.stringify(t?.gbf ?? GBF_DEFAUT)}`, () => attendusTp1(t?.gbf ?? GBF_DEFAUT))
  const g0 = v('tp1-i22-q1', '') ?? v('tp1-i21-g0', '')
  const z = v('tp1-i22-q2', '')
  const wn = v('tp1-i22-q3', 'rad/s')
  return g0 !== null && z !== null && wn !== null ? { g0, z, wn, source: 'vos réponses du TP1' } : { g0: att.g0, z: att.z!, wn: att.wn!, source: 'les réponses attendues du TP1 (vos réponses du TP1 sont incomplètes)' }
}

export function contexteTp2(s: SessionAu3, sessionTp1: SessionAu3 | null) {
  const K = gainAffichage(s.platine.g1, s.platine.g2)
  const carre = s.gbf.forme === 'carre' && s.gbf.sortie
  const vpp = s.gbf.vpp * facteurAttenuation(s.gbf)
  // Réponses attendues : réglages de l'étudiant quand le K actuel est celui de l'essai, sinon ceux de l'énoncé
  const v38 = carre && K === K38() ? vpp : au3('TP2_K38_GBF_VPP')
  const v40 = carre && K === K40() ? vpp : au3('TP2_K40_GBF_VPP')
  const a38: AttendusTp2 = memo(`k38:${v38}`, () => attendusTp2(essaiK38(v38)))
  const a40: AttendusTp2 = memo(`k40:${v40}`, () => attendusTp2(essaiK40(v40)))
  const tp1 = valeursTp1(sessionTp1)
  const th = theoriqueBf(K38(), tp1.g0, tp1.z, tp1.wn)
  const v = (id: string, unite: string) => valeurDe(s, id, unite)
  const f38 = fenetreDeCsv(s.tp2.k38.csv)
  const f40 = fenetreDeCsv(s.tp2.k40.csv)
  const o38 = s.tp2.k38.ordre2
  const o40 = s.tp2.k40.ordre2
  const q12 = o38 ? attenduQ12(o38.z!, o38.wn!) : null
  const superpose = (f: typeof f38, r: typeof o38) => (f && r ? (partNonExpliquee(f, r) < au3('SUPERPOSITION_MAX') ? 'Oui' : 'Non') : null)
  const res40 = f40 && o40 ? residus(f40, o40) : null
  const id38 = { g0b: v('tp2-i11-q4', ''), zb: v('tp2-i11-q6', ''), wnb: v('tp2-i11-q7', 'rad/s') }
  const id40 = { g0b: v('tp2-i21-q4', ''), zb: v('tp2-i21-q8', ''), wnb: v('tp2-i21-q10', 'rad/s') }
  const lTh = [
    { nom: 'G0b', a: id38.g0b, b: th.g0b, tol: TOL_M() },
    { nom: 'zb', a: id38.zb, b: th.zb, tol: TOL_A() },
    { nom: 'ωnb (rad/s)', a: id38.wnb, b: th.wnb, tol: TOL_A() },
  ]
  const lFit38 = [
    { nom: 'G0b', a: o38?.g0, b: id38.g0b, tol: TOL_M() },
    { nom: 'zb', a: o38?.z, b: id38.zb, tol: TOL_A() },
    { nom: 'ωnb (rad/s)', a: o38?.wn, b: id38.wnb, tol: TOL_A() },
  ]
  const lFit40 = [
    { nom: 'G0b', a: o40?.g0, b: id40.g0b, tol: TOL_M() },
    { nom: 'zb', a: o40?.z, b: id40.zb, tol: TOL_M() },
    { nom: 'ωnb (rad/s)', a: o40?.wn, b: id40.wnb, tol: TOL_M() },
  ]
  const erreurNonNulle = (a: AttendusTp2) => Math.abs(a.dm / a.c0 - 1) > TOL_M()
  const theo40 = theoriqueBf(K40(), tp1.g0, tp1.z, tp1.wn).g0b
  const ecartStatique = (a: AttendusTp2) => 1 - a.g0b
  return { K, vpp, a38, a40, tp1, th, f38, f40, o38, o40, q12, superpose, res40, id38, id40, lTh, lFit38, lFit40, erreurNonNulle, theo40, ecartStatique }
}

export const Q12_CHOIX = ['Sans objet (zb < 1 : pôles complexes)', 'Oui, l’une est négligeable', 'Non, aucune n’est négligeable'] as const
export const LES_K = ['K = 3,8', 'K = 40'] as const
export const DIFFERENCES = ['Au démarrage', 'En régime permanent'] as const
export const MEMES_VALEURS = ['Mêmes valeurs', 'Valeurs différentes'] as const
export const MEME_TR5 = ['Le même', 'Différent'] as const

export function catalogueTp2(c: ReturnType<typeof contexteTp2>): Catalogue {
  const { a38, a40, th, q12 } = c
  const sansFit = 'Dépend de votre identification moindres carrés (non faite).'
  const m38 = memes(c.lTh)
  return cat(
    [
      champ('tp2-i11-q2', 'V', a38.dm, TOL_M(), 'ΔY sur la voie 2'),
      champ('tp2-i11-q3', 'V', a38.c0, TOL_M(), 'ΔY sur la voie 1'),
      champ('tp2-i11-q4', '', a38.g0b, TOL_M(), 'G0b = m(∞)/C0'),
      champ('tp2-i11-q6#t1', 's', a38.t1, TOL_M(), 'à 26,4 % de m(∞)'),
      champ('tp2-i11-q6#t3', 's', a38.t3, TOL_M(), 'à 80,1 % de m(∞)'),
      champ('tp2-i11-q6#rapport', '', a38.rapport, TOL_M()),
      champ('tp2-i11-q6', '', a38.zbAbaque, TOL_A(), 'abaque t3/t1'),
      champ('tp2-i11-q7#wnt3', '', a38.wnT3, TOL_A(), 'abaque ωn·t3'),
      champ('tp2-i11-q7', 'rad/s', a38.wnbAbaque, TOL_A(), 'ωnb = (ωn·t3)/t3'),
      champ('tp2-i11-gb2#g0b', '', a38.g0b, TOL_M()),
      champ('tp2-i11-gb2#zb', '', a38.zbAbaque, TOL_A()),
      champ('tp2-i11-gb2#wnb', 'rad/s', a38.wnbAbaque, TOL_A()),
      champ('tp2-i11-q8#g0b', '', th.g0b, TOL_M(), 'KG0/(1+KG0)'),
      champ('tp2-i11-q8#zb', '', th.zb, TOL_M(), 'z/√(1+KG0)'),
      champ('tp2-i11-q8#wnb', 'rad/s', th.wnb, TOL_M(), 'ωn·√(1+KG0)'),
      champ('tp2-i11-q10#seuil', 'V', au3('NIVEAU_TR5') * a38.dm, TOL_M(), '0,95·m(∞)'),
      champTr5('tp2-i11-q10', a38.tr5),
      champ('tp2-i12-q12#tau1', 's', q12?.tau1 ?? null, TOL_M(), '1/(ωnb(zb + √(zb²−1)))'),
      champ('tp2-i12-q12#tau2', 's', q12?.tau2 ?? null, TOL_M(), '1/(ωnb(zb − √(zb²−1)))'),
      champ('tp2-i21-q2', 'V', a40.c0, TOL_M(), 'ΔY sur la voie 1'),
      champ('tp2-i21-q3', 'V', a40.dm, TOL_M(), 'ΔY sur la voie 2'),
      champ('tp2-i21-q4', '', a40.g0b, TOL_M(), 'G0b = m(∞)/C0'),
      champ('tp2-i21-q6', 'V', a40.d1, TOL_M(), 'pic − m(∞)'),
      champ('tp2-i21-q7', '', a40.d1rel, TOL_M()),
      { ...champ('tp2-i21-q8', '', a40.zbFormule, TOL_A(), 'zb = −ln(D1/m∞)/√(π² + ln²(D1/m∞)), ou abaque'), corriger: (saisie) => corrigerFormule(saisie, a40.zbFormule ?? NaN) },
      champ('tp2-i21-q9', 's', a40.tpb2, TOL_M(), 'instant du 1er pic'),
      champ('tp2-i21-q10', 'rad/s', a40.wnbFormule, TOL_M(), 'ωnb = 2π/(Tpb·√(1 − zb²))'),
      champ('tp2-i21-q12#bas', 'V', au3('NIVEAU_TR5') * a40.dm, TOL_M(), '0,95·m(∞)'),
      champ('tp2-i21-q12#haut', 'V', (2 - au3('NIVEAU_TR5')) * a40.dm, TOL_M(), '1,05·m(∞)'),
      champTr5('tp2-i21-q12', a40.tr5),
    ],
    [
      ouverte('tp2-i1-ordre', ORDRES, a38.penteRelative < 1 / 2 ? ORDRES[1] : ORDRES[0], 'Ordre 2 : tangente à l’origine horizontale, comme au TP1.'),
      ouverte('tp2-i11-q1', OUI_NON, c.erreurNonNulle(a38) ? 'Non' : 'Oui', `Non : m(∞) = ${afficher(a38.dm, 'V')} pour C0 = ${afficher(a38.c0, 'V')}.`),
      ouverte('tp2-i11-q9', MEMES_VALEURS, m38 === null ? null : m38 === 'Oui' ? MEMES_VALEURS[0] : MEMES_VALEURS[1], 'Valeurs différentes : le frottement sec réduit le gain apparent en petite amplitude.'),
      ouverte('tp2-i12-q9', OUI_NON, memes(c.lFit38), c.o38 ? 'Comparer G0b (±5 %), zb et ωnb (±10 %) du fit à vos lectures.' : sansFit),
      ouverte('tp2-i12-q10', OUI_NON, c.superpose(c.f38, c.o38), c.o38 ? 'Oui : moins de 1 % de la mesure reste inexpliquée.' : sansFit),
      ouverte('tp2-i12-q11', OUI_NON, c.superpose(c.f38, c.o38), c.o38 ? 'Oui : démarrage et valeur finale suivis.' : sansFit),
      ouverte('tp2-i12-q12', Q12_CHOIX, q12?.choix ?? null, q12 ? (q12.tau1 === null ? 'Sans objet : zb < 1, pôles complexes.' : `τ = 1/(ωnb(zb ∓ √(zb² − 1))) ; rapport < ${au3('RAPPORT_NEGLIGEABLE')} : aucune n’est négligeable.`) : sansFit),
      ouverte('tp2-i2-ordre', ORDRES, a40.d1rel > 0 ? ORDRES[1] : ORDRES[0], 'Ordre 2 avec zb < 1 : dépassement et oscillations amorties.'),
      ouverte('tp2-i21-q1', OUI_NON, c.erreurNonNulle(a40) ? 'Non' : 'Oui', 'Non : erreur statique plus faible qu’à K = 3,8 mais non nulle.'),
      ouverte('tp2-i21-q5', OUI_NON, Math.abs(a40.g0b / a38.g0b - 1) > TOL_M() ? 'Non' : 'Oui', 'Non : G0b = KG0/(1+KG0) tend vers 1 quand K augmente ; écart à la théorie dû au frottement sec.'),
      ouverte('tp2-i21-q12#meme', MEME_TR5, Math.abs(a40.tr5 / a38.tr5 - 1) > TOL_M() ? MEME_TR5[1] : MEME_TR5[0], 'Différent : plus rapide car ωnb = ωn√(1+KG0) augmente avec K.'),
      ouverte('tp2-i22-q9', OUI_NON, memes(c.lFit40), c.o40 ? 'Comparer G0b, zb et ωnb du fit à vos valeurs (±5 %).' : sansFit),
      ouverte('tp2-i22-q10', DIFFERENCES, c.res40 ? (c.res40.demarrage > c.res40.permanent ? DIFFERENCES[0] : DIFFERENCES[1]) : null, c.res40 ? 'Comparer l’écart quadratique moyen au démarrage et en régime permanent.' : sansFit),
      ouverte('tp2-i22-q11', OUI_NON, c.superpose(c.f40, c.o40), c.o40 ? 'Oui ; phénomène négligé : le frottement sec (gain apparent dépendant de l’amplitude).' : sansFit),
      ouverte('tp2-conclusion-1', OUI_NON, c.erreurNonNulle(a38) && c.erreurNonNulle(a40) ? 'Non' : 'Oui', 'Non : pas d’intégrateur, l’erreur statique n’est jamais nulle avec un régulateur P.'),
      ouverte('tp2-conclusion-2', OUI_NON, c.erreurNonNulle(a38) && c.erreurNonNulle(a40) ? 'Non' : 'Oui', 'Non : seule la valeur ε∞/C0 = 1/(1+KG0) diminue quand K augmente.'),
      ouverte('tp2-comparaison-ecart', LES_K, c.ecartStatique(a40) < c.ecartStatique(a38) ? LES_K[1] : LES_K[0], 'K = 40 : écart statique relatif le plus faible.'),
      ouverte('tp2-comparaison-tr5', LES_K, a40.tr5 < a38.tr5 ? LES_K[1] : LES_K[0], 'K = 40 : TR5%b le plus faible.'),
      ouverte('tp2-comparaison-depassement', LES_K, a40.d1rel > a38.d1rel ? LES_K[1] : LES_K[0], 'K = 40 : dépassement le plus grand.'),
    ],
  )
}

/* ───────────── TP4 ───────────── */

export const CHOIX_AIRE = ['L’intégrale de e(t) fait monter U', 'U ne change pas'] as const
export const CHOIX_PRECISION = ['Même précision', 'Précision différente'] as const
export const CHOIX_II5E = ['Le PI est nécessaire', 'Le P suffit'] as const

/** Configuration de la Q5 : composants, G2 et GBF de l'étudiant (amplitude réglée, carré) */
export function configTp4(s: SessionAu3): ConfigBalayage {
  const vpp = s.gbf.vpp * facteurAttenuation(s.gbf)
  return { z1: s.platine.z1, z2: s.platine.z2, g2: s.platine.g2, gbf: { ...gbfTp4(), vpp: s.gbf.forme === 'carre' && vpp > 0 ? vpp : au3('TP4_GBF_VPP') } }
}

/** Boucle du TP4 avec les composants et le G1 de la platine : stable au sens de Routh ? (null si régulateur hors service) */
export function boucleStable(s: SessionAu3): boolean | null {
  const h = regulateur(s.platine.z1, s.platine.z2, s.platine.g1, s.platine.g2)
  return h ? routhStable(polynomeBoucle(h, BANC_REEL.g0r, BANC_REEL.tauA, BANC_REEL.tauB)) : null
}

export function contexteTp4(s: SessionAu3, balayage: ReturnType<typeof balayageG1> | null) {
  const vpp = configTp4(s).gbf.vpp
  const a95 = memo(`tp4:95:${vpp}`, () => attendusTp4({ ...essaiTp4(), gbf: { ...gbfTp4(), vpp } }))
  const q5 = s.reponses['tp4-i-q5']
  const retenu = q5 && balayage ? Math.round(Number(q5.valeur.replace(',', '.'))) : s.platine.g1
  const aRet = memo(`tp4:${retenu}:${vpp}`, () => attendusTp4({ ...essaiTp4(retenu), gbf: { ...gbfTp4(), vpp } }))
  const ii3 = memo('ii3', () => scenarioII(true, false))
  const ii4 = memo('ii4', () => scenarioII(true, true))
  const ii5 = memo('ii5', () => scenarioII(false, true))
  const c3 = { precision: Math.abs(ii3.erreurDemarrage) < au3('TP4_ERREUR_MAX'), rapidite: ii3.tr5 < au3('TP4_II_TR5_MAX') }
  const variation = ii4.ecartMax !== null ? Math.abs(ii4.ecartMax) / au3('TP4_II_CONSIGNE') : 0
  const bouteilleOk = variation < au3('TP4_II_VARIATION_MAX') && Math.abs(ii4.erreurFinale ?? 1) < au3('TP4_ERREUR_MAX')
  return { a95, retenu, aRet, ii3, ii4, ii5, c3, variation, bouteilleOk, balayage, stable: boucleStable(s) }
}

export function catalogueTp4(c: ReturnType<typeof contexteTp4>): Catalogue {
  const { a95, aRet, ii3, ii4, ii5, balayage } = c
  const ok = balayage?.ok ?? []
  return cat(
    [
      champ('tp4-i-q1', 'V', a95.dm, TOL_M(), 'ΔY sur la voie 2'),
      champ('tp4-i-q2#g0b', '', a95.g0b, TOL_M(), 'G0b = m(∞)/C0'),
      pourcentAbsolu('tp4-i-q2', a95.erreur),
      champ('tp4-i-q3', 'V', a95.d1, TOL_M(), 'pic − m(∞)'),
      champ('tp4-i-q4', '%', a95.d1rel * PC, TOL_M()),
      {
        id: 'tp4-i-q5',
        unite: '',
        // null tant que le balayage (Worker) n'a pas répondu : aucune correction affichée entre-temps
        attendu: balayage ? (balayage.frontiere ?? AFFICHAGE_TP4) : null,
        tolerance: null,
        texte: ok.length ? `une valeur de ${ok[0]} à ${balayage!.frontiere} (balayage du modèle, Affichage 00 à ${au3('AFFICHAGE_G1_MAX')})` : 'balayage du modèle en cours',
        corriger: (saisie) => corrigerG1(saisie, balayage?.tous ?? []),
      },
      champ('tp4-i-q6#bas', 'V', au3('NIVEAU_TR5') * aRet.dm, TOL_M(), '0,95·m(∞)'),
      champ('tp4-i-q6#haut', 'V', (2 - au3('NIVEAU_TR5')) * aRet.dm, TOL_M(), '1,05·m(∞)'),
      champTr5('tp4-i-q6', Number.isFinite(aRet.tr5) ? aRet.tr5 : null),
      champ('tp4-ii3-c#g0b', '', 1 - ii3.erreurDemarrage, TOL_M()),
      pourcentAbsolu('tp4-ii3-c', ii3.erreurDemarrage),
      champ('tp4-ii3-e#minf', 'V', ii3.mInf, TOL_M()),
      champ('tp4-ii3-e#d1', 'V', ii3.d1, TOL_M()),
      champ('tp4-ii3-e#d1rel', '%', ii3.d1rel * PC, TOL_M()),
      champ('tp4-ii3-e', 's', Number.isFinite(ii3.tr5) ? ii3.tr5 : null, TOL_M()),
      champ('tp4-ii4-b#ecart', 'V', ii4.ecartMax, TOL_M(), 'C − M maximal après la bouteille'),
      pourcentAbsolu('tp4-ii4-b', ii4.erreurFinale ?? 0),
    ],
    [
      ouverte('tp4-i-q7', OUI_NON, respecte(aRet) ? 'Oui' : 'Non', 'Erreur statique < 0,5 %, TR5%b < 200 ms (mesurable dans la demi-période), D1/m(∞) < 5 %.'),
      ouverte('tp4-ii3-c#meme', CHOIX_PRECISION, Math.abs(ii3.erreurDemarrage - a95.erreur) < au3('TP4_ERREUR_MAX') ? CHOIX_PRECISION[0] : CHOIX_PRECISION[1], 'Même précision : erreur statique nulle grâce à l’intégrateur.'),
      ouverte('tp4-ii3-d', OUI_NON, ii3.u0 > ii3.uFin && Math.abs(ii3.uFin) > 0 ? 'Oui' : 'Non', 'Oui : U saturé au départ, puis non nul en régime permanent.'),
      ouverte('tp4-ii3-f', OUI_NON, c.c3.precision && c.c3.rapidite ? 'Oui' : 'Non', `Précision et rapidité (TR5%b < ${afficher(au3('TP4_II_TR5_MAX'), 's')}).`),
      ouverte('tp4-ii4-b#aire', CHOIX_AIRE, ii4.uApres > ii4.uFin ? CHOIX_AIRE[0] : CHOIX_AIRE[1], 'L’aire de e(t) (intégrale) fait monter U jusqu’à compenser le couple de charge.'),
      ouverte('tp4-ii4-c', OUI_NON, c.bouteilleOk ? 'Oui' : 'Non', `Variation < ${nombre(au3('TP4_II_VARIATION_MAX') * PC)} % et erreur finale nulle.`),
      ouverte('tp4-ii5-d', OUI_NON, Math.abs(ii5.erreurDemarrage) < au3('TP4_ERREUR_MAX') && Math.abs(ii5.erreurFinale ?? 1) < au3('TP4_ERREUR_MAX') ? 'Oui' : 'Non', 'Non : erreur statique non nulle au démarrage et après la bouteille.'),
      ouverte('tp4-ii5-e', CHOIX_II5E, (ii5.erreurFinale ?? 0) > au3('TP4_ERREUR_MAX') ? CHOIX_II5E[0] : CHOIX_II5E[1], 'Seule l’action intégrale annule l’erreur statique.'),
    ],
  )
}

/** Valeurs acceptées d'un champ, pour l'affichage (TR5% : une ou deux lectures) */
export const valeursChamp = (c: ChampDef, lectures?: readonly number[]) => (c.unite === 's' && c.texte.includes(MARQUE_TR5) && c.attendu !== null ? valeursTr5(c.attendu, lectures) : [c.attendu])
