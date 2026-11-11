import { AU3_INSTRUMENTS } from '../../data/reference'

/** 0.01215 s → « 12.15 ms » : préfixe SI le plus adapté, chiffres significatifs fixes, virgule décimale */
export function formatSi(v: number | null, unite: string, chiffres: number = AU3_INSTRUMENTS.oscillo.chiffres): string {
  if (v === null || !Number.isFinite(v)) return '—'
  const p = v === 0 ? AU3_INSTRUMENTS.prefixes[0]! : (AU3_INSTRUMENTS.prefixes.find((x) => Math.abs(v) >= x.facteur) ?? AU3_INSTRUMENTS.prefixes[AU3_INSTRUMENTS.prefixes.length - 1]!)
  const n = v / p.facteur
  return `${Number(n.toPrecision(chiffres)).toString().replace('.', ',')} ${p.symbole}${unite}`
}
