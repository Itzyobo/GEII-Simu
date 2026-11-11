import { au3 } from '../../data/reference'
import { MISE_EN_PAGE } from '../miseEnPage'
import type { ResultatFit, SessionAu3 } from '../session'
import { formatSi } from '../ui/format'
import { lireCsv } from '../instruments/oscillo'
import { corriger } from './correction'
import { fenetreEchelon, type Fenetre } from './identification'

const M = MISE_EN_PAGE

/** Nombre court, virgule décimale */
export const nombre = (v: number, chiffres: number = M.oscillo.chiffres) => Number(v.toPrecision(chiffres)).toString().replace('.', ',')

/** Affichage d'une valeur attendue : préfixe SI pour s et V, chiffres significatifs sinon */
export const afficher = (v: number | null, unite: string) => (v === null || !Number.isFinite(v) ? '—' : unite === 's' || unite === 'V' ? formatSi(v, unite) : `${nombre(v)}${unite ? ` ${unite}` : ''}`)

/** Écart relatif signé en pourcentage : « +2,9 % » */
export const pourcent = (x: number) => `${x > 0 ? '+' : ''}${(x * M.pourcent).toFixed(1).replace('.', ',')} %`

/** Valeur numérique enregistrée d'un champ, convertie dans l'unité de base (null si absente, illisible ou sans unité) */
export function valeurDe(session: SessionAu3, id: string, unite: string): number | null {
  const r = session.reponses[id]
  if (!r) return null
  const c = corriger(r.valeur, 1, unite, au3('TOL_MESURE'))
  return c.verdict === 'illisible' || c.verdict === 'incomplete' || c.valeur === null ? null : c.valeur
}

const I = M.identification

/** Sortie façon « Command Window » de Matlab pour un résultat d'identification */
export function commandWindow(f: Fenetre, r: ResultatFit): string {
  const p = (v: number) => v.toPrecision(I.chiffres)
  const lignes = [
    '>> main_ident',
    `Ordre du modèle (1 ou 2) ? ${r.ordre}`,
    `Fenêtre : échelon positif, ${f.t.length} points, ΔU = ${p(f.du)} V, m0 = ${p(f.m0)} V`,
    `G0 = ${p(r.g0)}`,
    ...(r.ordre === 1 ? [`tau = ${p(r.tau!)} s`] : [`z = ${p(r.z!)}`, `wn = ${p(r.wn!)} rad/s`]),
    `Critère = ${p(r.critere)} V² (${r.iterations} itérations Nelder–Mead)`,
  ]
  return lignes.join('\n')
}

export function fenetreDeCsv(csv: string | null): Fenetre | null {
  return csv ? fenetreEchelon(lireCsv(csv)) : null
}


/** Note du badge de TR5% : « modèle 30,7 ms ; CR 33 ms (−7 %) : la dérive lente en fin de courbe n'est pas modélisée » */
export function noteTr5(e: { modele: number; cr: number; ecart: number }): string {
  const pts = Math.round(e.ecart * M.pourcent)
  return `modèle ${formatSi(e.modele, 's', M.chiffresTr5.modele)} ; CR ${formatSi(e.cr, 's', M.chiffresTr5.cr)} (${pts < 0 ? '−' : '+'}${Math.abs(pts)} %) : la dérive lente en fin de courbe n’est pas modélisée`
}
