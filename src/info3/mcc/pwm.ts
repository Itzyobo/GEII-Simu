/**
 * CCP1 en mode PWM, PWM6 et PWM7 dans MCC Classic (cours p. 85 à 90) : registres calculés depuis la
 * configuration, période et résolution affichées, lignes du Grid View (sorties par PPS), écritures PPS de
 * pin_manager.c (H44), drivers ccp1.c/.h, pwm6.c/.h, pwm7.c/.h (format H42), notifications MCC (H41).
 */
import { INFO3 } from '../../data/reference'
import { PWM_IDS, timerNumber, updatePwm, type MccConfig, type PwmConfig, type PwmId } from './config'
import type { GridRow } from './grid'
import { generatedHeader, hex2, type DriverOutput } from './templates'
import { actualPeriod, formatFrequency, formatPeriod, periodRegister } from './timers'

const P = INFO3.pwm
const B = INFO3.c.bitsPerByte
const TWO = P.dutyBits - B
const PERCENT = 100
const EN = 1 << (B - 1)
const POL = 1 << 4
const FMT = 1 << 4
const moduleOf = (id: PwmId) => P.modules.find((m) => m.id === id)!
/** Numéro du driver MCC : CCP1 → PWM1, PWM6 → PWM6 */
export const driverName = (id: PwmId) => (id === 'CCP1' ? 'PWM1' : id)
/** Fonction de sortie du Grid View et de la ligne PPS */
const outName = (id: PwmId) => (id === 'CCP1' ? 'CCP1' : `${id}OUT`)

/** Configurations PWM présentes */
export const pwmEntries = (cfg: MccConfig): [PwmId, PwmConfig][] => PWM_IDS.filter((id) => cfg.pwm?.[id]).map((id) => [id, cfg.pwm![id]!])

/** PR du timer choisi (lu dans sa configuration MCC), null si le timer n'est pas dans le projet */
export function pwmPr(cfg: MccConfig, c: PwmConfig): number | null {
  const t = cfg.timers?.[c.timer]
  return t ? periodRegister(cfg, t) : null
}

/** Seuil 10 bits correspondant au Duty Cycle (%) : 4 × (PR + 1) × % / 100 */
export function dutyValue(cfg: MccConfig, c: PwmConfig): number {
  const pr = pwmPr(cfg, c) ?? (1 << B) - 1
  return Math.min((1 << P.dutyBits) - 1, Math.round((P.dutyPerCount * (pr + 1) * c.dutyCycle) / PERCENT))
}

/** Période PWM — s (= période du timer, sans postscaler), null sans timer */
export function pwmPeriod(cfg: MccConfig, c: PwmConfig): number | null {
  const t = cfg.timers?.[c.timer]
  return t ? actualPeriod(cfg, t) : null
}

/** Résolution — bits : log2(4 × (PR + 1)) */
export function pwmResolution(cfg: MccConfig, c: PwmConfig): number | null {
  const pr = pwmPr(cfg, c)
  return pr === null ? null : Math.log2(P.dutyPerCount * (pr + 1))
}

export interface PwmRegisters {
  CON: number
  /** CCP1 : CCPR1H, CCPR1L ; PWMx : PWMxDCH, PWMxDCL */
  H: number
  L: number
  tsel: number
}

export function pwmRegisters(cfg: MccConfig, id: PwmId, c: PwmConfig): PwmRegisters {
  const dc = dutyValue(cfg, c)
  const tsel = Number(Object.entries(P.timerSelect).find(([, n]) => n === timerNumber(c.timer))?.[0] ?? 1)
  if (id === 'CCP1') {
    const left = c.alignment === 'left_aligned'
    const v = left ? dc << (B - TWO) : dc
    return { CON: EN | (left ? FMT : 0) | P.ccpPwmMode, H: (v >> B) & ((1 << B) - 1), L: v & ((1 << B) - 1), tsel }
  }
  return { CON: (c.enabled ? EN : 0) | (c.polarity === 'active_lo' ? POL : 0), H: dc >> TWO, L: (dc & ((1 << TWO) - 1)) << (B - TWO), tsel }
}

/* ───────────── Notifications [MCC] ───────────── */

export function pwmNotifications(cfg: MccConfig): string[] {
  const out: string[] = []
  for (const [id, c] of pwmEntries(cfg)) {
    const t = cfg.timers?.[c.timer]
    if (!t) out.push(`${id} : ${c.timer} n’est pas dans le projet, la PWM n’a pas de base de temps (Device Resources › Timer › ${c.timer})`)
    else if (t.clockSource !== P.requiredClock) out.push(`${id} : ${c.timer} doit avoir la source ${P.requiredClock} pour la PWM (cours p. 85), « ${t.clockSource} » choisie`)
    if (!c.pin) out.push(`${id} : aucune broche de sortie choisie dans le Pin Manager: Grid View`)
  }
  return out
}

/* ───────────── Grid View et broches ───────────── */

export function pwmGridRows(cfg: MccConfig): GridRow[] {
  return pwmEntries(cfg).map(([id]) => ({
    id: `${id}-out`,
    module: id,
    func: outName(id),
    dir: 'output' as const,
    allowed: (pin: string) => (P.ppsPorts as readonly string[]).includes(pin[1]),
    owns: (c: MccConfig, pin: string) => c.pwm?.[id]?.pin === pin,
    click: (c: MccConfig, pin: string) => updatePwm(c, id, { pin: c.pwm?.[id]?.pin === pin ? null : pin }),
  }))
}

/** Contribution aux registres de port : sortie numérique (TRIS = 0, ANSEL = 0) */
export const pwmPortBits = (cfg: MccConfig): { pin: string; output: boolean }[] => pwmEntries(cfg).flatMap(([, c]) => (c.pin ? [{ pin: c.pin, output: true }] : []))

/** Écritures RxyPPS de pin_manager.c (format = H44) */
export const pwmPpsLines = (cfg: MccConfig): string[] =>
  pwmEntries(cfg).flatMap(([id, c]) => (c.pin ? [`    ${c.pin}PPS = ${hex2(moduleOf(id).ppsOut)};   //${c.pin}->${id}:${outName(id)};    `] : []))

/* ───────────── ccp1.c / .h ───────────── */

/** Corps de PWM1_LoadDutyValue (cours p. 89 ; texte = H42) */
export const PWM1_LOAD_DUTY_BODY = `    dutyValue &= 0x03FF;

    // Load duty cycle value
    if(CCP1CONbits.CCP1FMT)
    {
        dutyValue <<= 6;
        CCPR1H = dutyValue >> 8;
        CCPR1L = dutyValue;
    }
    else
    {
        CCPR1H = dutyValue >> 8;
        CCPR1L = dutyValue;
    }`

/** Corps de PWMx_LoadDutyValue (cours p. 90 ; texte = H42) : 8 MSB dans PWMxDCH, 2 LSB en tête de PWMxDCL */
export const pwmxLoadDutyBody = (n: string) => `     // Writing to 8 MSBs of PWM duty cycle in PWMDCH register
     PWM${n}DCH = (dutyValue & 0x03FC)>>2;

     // Writing to 2 LSBs of PWM duty cycle in PWMDCL register
     PWM${n}DCL = (dutyValue & 0x0003)<<6;`

const header = (file: string, what: string) =>
  generatedHeader({ title: 'Driver File', file, summary: `This is the generated driver ${what} file for the ${file.split('.')[0].toUpperCase()} driver using PIC10 / PIC12 / PIC16 / PIC18 MCUs`, description: [`This ${what === 'header' ? 'header' : 'source'} file provides APIs for driver for ${file.split('.')[0].toUpperCase()}.`], driver: '2.01' })

function ccp1C(cfg: MccConfig, c: PwmConfig): string {
  const r = pwmRegisters(cfg, 'CCP1', c)
  return `${header('ccp1.c', 'implementation')}
/**
  Section: Included Files
*/

#include <xc.h>
#include "ccp1.h"

/**
  Section: PWM Module APIs
*/

void PWM1_Initialize(void)
{
    // Set the PWM1 to the options selected in the User Interface
\t
\t// MODE PWM; EN enabled; FMT ${c.alignment ?? 'right_aligned'};
\tCCP1CON = ${hex2(r.CON)};
\t
\t// RH ${r.H};
\tCCPR1H = ${hex2(r.H)};
\t
\t// RL ${r.L};
\tCCPR1L = ${hex2(r.L)};

\t// Selecting Timer ${timerNumber(c.timer)}
\tCCPTMRS0bits.C1TSEL = 0x${r.tsel};

}

void PWM1_LoadDutyValue(uint16_t dutyValue)
{
${PWM1_LOAD_DUTY_BODY}
}

bool PWM1_OutputStatusGet(void)
{
    // Returns the output status
    return(CCP1CONbits.CCP1OUT);
}
/**
 End of File
*/
`
}

function ccp1H(cfg: MccConfig, c: PwmConfig): string {
  return `${header('ccp1.h', 'header')}
#ifndef CCP1_H
#define CCP1_H

/**
  Section: Included Files
*/

#include <xc.h>
#include <stdint.h>
#include <stdbool.h>

/** Default Duty Cycle

  @Summary
    Defines the default duty cycle value
*/
#define PWM1_INITIALIZE_DUTY_VALUE    ${dutyValue(cfg, c)}

void PWM1_Initialize(void);
void PWM1_LoadDutyValue(uint16_t dutyValue);
bool PWM1_OutputStatusGet(void);

#endif // CCP1_H
/**
 End of File
*/
`
}

/* ───────────── pwm6.c / pwm7.c ───────────── */

function pwmxC(cfg: MccConfig, id: PwmId, c: PwmConfig): string {
  const n = id.slice(3)
  const r = pwmRegisters(cfg, id, c)
  const dc = dutyValue(cfg, c)
  const file = `pwm${n}.c`
  return `${header(file, 'implementation')}
/**
  Section: Included Files
*/

#include <xc.h>
#include "pwm${n}.h"

/**
  Section: PWM Module APIs
*/

void PWM${n}_Initialize(void)
{
    // Set the PWM${n} to the options selected in the User Interface
\t
\t// PWM${n}POL ${c.polarity}; PWM${n}EN ${c.enabled ? 'enabled' : 'disabled'};
    PWM${n}CON = ${hex2(r.CON)};

\t// DC ${dc >> TWO};
    PWM${n}DCH = ${hex2(r.H)};

\t// DC ${dc & ((1 << TWO) - 1)};
    PWM${n}DCL = ${hex2(r.L)};

\t// Select timer
    CCPTMRS1bits.P${n}TSEL = ${r.tsel};
}

void PWM${n}_LoadDutyValue(uint16_t dutyValue)
{
${pwmxLoadDutyBody(n)}
}
/**
 End of File
*/
`
}

function pwmxH(cfg: MccConfig, id: PwmId, c: PwmConfig): string {
  const n = id.slice(3)
  return `${header(`pwm${n}.h`, 'header')}
#ifndef PWM${n}_H
#define PWM${n}_H

/**
  Section: Included Files
*/

#include <xc.h>
#include <stdint.h>

#define PWM${n}_INITIALIZE_DUTY_VALUE    ${dutyValue(cfg, c)}

void PWM${n}_Initialize(void);
void PWM${n}_LoadDutyValue(uint16_t dutyValue);

#endif // PWM${n}_H
/**
 End of File
*/
`
}

/** Drivers PWM, dans l'ordre CCP1, PWM6, PWM7 */
export function pwmDriver(cfg: MccConfig): DriverOutput | null {
  const entries = pwmEntries(cfg)
  if (!entries.length) return null
  const files: Record<string, string> = {}
  const includes: string[] = []
  const inits: string[] = []
  for (const [id, c] of entries) {
    if (id === 'CCP1') {
      files['ccp1.c'] = ccp1C(cfg, c)
      files['ccp1.h'] = ccp1H(cfg, c)
      includes.push('ccp1.h')
    } else {
      const n = id.slice(3)
      files[`pwm${n}.c`] = pwmxC(cfg, id, c)
      files[`pwm${n}.h`] = pwmxH(cfg, id, c)
      includes.push(`pwm${n}.h`)
    }
    inits.push(`${driverName(id)}_Initialize();`)
  }
  return { files, includes, inits }
}

/** Libellés affichés par le panneau : période, fréquence, résolution */
export function pwmSummary(cfg: MccConfig, c: PwmConfig): { period: string; frequency: string; resolution: string } {
  const p = pwmPeriod(cfg, c)
  const r = pwmResolution(cfg, c)
  return { period: p === null ? '—' : formatPeriod(p), frequency: p === null ? '—' : formatFrequency(1 / p), resolution: r === null ? '—' : String(r) }
}

