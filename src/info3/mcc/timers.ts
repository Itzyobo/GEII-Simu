/**
 * TMR2 / TMR4 / TMR6 de MCC Classic : calculs du panneau (Clock Frequency, plage et Actual Period, PRx),
 * valeurs des registres et fichiers tmrX.c / tmrX.h (cours p. 58, 59 et 65 ; fonctions = H32, format = H34).
 * La fréquence de calcul de LFINTOSC est 31 kHz ; le champ Clock Frequency affiche 32.768 kHz (cours p. 64).
 */
import { INFO3 } from '../../data/reference'
import { parsePin, PORT_NAMES, type PortName } from '../models/gpio'
import { timerClockHz } from '../models/timer246'
import { systemFosc, timerNumber, TIMER_IDS, updateTimer, type MccConfig, type TimerConfig, type TimerId } from './config'
import type { GridRow } from './grid'
import { timerIrqOn } from './interrupts'
import { generatedHeader, hex2, type DriverOutput } from './templates'

const T = INFO3.timers
const RANGE = T.counterRange
const MHZ = INFO3.units.usPerS

/* ───────────── Libellés ───────────── */

/** Nom du signal de reset externe : TMR2_ers */
export const ersName = (id: TimerId) => `${id}_ers`
/** Libellé avec {ers} / {n} remplacés */
export const label = (generic: string, id: TimerId) => generic.replace('{ers}', ersName(id)).replace('{n}', String(timerNumber(id)))

export const CONTROL_MODES: string[] = [...new Set(T.modes.map((m) => m.control))]
export const startOptions = (control: string): string[] => T.modes.filter((m) => m.control === control).map((m) => m.start)
export const PRESCALERS: number[] = Array.from({ length: T.prescalerMaxLog2 + 1 }, (_, i) => 2 ** i)
export const POSTSCALERS: number[] = Array.from({ length: T.postscalerMax }, (_, i) => i + 1)

const isMonostable = (t: TimerConfig) => t.controlMode === 'Monostable'
/** Postscaler effectif : 1:1 en monostable (MCC le force, cours p. 63) */
export const effectivePostscaler = (t: TimerConfig) => (isMonostable(t) ? 1 : t.postscaler)

/** Changement de Control Mode : Start/Reset Option valide pour le mode, postscaler 1:1 en monostable */
export function setControlMode(cfg: MccConfig, id: TimerId, control: string): MccConfig {
  const opts = startOptions(control)
  const cur = cfg.timers?.[id]
  if (!cur || !opts.length) return cfg
  const start = opts.includes(cur.startOption) ? cur.startOption : opts[0]
  return updateTimer(cfg, id, { controlMode: control, startOption: start, ...(control === 'Monostable' ? { postscaler: 1 } : {}) })
}

/* ───────────── Calculs du panneau ───────────── */

const csOf = (t: TimerConfig) => T.clockSources.find((s) => s.label === t.clockSource)?.cs ?? T.clockSources[0].cs

/** Fréquence de comptage avant prescaler (calcul : LFINTOSC = 31 kHz) — Hz */
export function timerClock(cfg: MccConfig, t: TimerConfig): number {
  return timerClockHz(csOf(t), systemFosc(cfg.system), cfg.system.hfMHz * MHZ)
}

/** Champ « Clock Frequency » (lecture seule) : 32.768 kHz affiché pour LFINTOSC (cours p. 64) */
export function displayedClock(cfg: MccConfig, t: TimerConfig): number {
  return t.clockSource === 'LFINTOSC' ? INFO3.clock.mccGreyedClockField : timerClock(cfg, t)
}

/** Plage de Timer Period : 1 à 256 incréments du compteur — s */
export function periodRange(cfg: MccConfig, t: TimerConfig): { min: number; max: number } {
  const step = t.prescaler / timerClock(cfg, t)
  return { min: step, max: RANGE * step }
}

/** PRx calculé depuis la Timer Period demandée (borné à 0…255) */
export function periodRegister(cfg: MccConfig, t: TimerConfig): number {
  const n = Math.round((t.periodS * timerClock(cfg, t)) / t.prescaler) - 1
  return Math.min(RANGE - 1, Math.max(0, n))
}

/** Actual Period : (PRx + 1) × prescaler / Fclk — s */
export function actualPeriod(cfg: MccConfig, t: TimerConfig): number {
  return ((periodRegister(cfg, t) + 1) * t.prescaler) / timerClock(cfg, t)
}

/** Timer Period à saisir pour obtenir PRx (presets, tests) */
export const periodForRegister = (cfg: MccConfig, t: TimerConfig, pr: number) => ((pr + 1) * t.prescaler) / timerClock(cfg, t)

const UNITS: [number, string][] = [
  [1, 's'],
  [1e-3, 'ms'],
  [1e-6, 'us'],
  [1e-9, 'ns'],
]
/** Durée au format MCC : arrondie à la nanoseconde, unité la plus grande ≥ 1 (64.516 us, 16.516129 ms) */
export function formatPeriod(s: number): string {
  const ns = Math.round(s / T.mccPeriodResolutionS)
  const v = ns * T.mccPeriodResolutionS
  const [k, unit] = UNITS.find(([f]) => v >= f) ?? UNITS[UNITS.length - 1]
  const digits = Math.round(Math.log10(k / T.mccPeriodResolutionS))
  return `${Number((v / k).toFixed(digits))} ${unit}`
}

/** Saisie de Timer Period : « 10 ms », « 64.516 us », « 1 s » (sans unité : ms) ; null si illisible */
export function parsePeriod(text: string): number | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(s|ms|us|µs|ns)?\s*$/.exec(text)
  if (!m) return null
  const unit = (m[2] ?? 'ms').replace('µ', 'u')
  const k = UNITS.find(([, u]) => u === unit)![0]
  return Number(m[1].replace(',', '.')) * k
}

/** Fréquence au format MCC : 32.768 kHz, 1 MHz */
export function formatFrequency(hz: number): string {
  if (hz >= MHZ) return `${Number((hz / MHZ).toFixed(6))} MHz`
  if (hz >= INFO3.units.msPerS) return `${Number((hz / INFO3.units.msPerS).toFixed(6))} kHz`
  return `${hz} Hz`
}

/* ───────────── Registres ───────────── */

export interface TimerRegisters {
  CLKCON: number
  HLT: number
  RST: number
  PR: number
  TMR: number
  CON: number
}

const HLT_PSYNC = 0x80
const HLT_CKPOL = 0x40
const HLT_CKSYNC = 0x20
const CON_ON = 0x80
const CKPS_SHIFT = 4

export const modeCode = (t: TimerConfig) => T.modes.find((m) => m.control === t.controlMode && m.start === t.startOption)?.mode ?? T.modes[0].mode
const rselOf = (t: TimerConfig) => T.ersSources.find((s) => s.label === t.ersSource)?.rsel ?? T.ersSources[0].rsel

export function timerRegisters(cfg: MccConfig, t: TimerConfig): TimerRegisters {
  return {
    CLKCON: csOf(t),
    HLT: (t.prescalerSync ? HLT_PSYNC : 0) | (t.polarity === T.polarities[1] ? HLT_CKPOL : 0) | (t.clockSync ? HLT_CKSYNC : 0) | modeCode(t),
    RST: rselOf(t),
    PR: periodRegister(cfg, t),
    TMR: 0,
    CON: (t.enabled ? CON_ON : 0) | (Math.log2(t.prescaler) << CKPS_SHIFT) | (effectivePostscaler(t) - 1),
  }
}

/** Valeur PPS d'une broche (port << 3 | bit) : RC5 → 0x15 */
export const ppsCode = (pin: string) => {
  const { port, bit } = parsePin(pin)
  return (PORT_NAMES.indexOf(port) << T.ppsPortShift) | bit
}

/** Lignes PPS d'entrée écrites à la fin de PIN_MANAGER_Initialize : « T2INPPS = 0x15;   //RC5->TMR2:T2IN; » */
export function ppsLines(cfg: MccConfig): string[] {
  return TIMER_IDS.flatMap((id) => {
    const pin = cfg.timers?.[id]?.ersPin
    const n = timerNumber(id)
    return pin ? [`    T${n}INPPS = ${hex2(ppsCode(pin))};   //${pin}->${id}:T${n}IN;`] : []
  })
}

/* ───────────── Grid View : entrée TxIN ───────────── */

export function timerGridRows(cfg: MccConfig): GridRow[] {
  return TIMER_IDS.filter((id) => cfg.timers?.[id]).map((id) => {
    const n = timerNumber(id)
    const ports = T.ersPorts[n as keyof typeof T.ersPorts] as readonly PortName[]
    return {
      id: `${id}-in`,
      module: id,
      func: `T${n}IN`,
      dir: 'input' as const,
      allowed: (pin: string) => pin !== INFO3.mcc.mclrPin && ports.includes(pin[1] as PortName),
      owns: (c: MccConfig, pin: string) => c.timers?.[id]?.ersPin === pin,
      click: (c: MccConfig, pin: string) => updateTimer(c, id, { ersPin: c.timers?.[id]?.ersPin === pin ? undefined : pin }),
      sharesWithGpio: true,
    }
  })
}

/* ───────────── Fichiers tmrX.c / tmrX.h ───────────── */

const synced = (b: boolean) => (b ? 'Synchronized' : 'Not Synchronized')

function tmrC(cfg: MccConfig, id: TimerId, t: TimerConfig): string {
  const n = timerNumber(id)
  const r = timerRegisters(cfg, t)
  const irq = timerIrqOn(cfg, id)
  const flag = `${T.irq.flag}bits.${id}IF`
  const init = [
    `void ${id}_Initialize(void)`,
    '{',
    '    // Set TMR' + n + ' to the options selected in the User Interface',
    '',
    `    // T${n}CS ${t.clockSource}; `,
    `    T${n}CLKCON = ${hex2(r.CLKCON)};`,
    '',
    `    // T${n}PSYNC ${synced(t.prescalerSync)}; T${n}MODE ${label(t.startOption, id)}; T${n}CKPOL ${t.polarity}; T${n}CKSYNC ${synced(t.clockSync)}; `,
    `    T${n}HLT = ${hex2(r.HLT)};`,
    '',
    `    // T${n}RSEL ${label(t.ersSource, id)}; `,
    `    T${n}RST = ${hex2(r.RST)};`,
    '',
    `    // PR${n} ${r.PR}; `,
    `    T${n}PR = ${hex2(r.PR)};`,
    '',
    `    // TMR${n} ${r.TMR}; `,
    `    T${n}TMR = ${hex2(r.TMR)};`,
    '',
    ...(irq
      ? ['    // Clearing IF flag before enabling the interrupt.', `    ${flag} = 0;`, '', `    // Enabling TMR${n} interrupt.`, `    ${T.irq.enable}bits.${id}IE = 1;`, '', '    // Set Default Interrupt Handler', `    ${id}_SetInterruptHandler(${id}_DefaultInterruptHandler);`, '']
      : ['    // Clearing IF flag.', `    ${flag} = 0;`, '']),
    `    // T${n}CKPS 1:${t.prescaler}; T${n}OUTPS 1:${effectivePostscaler(t)}; TMR${n}ON ${t.enabled ? 'on' : 'off'}; `,
    `    T${n}CON = ${hex2(r.CON)};`,
    '}',
  ]
  const common = `
void ${id}_Start(void)
{
    // Start the Timer by writing to TMRxON bit
    T${n}CONbits.TMR${n}ON = 1;
}

void ${id}_StartTimer(void)
{
    ${id}_Start();
}

void ${id}_Stop(void)
{
    // Stop the Timer by writing to TMRxON bit
    T${n}CONbits.TMR${n}ON = 0;
}

void ${id}_StopTimer(void)
{
    ${id}_Stop();
}

uint8_t ${id}_Counter8BitGet(void)
{
    uint8_t readVal;

    readVal = TMR${n};

    return readVal;
}

uint8_t ${id}_ReadTimer(void)
{
    return ${id}_Counter8BitGet();
}

void ${id}_Counter8BitSet(uint8_t timerVal)
{
    // Write to the Timer${n} register
    TMR${n} = timerVal;
}

void ${id}_WriteTimer(uint8_t timerVal)
{
    ${id}_Counter8BitSet(timerVal);
}

void ${id}_Period8BitSet(uint8_t periodVal)
{
   PR${n} = periodVal;
}

void ${id}_LoadPeriodRegister(uint8_t periodVal)
{
   ${id}_Period8BitSet(periodVal);
}
`
  const tail = irq
    ? `
void ${id}_ISR(void)
{

    // clear the TMR${n} interrupt flag
    ${flag} = 0;

    if(${id}_InterruptHandler)
    {
        ${id}_InterruptHandler();
    }
}


void ${id}_SetInterruptHandler(void (* InterruptHandler)(void)){
    ${id}_InterruptHandler = InterruptHandler;
}

void ${id}_DefaultInterruptHandler(void){
    // add your TMR${n} interrupt custom code
    // or set custom function using ${id}_SetInterruptHandler()
}
`
    : `
bool ${id}_HasPeriodElapsed(void)
{
    if(${flag})
    {
        // Clearing IF flag.
        ${flag} = 0;
        return true;
    }
    return false;
}
`
  return `${generatedHeader({
    title: `Driver File`,
    file: `tmr${n}.c`,
    summary: `This is the generated driver implementation file for the TMR${n} driver using PIC10 / PIC12 / PIC16 / PIC18 MCUs`,
    description: [`This source file provides APIs for TMR${n}.`],
    driver: '2.11',
  })}
/**
  Section: Included Files
*/

#include <xc.h>
#include "tmr${n}.h"
${irq ? `\nvoid (*${id}_InterruptHandler)(void);\n` : ''}
/**
  Section: TMR${n} APIs
*/

${init.join('\n')}
${common}${tail}
/**
  End of File
*/
`
}

function tmrH(cfg: MccConfig, id: TimerId): string {
  const n = timerNumber(id)
  const guard = `TMR${n}_H`
  const irq = timerIrqOn(cfg, id)
  const decls = [
    `void ${id}_Initialize(void);`,
    `void ${id}_Start(void);`,
    `void ${id}_StartTimer(void);`,
    `void ${id}_Stop(void);`,
    `void ${id}_StopTimer(void);`,
    `uint8_t ${id}_Counter8BitGet(void);`,
    `uint8_t ${id}_ReadTimer(void);`,
    `void ${id}_Counter8BitSet(uint8_t timerVal);`,
    `void ${id}_WriteTimer(uint8_t timerVal);`,
    `void ${id}_Period8BitSet(uint8_t periodVal);`,
    `void ${id}_LoadPeriodRegister(uint8_t periodVal);`,
    ...(irq ? [`void ${id}_ISR(void);`, `void ${id}_SetInterruptHandler(void (* InterruptHandler)(void));`, `extern void (*${id}_InterruptHandler)(void);`, `void ${id}_DefaultInterruptHandler(void);`] : [`bool ${id}_HasPeriodElapsed(void);`]),
  ]
  return `${generatedHeader({
    title: 'Driver File',
    file: `tmr${n}.h`,
    summary: `This is the generated header file for the TMR${n} driver using PIC10 / PIC12 / PIC16 / PIC18 MCUs`,
    description: [`This header file provides APIs for TMR${n}.`],
    driver: '2.11',
  })}
#ifndef ${guard}
#define ${guard}

/**
  Section: Included Files
*/

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus  // Provide C++ Compatibility

    extern "C" {

#endif

/**
  Section: TMR${n} APIs
*/

${decls.join('\n\n')}

#ifdef __cplusplus  // Provide C++ Compatibility

    }

#endif

#endif // ${guard}
/**
 End of File
*/
`
}

/** Pilote d'un timer ajouté au projet : fichiers, include dans mcc.h, appel dans SYSTEM_Initialize */
export const timerDriver =
  (id: TimerId) =>
  (cfg: MccConfig): DriverOutput | null => {
    const t = cfg.timers?.[id]
    if (!t) return null
    const n = timerNumber(id)
    return { files: { [`tmr${n}.c`]: tmrC(cfg, id, t), [`tmr${n}.h`]: tmrH(cfg, id) }, includes: [`tmr${n}.h`], inits: [`${id}_Initialize();`] }
  }

export const TIMER_DRIVERS = TIMER_IDS.map(timerDriver)
