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
import { iocOf, pinOrder, systemFosc, type IocEdge, type MccConfig, type PinConfig } from './config'
import { interruptManagerFiles } from './interruptManager'
import { isEnabled } from './interrupts'
import { DIR, hex2, replaceOnce, tpl, type DriverOutput } from './templates'

const sfrReset = (name: string) => (INFO3.sfr as Record<string, { reset: number }>)[name].reset

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

/* ───────────── IOC (format MCC 1.81, cours p. 38 à 40 ; détail des commentaires = H34) ───────────── */

interface IocPin {
  /** Nom MCC de la source : IOCBF4 */
  id: string
  port: string
  bit: number
  edge: IocEdge
}

/** Broches dotées d'une IOC, dans l'ordre des broches (jamais le port D) */
export function iocPins(cfg: MccConfig): IocPin[] {
  return [...cfg.pins]
    .filter((p) => iocOf(p) !== 'none')
    .sort((x, y) => pinOrder(x.pin, y.pin))
    .map((p) => {
      const { port, bit } = parsePin(p.pin)
      return { id: `IOC${port}F${bit}`, port, bit, edge: iocOf(p) }
    })
}

const SP = ' '
const iocHeaderDecls = (p: IocPin) => `
/**
 * @Param
    none
 * @Returns
    none
 * @Description
    Interrupt on Change Handler for the ${p.id} pin functionality
 * @Example
    ${p.id}_ISR();
 */
void ${p.id}_ISR(void);

/**
  @Summary
    Interrupt Handler Setter for ${p.id} pin interrupt-on-change functionality

  @Description
    Allows selecting an interrupt handler for ${p.id} at application runtime
${SP.repeat(4)}
  @Preconditions
    Pin Manager intializer called

  @Returns
    None.

  @Param
    InterruptHandler function pointer.

  @Example
    PIN_MANAGER_Initialize();
    ${p.id}_SetInterruptHandler(MyInterruptHandler);

*/
void ${p.id}_SetInterruptHandler(void (* InterruptHandler)(void));

/**
  @Summary
    Dynamic Interrupt Handler for ${p.id} pin

  @Description
    This is a dynamic interrupt handler to be used together with the ${p.id}_SetInterruptHandler() method.
    This handler is called every time the ${p.id} ISR is executed and allows any function to be registered at runtime.
${SP.repeat(4)}
  @Preconditions
    Pin Manager intializer called

  @Returns
    None.

  @Param
    None.

  @Example
    PIN_MANAGER_Initialize();
    ${p.id}_SetInterruptHandler(${p.id}_InterruptHandler);

*/
extern void (*${p.id}_InterruptHandler)(void);

/**
  @Summary
    Default Interrupt Handler for ${p.id} pin

  @Description
    This is a predefined interrupt handler to be used together with the ${p.id}_SetInterruptHandler() method.
    This handler is called every time the ${p.id} ISR is executed.${SP}
${SP.repeat(4)}
  @Preconditions
    Pin Manager intializer called

  @Returns
    None.

  @Param
    None.

  @Example
    PIN_MANAGER_Initialize();
    ${p.id}_SetInterruptHandler(${p.id}_DefaultInterruptHandler);

*/
void ${p.id}_DefaultInterruptHandler(void);
`

const IOC_PROTO = 'void PIN_MANAGER_IOC(void);\n'

function pinManagerH(cfg: MccConfig): string {
  const t = tpl('pin_manager.h')
  const a = t.indexOf(MACROS_START)
  const z = t.indexOf(MACROS_END, a)
  if (a < 0 || z < 0) throw new Error('gabarit MCC : bloc des macros de pin_manager.h introuvable')
  const pins = [...cfg.pins].sort((x, y) => pinOrder(x.pin, y.pin))
  const blocks = pins.length ? `${pins.map(pinMacros).join('\n')}\n` : ''
  let out = t.slice(0, a + MACROS_START.length) + blocks + t.slice(z)
  const ioc = iocPins(cfg)
  if (ioc.length) out = replaceOnce(out, IOC_PROTO, IOC_PROTO + ioc.map(iocHeaderDecls).join(''))
  return out
}

/** Registres IOCx, enregistrement des handlers par défaut et validation d'IOCIE (fin de PIN_MANAGER_Initialize) */
function iocInitBlock(ioc: IocPin[], enableIoci: boolean): string {
  const regs = ioc.flatMap((p) => {
    const n = p.edge === 'negative' || p.edge === 'any' ? 1 : 0
    const q = p.edge === 'positive' || p.edge === 'any' ? 1 : 0
    return [
      `    //interrupt on change for group IOC${p.port}F - flag`,
      `    IOC${p.port}Fbits.IOC${p.port}F${p.bit} = 0;`,
      `    //interrupt on change for group IOC${p.port}N - negative`,
      `    IOC${p.port}Nbits.IOC${p.port}N${p.bit} = ${n};`,
      `    //interrupt on change for group IOC${p.port}P - positive`,
      `    IOC${p.port}Pbits.IOC${p.port}P${p.bit} = ${q};`,
    ]
  })
  const handlers = ioc.map((p) => `    ${p.id}_SetInterruptHandler(${p.id}_DefaultInterruptHandler);`)
  return [
    '',
    '',
    '    /**',
    `    IOCx registers${SP}`,
    '    */',
    ...regs,
    '',
    '',
    '',
    '    // register default IOC callback functions at runtime; use these methods to register a custom function',
    ...handlers,
    SP.repeat(3),
    ...(enableIoci ? [`    // Enable IOCI interrupt${SP}`, `    PIE0bits.IOCIE = 1;${SP}`] : []),
    SP.repeat(4),
  ].join('\n')
}

const iocDispatch = (p: IocPin) => [`\t// interrupt on change for pin ${p.id}`, `    if(IOC${p.port}Fbits.IOC${p.port}F${p.bit} == 1)`, '    {', `        ${p.id}_ISR();${SP.repeat(2)}`, `    }\t`].join('\n')

const iocFunctions = (p: IocPin) => `
/**
   ${p.id} Interrupt Service Routine
*/
void ${p.id}_ISR(void) {

    // Add custom ${p.id} code

    // Call the interrupt handler for the callback registered at runtime
    if(${p.id}_InterruptHandler)
    {
        ${p.id}_InterruptHandler();
    }
    IOC${p.port}Fbits.IOC${p.port}F${p.bit} = 0;
}

/**
  Allows selecting an interrupt handler for ${p.id} at application runtime
*/
void ${p.id}_SetInterruptHandler(void (* InterruptHandler)(void)){
    ${p.id}_InterruptHandler = InterruptHandler;
}

/**
  Default interrupt handler for ${p.id}
*/
void ${p.id}_DefaultInterruptHandler(void){
    // add your ${p.id} interrupt custom code
    // or set custom function using ${p.id}_SetInterruptHandler()
}
`

/** Passages du gabarit pin_manager.c où MCC insère le code IOC */
const PM_HEAD = /(#include "pin_manager\.h"\n)\n{5}(void PIN_MANAGER_Initialize\(void\))/
const PM_TAIL = /( {4}INLVLE = 0x[0-9A-F]{2};\n)[\s\S]*?(\n\}\n {2}\nvoid PIN_MANAGER_IOC\(void\)\n\{ {3}\n)(\})/

function withIoc(text: string, ioc: IocPin[], enableIoci: boolean): string {
  if (!ioc.length) return text
  const ptrs = ioc.map((p) => `void (*${p.id}_InterruptHandler)(void);`).join('\n')
  let out = replaceOnce(text, PM_HEAD, `#include "pin_manager.h"\n\n\n\n\n${ptrs}\n\n\nvoid PIN_MANAGER_Initialize(void)`)
  const inlvlE = out.match(PM_TAIL)![1]
  // Fin de PIN_MANAGER_Initialize, corps de PIN_MANAGER_IOC, puis les fonctions de chaque broche
  out = replaceOnce(out, PM_TAIL, `${inlvlE}${iocInitBlock(ioc, enableIoci)}\n}\n  \nvoid PIN_MANAGER_IOC(void)\n{   \n${ioc.map(iocDispatch).join('\n')}\n}\n${ioc.map(iocFunctions).join('')}`)
  return out
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
  // IOCI décochée dans l'Interrupt Module : PIE0bits.IOCIE n'est pas mis à 1
  return withIoc(out, iocPins(cfg), isEnabled(cfg, 'IOC'))
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
/* ───────────── Pilotes ajoutés (Interrupt Module, timers…), appelés dans cet ordre ───────────── */

const DRIVERS: ((cfg: MccConfig) => DriverOutput | null)[] = [interruptManagerFiles]

const INCLUDE_ANCHOR = '#include <conio.h>\n'
const INIT_ANCHOR = '    OSCILLATOR_Initialize();\n'

export function generate(cfg: MccConfig): Record<string, string> {
  const outs = DRIVERS.map((d) => d(cfg)).filter((x): x is DriverOutput => x !== null)
  let mccH = tpl('mcc.h')
  let mccCText = mccC(cfg)
  const includes = outs.flatMap((o) => o.includes)
  const inits = outs.flatMap((o) => o.inits)
  if (includes.length) mccH = replaceOnce(mccH, INCLUDE_ANCHOR, INCLUDE_ANCHOR + includes.map((i) => `#include "${i}"\n`).join(''))
  if (inits.length) mccCText = replaceOnce(mccCText, INIT_ANCHOR, INIT_ANCHOR + inits.map((i) => `    ${i}\n`).join(''))
  const extra: Record<string, string> = {}
  for (const o of outs) for (const [f, text] of Object.entries(o.files)) extra[`${DIR}/${f}`] = text
  return {
    [`${DIR}/mcc.h`]: mccH,
    [`${DIR}/mcc.c`]: mccCText,
    [`${DIR}/pin_manager.h`]: pinManagerH(cfg),
    [`${DIR}/pin_manager.c`]: pinManagerC(cfg),
    [`${DIR}/device_config.h`]: deviceConfigH(cfg),
    [`${DIR}/device_config.c`]: deviceConfigC(cfg),
    ...extra,
  }
}

/** Fichier où MCC écrit _XTAL_FREQ */
export const XTAL_FILE = `${DIR}/device_config.h`

/** Valeur de _XTAL_FREQ écrite dans un en-tête (null si absente) */
export function xtalOf(headerText: string | undefined): number | null {
  const m = /#define\s+_XTAL_FREQ\s+([0-9.eE+]+)[uUlL]*/.exec(headerText ?? '')
  return m ? Number(m[1]) : null
}
