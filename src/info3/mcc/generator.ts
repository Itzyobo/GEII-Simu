/**
 * Generate de MCC Classic : écrit mcc.c/.h, pin_manager.c/.h, device_config.c/.h depuis la configuration.
 * Gabarits = fichiers réellement produits par MCC 1.81.7 en TP (docs/sources/mplab/tp1, fins de ligne LF) :
 * en-têtes de licence, espaces en fin de ligne et ordre des registres (H26) sont repris tels quels ;
 * seules les parties qui dépendent de la configuration sont calculées (valeurs de registres, macros des
 * broches, oscillateur, _XTAL_FREQ, LVP). Aucune chaîne figée par TP.
 */
import { INFO3 } from '../../data/reference'
import { oscRegisters } from '../models/clock'
import { implementedMask, parsePin, PORT_NAMES, type PortName } from '../models/gpio'
import { pinOrder, systemFosc, type MccConfig, type PinConfig } from './config'

const DIR = INFO3.mcc.dir
const HEX = 16
const hex2 = (v: number) => `0x${v.toString(HEX).toUpperCase().padStart(2, '0')}`
const sfrReset = (name: string) => (INFO3.sfr as Record<string, { reset: number }>)[name].reset

const RAW = import.meta.glob('./templates/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const tpl = (file: string): string => {
  const t = RAW[`./templates/${file}.txt`]
  if (t === undefined) throw new Error(`gabarit MCC absent : ${file}`)
  // Seule normalisation permise : CRLF → LF (dépôt extrait sous Windows)
  return t.replace(/\r\n/g, '\n')
}

/** Remplacement d'un passage du gabarit ; échoue si le passage n'existe pas (gabarit altéré) */
function replaceOnce(text: string, find: string | RegExp, by: string): string {
  const found = typeof find === 'string' ? text.includes(find) : find.test(text)
  if (!found) throw new Error(`gabarit MCC : passage introuvable (${String(find)})`)
  return text.replace(find, () => by)
}

/** Valeurs des registres de port calculées depuis le Pin Module (règle du cours p. 22) */
export interface PortRegisters {
  LAT: number
  TRIS: number
  ANSEL: number
  WPU: number
  ODCON: number
  SLRCON: number
  INLVL: number
}

export function portRegisters(cfg: MccConfig): Record<PortName, PortRegisters> {
  const out = {} as Record<PortName, PortRegisters>
  for (const p of PORT_NAMES) {
    // SLRCON et INLVL : MCC écrit toujours la valeur par défaut (0xFF, 0x07 pour E)
    const r: PortRegisters = { LAT: 0, TRIS: sfrReset(`TRIS${p}`), ANSEL: sfrReset(`ANSEL${p}`), WPU: 0, ODCON: 0, SLRCON: sfrReset(`SLRCON${p}`), INLVL: sfrReset(`INLVL${p}`) }
    for (const pc of cfg.pins) {
      const { port, bit } = parsePin(pc.pin)
      if (port !== p) continue
      const m = 1 << bit
      if (pc.direction === 'output') {
        r.TRIS &= ~m
        if (pc.startHigh) r.LAT |= m
      }
      if (pc.analog) r.ANSEL |= m
      else r.ANSEL &= ~m
      if (pc.wpu) r.WPU |= m
      if (pc.od) r.ODCON |= m
    }
    for (const reg of ['LAT', 'TRIS', 'ANSEL', 'WPU', 'ODCON', 'SLRCON', 'INLVL'] as const) r[reg] &= implementedMask(`${reg}${p}`)
    out[p] = r
  }
  return out
}

/** main.c créé au premier Generate (cours p. 15) */
export const MAIN_TEMPLATE = `#include "mcc_generated_files/mcc.h"

/*
                         Main application
 */
void main(void)
{
    // initialize the device
    SYSTEM_Initialize();

    // When using interrupts, you need to set the Global and Peripheral Interrupt Enable bits
    // Use the following macros to:

    // Enable the Global Interrupts
    //INTERRUPT_GlobalInterruptEnable();

    // Enable the Peripheral Interrupts
    //INTERRUPT_PeripheralInterruptEnable();

    // Disable the Global Interrupts
    //INTERRUPT_GlobalInterruptDisable();

    // Disable the Peripheral Interrupts
    //INTERRUPT_PeripheralInterruptDisable();

    while (1)
    {
        // Add your application code
    }
}
`

/** Largeur fixe des noms dans le gabarit MCC (aligné pour un nom de 6 caractères comme LED_D2) */
const MACRO_COLUMN = 22
function pinMacros(p: PinConfig): string {
  const { port, bit } = parsePin(p.pin)
  const n = p.customName
  const b = `${port}${bit}`
  const rows: [string, string][] = [
    ['_TRIS', `TRIS${port}bits.TRIS${b}`],
    ['_LAT', `LAT${port}bits.LAT${b}`],
    ['_PORT', `PORT${port}bits.R${b}`],
    ['_WPU', `WPU${port}bits.WPU${b}`],
    ['_OD', `ODCON${port}bits.ODC${b}`],
    ['_ANS', `ANSEL${port}bits.ANS${b}`],
    ['_SetHigh()', `do { LAT${port}bits.LAT${b} = 1; } while(0)`],
    ['_SetLow()', `do { LAT${port}bits.LAT${b} = 0; } while(0)`],
    ['_Toggle()', `do { LAT${port}bits.LAT${b} = ~LAT${port}bits.LAT${b}; } while(0)`],
    ['_GetValue()', `PORT${port}bits.R${b}`],
    ['_SetDigitalInput()', `do { TRIS${port}bits.TRIS${b} = 1; } while(0)`],
    ['_SetDigitalOutput()', `do { TRIS${port}bits.TRIS${b} = 0; } while(0)`],
    ['_SetPullup()', `do { WPU${port}bits.WPU${b} = 1; } while(0)`],
    ['_ResetPullup()', `do { WPU${port}bits.WPU${b} = 0; } while(0)`],
    ['_SetPushPull()', `do { ODCON${port}bits.ODC${b} = 0; } while(0)`],
    ['_SetOpenDrain()', `do { ODCON${port}bits.ODC${b} = 1; } while(0)`],
    ['_SetAnalogMode()', `do { ANSEL${port}bits.ANS${b} = 1; } while(0)`],
    ['_SetDigitalMode()', `do { ANSEL${port}bits.ANS${b} = 0; } while(0)`],
  ]
  const lines = rows.map(([suf, val]) => `#define ${n}${suf}${' '.repeat(Math.max(1, MACRO_COLUMN - suf.length))}${val}`)
  return `// get/set ${n} aliases\n${lines.join('\n')}\n`
}

const MACROS_START = '#define PULL_UP_DISABLED     0\n\n'
const MACROS_END = '/**\n   @Param'

function pinManagerH(cfg: MccConfig): string {
  const t = tpl('pin_manager.h')
  const a = t.indexOf(MACROS_START)
  const z = t.indexOf(MACROS_END, a)
  if (a < 0 || z < 0) throw new Error('gabarit MCC : bloc des macros de pin_manager.h introuvable')
  const pins = [...cfg.pins].sort((x, y) => pinOrder(x.pin, y.pin))
  const blocks = pins.length ? `${pins.map(pinMacros).join('\n')}\n` : ''
  return t.slice(0, a + MACROS_START.length) + blocks + t.slice(z)
}

/** Lignes « REGx = 0x..; » du gabarit : l'ordre (H26) est celui de MCC, les valeurs sont calculées */
const REG_LINE = /^( {4})(LAT|TRIS|ANSEL|WPU|ODCON|SLRCON|INLVL)([A-E]) = 0x[0-9A-F]{2};$/gm

function pinManagerC(cfg: MccConfig): string {
  const regs = portRegisters(cfg)
  let count = 0
  const out = tpl('pin_manager.c').replace(REG_LINE, (_, indent: string, reg: keyof PortRegisters, port: PortName) => {
    count++
    return `${indent}${reg}${port} = ${hex2(regs[port][reg])};`
  })
  if (count !== PORT_NAMES.length * Object.keys(regs.A).length) throw new Error('gabarit MCC : registres de pin_manager.c incomplets')
  return out
}

const MHZ_LABEL = (mhz: number) => `${mhz}_MHz`

function mccC(cfg: MccConfig): string {
  const s = cfg.system
  const { osccon1, oscfrq } = oscRegisters(s.oscillator, s.hfMHz, s.divider)
  let t = tpl('mcc.c')
  t = replaceOnce(t, /\/\/ NOSC \w+; NDIV \d+; \n {4}OSCCON1 = 0x[0-9A-F]{2};/, `// NOSC ${s.oscillator}; NDIV ${s.divider}; \n    OSCCON1 = ${hex2(osccon1)};`)
  t = replaceOnce(t, /\/\/ HFFRQ \w+; \n {4}OSCFRQ = 0x[0-9A-F]{2};/, `// HFFRQ ${MHZ_LABEL(s.hfMHz)}; \n    OSCFRQ = ${hex2(oscfrq)};`)
  return t
}

function deviceConfigH(cfg: MccConfig): string {
  return replaceOnce(tpl('device_config.h'), /#define _XTAL_FREQ \d+/, `#define _XTAL_FREQ ${systemFosc(cfg.system)}`)
}

/** Ligne LVP : texte MCC selon la case « Low-voltage programming enable » (H25 pour OFF) */
const LVP_LINE = /#pragma config LVP = \w+ {4}\/\/ Low Voltage Programming Enable bit->[^\n]*/
function deviceConfigC(cfg: MccConfig): string {
  const line = cfg.system.lvp
    ? '#pragma config LVP = ON    // Low Voltage Programming Enable bit->Low Voltage programming enabled. MCLR/Vpp pin function is MCLR.'
    : '#pragma config LVP = OFF    // Low Voltage Programming Enable bit->High Voltage on MCLR/Vpp must be used for programming'
  return replaceOnce(tpl('device_config.c'), LVP_LINE, line)
}

/** Fichiers générés, indexés par chemin dans le projet (mcc_generated_files/…) */
export function generate(cfg: MccConfig): Record<string, string> {
  return {
    [`${DIR}/mcc.h`]: tpl('mcc.h'),
    [`${DIR}/mcc.c`]: mccC(cfg),
    [`${DIR}/pin_manager.h`]: pinManagerH(cfg),
    [`${DIR}/pin_manager.c`]: pinManagerC(cfg),
    [`${DIR}/device_config.h`]: deviceConfigH(cfg),
    [`${DIR}/device_config.c`]: deviceConfigC(cfg),
  }
}

/** Fichier où MCC écrit _XTAL_FREQ */
export const XTAL_FILE = `${DIR}/device_config.h`

/** Valeur de _XTAL_FREQ écrite dans un en-tête (null si absente) */
export function xtalOf(headerText: string | undefined): number | null {
  const m = /#define\s+_XTAL_FREQ\s+([0-9.eE+]+)[uUlL]*/.exec(headerText ?? '')
  return m ? Number(m[1]) : null
}
