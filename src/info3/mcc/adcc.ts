/**
 * ADCC dans MCC Classic (cours p. 92 à 100) : voies choisies dans le Grid View (ligne ADCC ANx, broche en
 * analogique, Custom Name dans Pin Module), registres, TAD (alerte sous 1 µs, cours p. 98), adcc.c / adcc.h
 * (format H49, voies au format du cours p. 99 : `POT = 0x0, …, channel_VSS = 0x3C`).
 */
import { INFO3 } from '../../data/reference'
import { channelOf, conversionS, tadOf } from '../models/adcc'
import { pinOrder, systemFosc, type AdccConfig, type MccConfig } from './config'
import type { GridRow } from './grid'
import { generatedHeader, hex2, type DriverOutput } from './templates'
import { formatPeriod } from './timers'

const A = INFO3.adcc
const MCLR = INFO3.mcc.mclrPin
const ADON = 1 << 7
const ADCS = 1 << 4
const ADFM = 1 << 2

/** Voies analogiques du projet (broches affectées à l'ADCC), dans l'ordre des broches */
export const adcChannels = (cfg: MccConfig) => cfg.pins.filter((p) => p.adc).sort((a, b) => pinOrder(a.pin, b.pin))

/** Nom de la fonction dans Pin Module : ANA0, AND5… */
export const anName = (pin: string) => `AN${pin.slice(1)}`

export const adccsOf = (a: AdccConfig) => a.divider / 2 - 1

export function adccTad(cfg: MccConfig, a: AdccConfig): number {
  return tadOf(systemFosc(cfg.system), a.clockSource === 'FRC', adccsOf(a))
}

export function adccRegisters(a: AdccConfig): { ADCON0: number; ADCLK: number; ADACQ: number } {
  return { ADCON0: (a.enabled ? ADON : 0) | (a.clockSource === 'FRC' ? ADCS : 0) | (a.alignment === 'right' ? ADFM : 0), ADCLK: a.clockSource === 'FRC' ? 0 : adccsOf(a), ADACQ: a.acquisition }
}

export function adccNotifications(cfg: MccConfig): string[] {
  const a = cfg.adcc
  if (!a) return []
  const tad = adccTad(cfg, a)
  const out: string[] = []
  if (tad < A.minTadS - INFO3.vm.tickEpsilon * A.minTadS) out.push(`ADCC : TAD = ${formatPeriod(tad)}, inférieur à ${formatPeriod(A.minTadS)} (cours p. 98) : choisir un diviseur plus grand`)
  if (!adcChannels(cfg).length) out.push('ADCC : aucune voie choisie (ligne ADCC ANx du Pin Manager: Grid View)')
  return out
}

/** Durée d'une conversion avec la configuration — s */
export const adccConversionS = (cfg: MccConfig, a: AdccConfig) => conversionS(adccTad(cfg, a), a.acquisition)

/* ───────────── Grid View ───────────── */

export function adccGridRows(cfg: MccConfig): GridRow[] {
  if (!cfg.adcc) return []
  return [
    {
      id: 'adcc-in',
      module: 'ADCC',
      func: 'ANx',
      dir: 'input',
      allowed: (pin) => pin !== MCLR,
      owns: (c, pin) => c.pins.some((p) => p.pin === pin && p.adc),
      click: (c, pin) =>
        c.pins.some((p) => p.pin === pin && p.adc)
          ? { ...c, pins: c.pins.filter((p) => p.pin !== pin) }
          : { ...c, pins: [...c.pins.filter((p) => p.pin !== pin), { pin, direction: 'input', customName: `channel_${anName(pin)}`, startHigh: false, analog: true, wpu: false, od: false, adc: true }] },
    },
  ]
}

/* ───────────── adcc.c / adcc.h ───────────── */

/** Enum adcc_channel_t (cours p. 99) : voies du projet par Custom Name, puis voies internes */
export function channelEnum(cfg: MccConfig): string {
  const rows = [...adcChannels(cfg).map((p) => [p.customName, channelOf(p.pin)] as const), ...A.internal.map((i) => [i.name, i.ch] as const)]
  return `typedef enum
{
${rows.map(([n, ch]) => `    ${n} = 0x${ch.toString(16).toUpperCase()}`).join(',\n')}
} adcc_channel_t;`
}

function adccC(a: AdccConfig): string {
  const r = adccRegisters(a)
  return `${generatedHeader({ title: 'Driver File', file: 'adcc.c', summary: 'This is the generated driver implementation file for the ADCC driver using PIC10 / PIC12 / PIC16 / PIC18 MCUs', description: ['This source file provides implementations for driver APIs for ADCC.'], driver: '2.1.4' })}
/**
  Section: Included Files
*/

#include <xc.h>
#include "adcc.h"

/**
  Section: ADCC Module Variables
*/
void (*ADCC_ADI_InterruptHandler)(void);

/**
  Section: ADCC Module APIs
*/

void ADCC_Initialize(void)
{
    // set the ADCC to the options selected in the User Interface
    // ADPCH ANA0;
    ADPCH = 0x00;
    // ADACQ ${r.ADACQ};
    ADACQ = ${hex2(r.ADACQ)};
    // ADCAP Additional uC disabled;
    ADCAP = 0x00;
    // ADPRE 0;
    ADPRE = 0x00;
    // ADNREF VSS; ADPREF VDD;
    ADREF = 0x00;
    // ADACT disabled;
    ADACT = 0x00;
    // ADCCS FOSC/${a.divider};
    ADCLK = ${hex2(r.ADCLK)};
    // ADGO stop; ADFM ${a.alignment}; ADON ${a.enabled ? 'enabled' : 'disabled'}; ADCONT disabled; ADCS ${a.clockSource};
    ADCON0 = ${hex2(r.ADCON0)};
${
  a.interrupt
    ? `
    // Clear the ADC interrupt flag
    PIR1bits.ADIF = 0;
    // Enabling ADCC interrupt.
    PIE1bits.ADIE = 1;

    ADCC_SetADIInterruptHandler(ADCC_DefaultInterruptHandler);
`
    : ''
}}

void ADCC_StartConversion(adcc_channel_t channel)
{
    //Selects the A/D channel
    ADPCH = channel;

    //Turn on the ADC module
    ADCON0bits.ADON = 1;

    //Start the conversion
    ADCON0bits.ADGO = 1;
}

bool ADCC_IsConversionDone(void)
{
    //Start the conversion
    return ((unsigned char)(!ADCON0bits.ADGO));
}

adc_result_t ADCC_GetConversionResult(void)
{
    //Return the result
    return ((adc_result_t)((ADRESH << 8) + ADRESL));
}

adc_result_t ADCC_GetSingleConversion(adcc_channel_t channel)
{
    //Selects the A/D channel
    ADPCH = channel;

    //Turn on the ADC module
    ADCON0bits.ADON = 1;
\t
    //Disable the continuous mode.
    ADCON0bits.ADCONT = 0;

    //Start the conversion
    ADCON0bits.ADGO = 1;


    //Wait for the conversion to finish
    while (ADCON0bits.ADGO)
    {
    }


    // Conversion finished, return the result
    return ((adc_result_t)((ADRESH << 8) + ADRESL));
}

void ADCC_StopConversion(void)
{
    //Reset the ADGO bit.
    ADCON0bits.ADGO = 0;
}

void ADCC_ISR(void)
{
    // Clear the ADCC interrupt flag
    PIR1bits.ADIF = 0;

    if (ADCC_ADI_InterruptHandler)
            ADCC_ADI_InterruptHandler();
}

void ADCC_SetADIInterruptHandler(void (* InterruptHandler)(void)){
    ADCC_ADI_InterruptHandler = InterruptHandler;
}

void ADCC_DefaultInterruptHandler(void){
    // add your ADCC interrupt custom code
    // or set custom function using ADCC_SetADIInterruptHandler() or ADCC_SetADTIInterruptHandler()
}
/**
 End of File
*/
`
}

function adccH(cfg: MccConfig): string {
  return `${generatedHeader({ title: 'Driver File', file: 'adcc.h', summary: 'This is the generated header file for the ADCC driver using PIC10 / PIC12 / PIC16 / PIC18 MCUs', description: ['This header file provides APIs for driver for ADCC.'], driver: '2.1.4' })}
#ifndef ADCC_H
#define ADCC_H

/**
  Section: Included Files
*/

#include <xc.h>
#include <stdint.h>
#include <stdbool.h>

/**
  Section: Data Types Definitions
*/

/**
 *  result size of an A/D conversion
 */

typedef uint16_t adc_result_t;

/** ADCC Channel Definition

 @Summary
   Defines the channels available for conversion.
*/

${channelEnum(cfg)}

void ADCC_Initialize(void);
void ADCC_StartConversion(adcc_channel_t channel);
bool ADCC_IsConversionDone(void);
adc_result_t ADCC_GetConversionResult(void);
adc_result_t ADCC_GetSingleConversion(adcc_channel_t channel);
void ADCC_StopConversion(void);
void ADCC_ISR(void);
void ADCC_SetADIInterruptHandler(void (* InterruptHandler)(void));
extern void (*ADCC_ADI_InterruptHandler)(void);
void ADCC_DefaultInterruptHandler(void);

#endif  //ADCC_H
/**
 End of File
*/
`
}

export function adccDriver(cfg: MccConfig): DriverOutput | null {
  const a = cfg.adcc
  if (!a) return null
  return { files: { 'adcc.c': adccC(a), 'adcc.h': adccH(cfg) }, includes: ['adcc.h'], inits: ['ADCC_Initialize();'] }
}

