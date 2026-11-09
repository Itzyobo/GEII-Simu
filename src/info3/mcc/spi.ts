/**
 * MSSP1 en SPI maître dans MCC Classic : registres (cours p. 71 à 74), fréquence de SCK, lignes du Grid View
 * (SCK1, SDI1, SDO1 par PPS), écritures PPS de pin_manager.c (H38) et driver spi1.c / spi1.h (format H39).
 */
import { INFO3 } from '../../data/reference'
import { parsePin, PORT_NAMES, type PortName } from '../models/gpio'
import { SPI_SIGNALS, systemFosc, updateMssp, type MccConfig, type MsspConfig, type SpiSignal } from './config'
import type { GridRow } from './grid'
import { generatedHeader, hex2, type DriverOutput } from './templates'
import { actualPeriod } from './timers'

const S = INFO3.spi
const CKP_BIT = 1 << 4
const CKE_BIT = 1 << 6
const SMP_BIT = 1 << 7

export const modeOf = (n: number) => S.modes.find((m) => m.mode === n) ?? S.modes[0]
const sourceOf = (m: MsspConfig) => S.clockSources.find((c) => c.label === m.clockSource) ?? S.clockSources[0]
export const usesDivider = (m: MsspConfig) => sourceOf(m).label === 'FOSC/4_SSPxADD'

export interface SpiRegisters {
  STAT: number
  /** SSP1CON1 écrit par SPI1_Initialize (SSPEN = 0) */
  CON1: number
  ADD: number
}

export function spiRegisters(m: MsspConfig): SpiRegisters {
  const md = modeOf(m.mode)
  return {
    STAT: (m.sample === S.sampleOptions[1] ? SMP_BIT : 0) | (md.cke ? CKE_BIT : 0),
    CON1: (md.ckp ? CKP_BIT : 0) | sourceOf(m).sspm,
    ADD: usesDivider(m) ? m.divider : 0,
  }
}

/** Fréquence de SCK obtenue — Hz (null : TMR2 absent pour T2_match_PR2/2) */
export function sckFrequency(cfg: MccConfig, m: MsspConfig): number | null {
  const fcy = systemFosc(cfg.system) / INFO3.clock.foscPerTcy
  const src = sourceOf(m)
  if (src.tcy) return fcy / src.tcy
  if (usesDivider(m)) return fcy / (m.divider + 1)
  const t2 = cfg.timers?.TMR2
  return t2 ? 1 / (2 * actualPeriod(cfg, t2)) : null
}

/* ───────────── Grid View ───────────── */

const DIRS: Record<SpiSignal, 'input' | 'output'> = { SCK1: 'output', SDI1: 'input', SDO1: 'output' }

export function spiGridRows(cfg: MccConfig): GridRow[] {
  if (!cfg.mssp) return []
  return SPI_SIGNALS.map((sig) => ({
    id: `MSSP1-${sig}`,
    module: 'MSSP1',
    func: sig,
    dir: DIRS[sig],
    allowed: (pin: string) => (S.ppsPorts as readonly string[]).includes(pin[1]),
    owns: (c: MccConfig, pin: string) => c.mssp?.pins[sig] === pin,
    click: (c: MccConfig, pin: string) => updateMssp(c, { pins: { ...c.mssp!.pins, [sig]: c.mssp!.pins[sig] === pin ? null : pin } }),
  }))
}

/** Contribution de MSSP1 aux registres de port : SCK1, SDO1 en sortie, SDI1 en entrée, tous en numérique */
export function spiPortBits(cfg: MccConfig): { pin: string; output: boolean }[] {
  if (!cfg.mssp) return []
  return SPI_SIGNALS.flatMap((sig) => {
    const pin = cfg.mssp!.pins[sig]
    return pin ? [{ pin, output: DIRS[sig] === 'output' }] : []
  })
}

/* ───────────── PPS (pin_manager.c) ───────────── */

const ppsCode = (pin: string) => {
  const { port, bit } = parsePin(pin)
  return (PORT_NAMES.indexOf(port as PortName) << INFO3.timers.ppsPortShift) | bit
}

/** Écritures PPS de MSSP1, dans l'ordre de MCC (H38) */
export function spiPpsLines(cfg: MccConfig): string[] {
  const p = cfg.mssp?.pins
  if (!p) return []
  const line = (reg: string, value: number, pin: string, sig: string) => `    ${reg} = ${hex2(value)};   //${pin}->MSSP1:${sig};    `
  return [
    ...(p.SCK1 ? [line('SSP1CLKPPS', ppsCode(p.SCK1), p.SCK1, 'SCK1'), line(`${p.SCK1}PPS`, S.ppsOut.SCK1, p.SCK1, 'SCK1')] : []),
    ...(p.SDO1 ? [line(`${p.SDO1}PPS`, S.ppsOut.SDO1, p.SDO1, 'SDO1')] : []),
    ...(p.SDI1 ? [line('SSP1DATPPS', ppsCode(p.SDI1), p.SDI1, 'SDI1')] : []),
  ]
}

/* ───────────── spi1.c / spi1.h ───────────── */

function spi1C(m: MsspConfig): string {
  const r = spiRegisters(m)
  const sck = m.pins.SCK1
  const tris = sck ? `TRIS${sck[1]}bits.TRIS${sck.slice(1)}` : null
  const md = modeOf(m.mode)
  return `${generatedHeader({
    title: 'Driver File',
    file: 'spi1.c',
    summary: 'This is the generated driver implementation file for the SPI1 driver using PIC10 / PIC12 / PIC16 / PIC18 MCUs',
    description: ['This source file provides APIs for SPI1.'],
    driver: '3.0.0',
  })}
#include "spi1.h"
#include <xc.h>

typedef struct {
    uint8_t con1;
    uint8_t stat;
    uint8_t add;
    uint8_t operation;
} spi1_configuration_t;

//con1 == SSPxCON1, stat == SSPxSTAT, add == SSPxADD, operation == Master/Slave
static const spi1_configuration_t spi1_configuration[] = {
    { ${hex2(r.CON1)}, ${hex2(r.STAT)}, ${hex2(r.ADD)}, 0 }
};

void SPI1_Initialize(void)
{
    // SPI Mode ${m.mode} : CKP ${md.ckp}, CKE ${md.cke} ; Input Data Sampled at ${m.sample} ; Clock Source ${m.clockSource}
    SSP1STAT = ${hex2(r.STAT)};
    SSP1CON1 = ${hex2(r.CON1)};
    SSP1ADD = ${hex2(r.ADD)};
${tris ? `    ${tris} = 0;\n` : ''}    SSP1CON1bits.SSPEN = 0;
}

bool SPI1_Open(spi1_modes_t spi1UniqueConfiguration)
{
    if(!SSP1CON1bits.SSPEN)
    {
        SSP1STAT = spi1_configuration[spi1UniqueConfiguration].stat;
        SSP1CON1 = spi1_configuration[spi1UniqueConfiguration].con1;
        SSP1CON2 = 0x00;
        SSP1ADD  = spi1_configuration[spi1UniqueConfiguration].add;
${tris ? `        ${tris} = spi1_configuration[spi1UniqueConfiguration].operation;\n` : ''}        SSP1CON1bits.SSPEN = 1;
        return true;
    }
    return false;
}

void SPI1_Close(void)
{
    SSP1CON1bits.SSPEN = 0;
}

uint8_t SPI1_ExchangeByte(uint8_t data)
{
    SSP1BUF = data;
    while(!PIR3bits.SSP1IF);
    PIR3bits.SSP1IF = 0;
    return SSP1BUF;
}

void SPI1_ExchangeBlock(void *block, size_t blockSize)
{
    uint8_t *data = block;
    while(blockSize--)
    {
        *data = SPI1_ExchangeByte(*data );
        data++;
    }
}

// Half Duplex SPI Functions
void SPI1_WriteBlock(void *block, size_t blockSize)
{
    uint8_t *data = block;
    while(blockSize--)
    {
        SPI1_ExchangeByte(*data++);
    }
}

void SPI1_ReadBlock(void *block, size_t blockSize)
{
    uint8_t *data = block;
    while(blockSize--)
    {
        *data++ = SPI1_ExchangeByte(0);
    }
}

void SPI1_WriteByte(uint8_t byte)
{
    SSP1BUF = byte;
}

uint8_t SPI1_ReadByte(void)
{
    return SSP1BUF;
}
/**
 End of File
*/
`
}

function spi1H(): string {
  return `${generatedHeader({
    title: 'Driver File',
    file: 'spi1.h',
    summary: 'This is the generated header file for the SPI1 driver using PIC10 / PIC12 / PIC16 / PIC18 MCUs',
    description: ['This header file provides APIs for SPI1.'],
    driver: '3.0.0',
  })}
#ifndef SPI1_MASTER_H
#define SPI1_MASTER_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

/* SPI interfaces */
typedef enum {
    SPI1_DEFAULT
} spi1_modes_t;

void SPI1_Initialize(void);
bool SPI1_Open(spi1_modes_t spi1UniqueConfiguration);
void SPI1_Close(void);
uint8_t SPI1_ExchangeByte(uint8_t data);
void SPI1_ExchangeBlock(void *block, size_t blockSize);
void SPI1_WriteBlock(void *block, size_t blockSize);
void SPI1_ReadBlock(void *block, size_t blockSize);
void SPI1_WriteByte(uint8_t byte);
uint8_t SPI1_ReadByte(void);

#endif //SPI1_H
/**
 End of File
*/
`
}

export function spiDriver(cfg: MccConfig): DriverOutput | null {
  if (!cfg.mssp) return null
  return { files: { 'spi1.c': spi1C(cfg.mssp), 'spi1.h': spi1H() }, includes: ['spi1.h'], inits: ['SPI1_Initialize();'] }
}
