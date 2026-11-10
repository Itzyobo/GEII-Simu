/**
 * LED RGB de la carte fille (annexe 2) : anode commune, broche à 1 → transistor passant → couleur allumée.
 * Intensité de chaque couleur = rapport cyclique moyen de sa broche ; couleur affichée = somme pondérée des
 * trois teintes, sans calibration colorimétrique (H17). Sans le cache, halo d'éblouissement sur le banc.
 */
import { INFO3 } from '../../data/reference'

export interface RgbDuty {
  r: number
  g: number
  b: number
}

const BYTE = (1 << INFO3.c.bitsPerByte) - 1
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Intensités des trois puces depuis la fraction du temps à 1 de RGB_R, RGB_G, RGB_B (niveau actif = 1) */
export function rgbDuty(byName: Record<string, number>): RgbDuty {
  const sig = INFO3.rgb.signals
  const on = (name: string) => clamp01(INFO3.pins.rgb.activeLevel ? (byName[name] ?? 0) : 1 - (byName[name] ?? 1))
  return { r: on(sig.r), g: on(sig.g), b: on(sig.b) }
}

/** Couleur affichée (0 à 255 par composante) : mélange additif des trois puces, saturé (H17) */
export function rgbMix(d: RgbDuty): [number, number, number] {
  const t = INFO3.rgb.tints
  const out: [number, number, number] = [0, 0, 0]
  for (const k of ['r', 'g', 'b'] as const) for (let c = 0; c < out.length; c++) out[c] += t[k][c] * clamp01(d[k])
  return out.map((v) => Math.min(BYTE, Math.round(v))) as [number, number, number]
}

/** Intensité totale (0 à 3) */
export const rgbIntensity = (d: RgbDuty) => clamp01(d.r) + clamp01(d.g) + clamp01(d.b)

/** Halo d'éblouissement (0 à 1) : sans le cache, dès que la LED éclaire franchement */
export function rgbGlare(d: RgbDuty, cover: boolean): number {
  const i = rgbIntensity(d)
  if (cover || i <= INFO3.rgb.glareThreshold) return 0
  return clamp01(i / INFO3.rgb.glareFull)
}

export const cssColor = ([r, g, b]: [number, number, number]) => `rgb(${r}, ${g}, ${b})`
