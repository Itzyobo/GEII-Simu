import { MISE_EN_PAGE } from '../miseEnPage'

/** 0.01215 s → « 12.15 ms » : préfixe SI le plus adapté, chiffres significatifs fixes, virgule décimale */
export function formatSi(v: number | null, unite: string, chiffres: number = MISE_EN_PAGE.oscillo.chiffres): string {
  if (v === null || !Number.isFinite(v)) return '—'
  const p = v === 0 ? MISE_EN_PAGE.prefixes[0]! : (MISE_EN_PAGE.prefixes.find((x) => Math.abs(v) >= x.facteur) ?? MISE_EN_PAGE.prefixes[MISE_EN_PAGE.prefixes.length - 1]!)
  const n = v / p.facteur
  return `${Number(n.toPrecision(chiffres)).toString().replace('.', ',')} ${p.symbole}${unite}`
}
