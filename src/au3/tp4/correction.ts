import { au3 } from '../../data/reference'
import { MISE_EN_PAGE } from '../miseEnPage'
import { corriger, type Correction } from '../tp1/correction'
import type { AttendusTp4 } from './attendus'

const pc = (x: number) => `${(x * MISE_EN_PAGE.pourcent).toFixed(1).replace('.', ',')} %`
const ms = (x: number) => (Number.isFinite(x) ? `${(x / MISE_EN_PAGE.prefixes[1].facteur).toFixed(1).replace('.', ',')} ms` : 'non mesurable dans la demi-période')

/** Les trois critères chiffrés du cahier des charges pour un essai, avec leur verdict */
export function criteres(a: AttendusTp4): string[] {
  return [
    `${a.cahier.erreur ? '✓' : '✗'} erreur statique ${pc(a.erreur)} (exigée < ${pc(au3('TP4_ERREUR_MAX'))})`,
    `${a.cahier.tr5 ? '✓' : '✗'} TR5%b ${ms(a.tr5)} (exigé < ${ms(au3('TP4_TR5_MAX'))})`,
    `${a.cahier.d1 ? '✓' : '✗'} D1/m(∞) ${pc(a.d1rel)} (exigé < ${pc(au3('TP4_D1_MAX'))})`,
  ]
}

/**
 * I Q5 : l'Affichage G1 retenu par l'étudiant est juste s'il appartient à l'ensemble (balayage du modèle) des
 * valeurs qui respectent le cahier des charges ; sinon, le message dit quelle(s) condition(s) échoue(nt).
 */
export function corrigerG1(saisie: string, tous: readonly { affichage: number; a: AttendusTp4 }[]): Correction {
  const c = corriger(saisie, 1, '', Infinity)
  if (c.valeur === null || c.verdict === 'illisible') return c
  const x = tous.find((t) => t.affichage === Math.round(c.valeur!))
  if (!x || !Number.isInteger(c.valeur)) return { verdict: 'faux', valeur: c.valeur, ecart: null, message: `Affichage G1 entier de 00 à ${au3('AFFICHAGE_G1_MAX')} attendu.` }
  const ok = x.a.cahier.erreur && x.a.cahier.tr5 && x.a.cahier.d1
  const echecs = criteres(x.a).filter((l) => l.startsWith('✗'))
  return { verdict: ok ? 'juste' : 'faux', valeur: c.valeur, ecart: null, message: ok ? 'Cahier des charges respecté.' : `Cahier des charges non respecté : ${echecs.join(' ; ')}.` }
}
