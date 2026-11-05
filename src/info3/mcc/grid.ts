/**
 * Pin Manager : Grid View (MCC Classic, captures du CR). Lignes : OSC/CLKOUT/output (RA6), Pin Module/GPIO
 * input et output, RESET/MCLR/input (RE3, verrouillée), puis une ligne par entrée de périphérique ajoutée.
 * États d'une case : bleu = disponible, vert = verrouillé, orange = broche déjà prise par une autre fonction.
 * Une broche peut porter deux fonctions (GPIO + entrée de périphérique, ex. RC5 = BP_S2 + T2IN).
 */
import { INFO3 } from '../../data/reference'
import { toggleGridPin, type MccConfig } from './config'

export type CellState = 'none' | 'available' | 'locked' | 'taken' | 'fixed'

export interface GridRow {
  id: string
  module: string
  func: string
  dir: 'input' | 'output'
  /** Broches proposées par la ligne */
  allowed(pin: string): boolean
  /** Broche(s) que la ligne a verrouillée(s) */
  owns(cfg: MccConfig, pin: string): boolean
  /** Clic sur une case disponible ou verrouillée ; null = case non modifiable */
  click: ((cfg: MccConfig, pin: string) => MccConfig) | null
  /** Fonction compatible avec un GPIO sur la même broche (icône double) */
  sharesWithGpio?: boolean
}

const MCLR = INFO3.mcc.mclrPin
const gpio = (dir: 'input' | 'output'): GridRow => ({
  id: `gpio-${dir}`,
  module: 'Pin Module',
  func: `GPIO ${dir}`,
  dir,
  allowed: (pin) => pin !== MCLR,
  owns: (cfg, pin) => cfg.pins.some((p) => p.pin === pin && p.direction === dir),
  click: (cfg, pin) => toggleGridPin(cfg, pin, dir),
})

/** Lignes fixes ; les lignes des périphériques s'ajoutent en tête de liste via `extra` */
export function gridRows(extra: GridRow[] = []): GridRow[] {
  return [
    { id: 'clkout', module: 'OSC', func: 'CLKOUT', dir: 'output', allowed: (pin) => pin === INFO3.mcc.clkoutPin, owns: () => false, click: null },
    gpio('input'),
    gpio('output'),
    { id: 'mclr', module: 'RESET', func: 'MCLR', dir: 'input', allowed: (pin) => pin === MCLR, owns: (_, pin) => pin === MCLR, click: null },
    ...extra,
  ]
}

/** Fonctions qui occupent une broche (ids de ligne) */
export function pinFunctions(cfg: MccConfig, rows: GridRow[], pin: string): string[] {
  return rows.filter((r) => r.allowed(pin) && r.owns(cfg, pin)).map((r) => r.id)
}

const isGpio = (r: GridRow) => r.id.startsWith('gpio-')
/** Deux fonctions peuvent partager une broche : un GPIO et une entrée de périphérique compatible */
const compatible = (a: GridRow, b: GridRow) => (isGpio(a) && !!b.sharesWithGpio) || (isGpio(b) && !!a.sharesWithGpio)

export function cellState(cfg: MccConfig, rows: GridRow[], row: GridRow, pin: string): CellState {
  if (!row.allowed(pin)) return 'none'
  if (row.id === 'mclr') return 'fixed'
  if (row.owns(cfg, pin)) return 'locked'
  if (pin === MCLR) return 'taken'
  const blocking = rows.filter((r) => r !== row && r.allowed(pin) && r.owns(cfg, pin) && !compatible(row, r))
  return blocking.length ? 'taken' : 'available'
}

/**
 * Clic sur une case. Sans effet sur une case fixe ou absente. Une case orange n'est modifiable que pour
 * un GPIO dont la broche est déjà un GPIO de l'autre sens (MCC déplace le verrou d'une ligne à l'autre).
 */
export function clickCell(cfg: MccConfig, rows: GridRow[], row: GridRow, pin: string): MccConfig {
  const s = cellState(cfg, rows, row, pin)
  if (!row.click || s === 'none' || s === 'fixed') return cfg
  if (s === 'taken') {
    const blocking = rows.filter((r) => r !== row && r.allowed(pin) && r.owns(cfg, pin) && !compatible(row, r))
    if (!isGpio(row) || !blocking.every(isGpio)) return cfg
  }
  return row.click(cfg, pin)
}
/** Nombre de fonctions sur une broche (2 = icône double) */
export const functionCount = (cfg: MccConfig, rows: GridRow[], pin: string) => pinFunctions(cfg, rows, pin).filter((id) => id !== 'mclr').length
