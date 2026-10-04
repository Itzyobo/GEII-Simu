const PREFIXES = ['p', 'n', 'µ', 'm', '', 'k', 'M', 'G']

/** 0.0021, 'A' → « 2,10 mA ». Virgule décimale française. */
export function formatSI(v: number, unit: string, digits = 3): string {
  if (!Number.isFinite(v)) return `— ${unit}`
  if (v === 0) return `0 ${unit}`
  const e = Math.min(3, Math.max(-4, Math.floor(Math.log10(Math.abs(v)) / 3)))
  let s = (v / 10 ** (3 * e)).toPrecision(digits)
  if (s.includes('e')) s = String(Number(s)) // 1000 arrondi → « 1000 » plutôt que 1.00e+3
  return `${s.replace('.', ',')} ${PREFIXES[e + 4]}${unit}`
}

/** Valeur → texte d'afficheur : « OL » si elle ne tient pas sur `digits` chiffres, blanc si null. */
export function toDisplay(value: number | null, decimals: number, digits: number): string {
  if (value === null || !Number.isFinite(value)) return ''
  const s = value.toFixed(decimals)
  return s.replace(/[-.]/g, '').length > digits ? ' OL' : s
}
