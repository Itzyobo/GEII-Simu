/**
 * EUSART dans MCC Classic (cours p. 104 à 110) : registres (BRG16 = BRGH = 1, SPBRG calculé), baud réel et
 * erreur, lignes TX1 / RX1 du Grid View (PPS, H44), driver eusart.c / eusart.h sans ou avec interruptions,
 * redirection STDIO (putch / getch). Format du code = H43 ; eusart_status_t en champs de bits (le simulateur
 * ne gère pas les union).
 */
import { INFO3 } from '../../data/reference'
import { baudError, baudOf, spbrgFor } from '../models/eusart'
import { systemFosc, updateEusart, type EusartConfig, type MccConfig } from './config'
import type { GridRow } from './grid'
import { generatedHeader, hex2, type DriverOutput } from './templates'
import { ppsCode } from './timers'

const E = INFO3.eusart
const B = INFO3.c.bitsPerByte
const BYTE = (1 << B) - 1
const PERCENT = 100

export interface EusartRegisters {
  BAUD1CON: number
  RC1STA: number
  TX1STA: number
  SP1BRGL: number
  SP1BRGH: number
}

const BRG16 = 1 << 3
const SPEN = 1 << 7
const CREN = 1 << 4
const TXEN = 1 << 5
const BRGH = 1 << 2

export function eusartRegisters(cfg: MccConfig, e: EusartConfig): EusartRegisters {
  const n = spbrgFor(systemFosc(cfg.system), e.baud)
  return {
    BAUD1CON: BRG16,
    RC1STA: (e.enable ? SPEN : 0) | (e.receive ? CREN : 0),
    TX1STA: (e.transmit ? TXEN : 0) | BRGH,
    SP1BRGL: n & BYTE,
    SP1BRGH: (n >> B) & BYTE,
  }
}

/** Baud réel et erreur relative (cours p. 107 et 108) */
export function eusartBaud(cfg: MccConfig, e: EusartConfig): { actual: number; error: number } {
  const r = eusartRegisters(cfg, e)
  const actual = baudOf(systemFosc(cfg.system), true, true, r.SP1BRGL | (r.SP1BRGH << B))
  return { actual, error: baudError(actual, e.baud) }
}

export const fmtPercent = (x: number) => `${x >= 0 ? '+' : ''}${(x * PERCENT).toFixed(2).replace('.', ',')} %`

/* ───────────── Notifications ───────────── */

export function eusartNotifications(cfg: MccConfig): string[] {
  const e = cfg.eusart
  if (!e) return []
  const out: string[] = []
  const { actual, error } = eusartBaud(cfg, e)
  if (Math.abs(error) > E.maxErrorRatio) out.push(`EUSART : baud réel ${Math.round(actual)} pour ${e.baud} demandés (${fmtPercent(error)}) : écart de plus de ${E.maxErrorRatio * PERCENT} %, la liaison ne fonctionnera pas (cours p. 107)`)
  if (e.transmit && !e.pins.TX1) out.push('EUSART : aucune broche TX1 choisie dans le Pin Manager: Grid View')
  if (e.receive && !e.pins.RX1) out.push('EUSART : aucune broche RX1 choisie dans le Pin Manager: Grid View')
  return out
}

/* ───────────── Grid View, port, PPS ───────────── */

const SIGNALS = [
  ['TX1', 'output'],
  ['RX1', 'input'],
] as const

export function eusartGridRows(cfg: MccConfig): GridRow[] {
  if (!cfg.eusart) return []
  return SIGNALS.map(([sig, dir]) => ({
    id: `EUSART-${sig}`,
    module: 'EUSART',
    func: sig,
    dir,
    allowed: (pin: string) => (E.ppsPorts as readonly string[]).includes(pin[1]),
    owns: (c: MccConfig, pin: string) => c.eusart?.pins[sig] === pin,
    click: (c: MccConfig, pin: string) => updateEusart(c, { pins: { ...c.eusart!.pins, [sig]: c.eusart!.pins[sig] === pin ? null : pin } }),
  }))
}

/** TX1 en sortie, RX1 en entrée, broches numériques */
export function eusartPortBits(cfg: MccConfig): { pin: string; output: boolean }[] {
  const p = cfg.eusart?.pins
  if (!p) return []
  return [...(p.TX1 ? [{ pin: p.TX1, output: true }] : []), ...(p.RX1 ? [{ pin: p.RX1, output: false }] : [])]
}

export function eusartPpsLines(cfg: MccConfig): string[] {
  const p = cfg.eusart?.pins
  if (!p) return []
  return [...(p.RX1 ? [`    RXPPS = ${hex2(ppsCode(p.RX1))};   //${p.RX1}->EUSART:RX;    `] : []), ...(p.TX1 ? [`    ${p.TX1}PPS = ${hex2(E.ppsOutTx)};   //${p.TX1}->EUSART:TX;    `] : [])]
}

/* ───────────── eusart.c / eusart.h ───────────── */

const STATUS_T = `typedef struct {
    unsigned perr : 1;
    unsigned ferr : 1;
    unsigned oerr : 1;
    unsigned reserved : 5;
} eusart_status_t;`

const STDIO_FUNCS = `
char getch(void)
{
    return EUSART_Read();
}

void putch(char txData)
{
    EUSART_Write(txData);
}`

function initRegisters(r: EusartRegisters, e: EusartConfig, baud: number) {
  return `    // ABDOVF no_overflow; SCKP Non-Inverted; BRG16 16bit_generator; WUE disabled; ABDEN disabled;
    BAUD1CON = ${hex2(r.BAUD1CON)};

    // SPEN ${e.enable ? 'enabled' : 'disabled'}; RX9 8-bit; CREN ${e.receive ? 'enabled' : 'disabled'}; ADDEN disabled; SREN disabled;
    RC1STA = ${hex2(r.RC1STA)};

    // TX9 8-bit; TX9D 0; SENDB sync_break_complete; TXEN ${e.transmit ? 'enabled' : 'disabled'}; SYNC asynchronous; BRGH hi_speed; CSRC slave;
    TX1STA = ${hex2(r.TX1STA)};

    // SP1BRGL ${r.SP1BRGL};
    SP1BRGL = ${hex2(r.SP1BRGL)};

    // SP1BRGH ${r.SP1BRGH};
    SP1BRGH = ${hex2(r.SP1BRGH)};
    // Baud Rate ${baud}`
}

const clearStatus = (v: string) => `${v}.perr = 0;\n    ${v}.ferr = 0;\n    ${v}.oerr = 0;`

function eusartPollingC(r: EusartRegisters, e: EusartConfig): string {
  return `#include "eusart.h"

/**
  Section: Global Variables
*/
volatile eusart_status_t eusartRxLastError;

/**
  Section: EUSART APIs
*/

void EUSART_Initialize(void)
{
    // Set the EUSART module to the options selected in the user interface.

${initRegisters(r, e, e.baud)}

    ${clearStatus('eusartRxLastError')}
}

bool EUSART_is_tx_ready(void)
{
    return (bool)(PIR3bits.TXIF && TX1STAbits.TXEN);
}

bool EUSART_is_rx_ready(void)
{
    return (bool)(PIR3bits.RCIF);
}

bool EUSART_is_tx_done(void)
{
    return TX1STAbits.TRMT;
}

eusart_status_t EUSART_get_last_status(void){
    return eusartRxLastError;
}

uint8_t EUSART_Read(void)
{
    while(!PIR3bits.RCIF)
    {
    }

    ${clearStatus('eusartRxLastError')}

    if(1 == RC1STAbits.OERR)
    {
        // EUSART error - restart

        RC1STAbits.CREN = 0;
        RC1STAbits.CREN = 1;
    }

    return RC1REG;
}

void EUSART_Write(uint8_t txData)
{
    while(0 == PIR3bits.TXIF)
    {
    }

    TX1REG = txData;    // Write the data byte to the USART.
}
${e.redirectStdio ? STDIO_FUNCS : ''}
/**
  End of File
*/
`
}

function eusartIrqC(r: EusartRegisters, e: EusartConfig): string {
  const N = E.swBufferSize
  return `#include "eusart.h"

/**
  Section: Macro Declarations
*/

#define EUSART_TX_BUFFER_SIZE ${N}
#define EUSART_RX_BUFFER_SIZE ${N}

/**
  Section: Global Variables
*/
volatile uint8_t eusartTxHead = 0;
volatile uint8_t eusartTxTail = 0;
volatile uint8_t eusartTxBuffer[EUSART_TX_BUFFER_SIZE];
volatile uint8_t eusartTxBufferRemaining;

volatile uint8_t eusartRxHead = 0;
volatile uint8_t eusartRxTail = 0;
volatile uint8_t eusartRxBuffer[EUSART_RX_BUFFER_SIZE];
volatile uint8_t eusartRxCount;
volatile eusart_status_t eusartRxLastError;

/**
  Section: EUSART APIs
*/
void (*EUSART_TxDefaultInterruptHandler)(void);
void (*EUSART_RxDefaultInterruptHandler)(void);

void EUSART_Initialize(void)
{
    // disable interrupts before changing states
    PIE3bits.RCIE = 0;
    EUSART_SetRxInterruptHandler(EUSART_Receive_ISR);
    PIE3bits.TXIE = 0;
    EUSART_SetTxInterruptHandler(EUSART_Transmit_ISR);
    // Set the EUSART module to the options selected in the user interface.

${initRegisters(r, e, e.baud)}

    ${clearStatus('eusartRxLastError')}

    // initializing the driver state
    eusartTxHead = 0;
    eusartTxTail = 0;
    eusartTxBufferRemaining = sizeof(eusartTxBuffer);

    eusartRxHead = 0;
    eusartRxTail = 0;
    eusartRxCount = 0;

    // enable receive interrupt
    PIE3bits.RCIE = 1;
}

bool EUSART_is_tx_ready(void)
{
    return (eusartTxBufferRemaining ? true : false);
}

bool EUSART_is_rx_ready(void)
{
    return (eusartRxCount ? true : false);
}

bool EUSART_is_tx_done(void)
{
    return TX1STAbits.TRMT;
}

eusart_status_t EUSART_get_last_status(void){
    return eusartRxLastError;
}

uint8_t EUSART_Read(void)
{
    uint8_t readValue  = 0;

    while(0 == eusartRxCount)
    {
    }

    readValue = eusartRxBuffer[eusartRxTail++];
    if(sizeof(eusartRxBuffer) <= eusartRxTail)
    {
        eusartRxTail = 0;
    }
    PIE3bits.RCIE = 0;
    eusartRxCount--;
    PIE3bits.RCIE = 1;

    return readValue;
}

void EUSART_Write(uint8_t txData)
{
    while(0 == eusartTxBufferRemaining)
    {
    }

    if(0 == PIE3bits.TXIE)
    {
        TX1REG = txData;
    }
    else
    {
        PIE3bits.TXIE = 0;
        eusartTxBuffer[eusartTxHead++] = txData;
        if(sizeof(eusartTxBuffer) <= eusartTxHead)
        {
            eusartTxHead = 0;
        }
        eusartTxBufferRemaining--;
    }
    PIE3bits.TXIE = 1;
}
${e.redirectStdio ? STDIO_FUNCS : ''}

void EUSART_Transmit_ISR(void)
{

    // add your EUSART interrupt custom code
    if(sizeof(eusartTxBuffer) > eusartTxBufferRemaining)
    {
        TX1REG = eusartTxBuffer[eusartTxTail++];
        if(sizeof(eusartTxBuffer) <= eusartTxTail)
        {
            eusartTxTail = 0;
        }
        eusartTxBufferRemaining++;
    }
    else
    {
        PIE3bits.TXIE = 0;
    }
}

void EUSART_Receive_ISR(void)
{
    ${clearStatus('eusartRxLastError')}
    if(RC1STAbits.FERR)
    {
        eusartRxLastError.ferr = 1;
    }
    if(RC1STAbits.OERR)
    {
        eusartRxLastError.oerr = 1;
        // EUSART error - restart
        RC1STAbits.CREN = 0;
        RC1STAbits.CREN = 1;
    }
    EUSART_RxDataHandler();
}

void EUSART_RxDataHandler(void)
{
    // use this default receive interrupt handler code
    eusartRxBuffer[eusartRxHead++] = RC1REG;
    if(sizeof(eusartRxBuffer) <= eusartRxHead)
    {
        eusartRxHead = 0;
    }
    eusartRxCount++;
}

void EUSART_SetTxInterruptHandler(void (* interruptHandler)(void)){
    EUSART_TxDefaultInterruptHandler = interruptHandler;
}

void EUSART_SetRxInterruptHandler(void (* interruptHandler)(void)){
    EUSART_RxDefaultInterruptHandler = interruptHandler;
}
/**
  End of File
*/
`
}

function eusartH(e: EusartConfig): string {
  const irq = e.interrupts
  return `${generatedHeader({ title: 'Driver File', file: 'eusart.h', summary: 'This is the generated header file for the EUSART driver using PIC10 / PIC12 / PIC16 / PIC18 MCUs', description: ['This header file provides APIs for driver for EUSART.'], driver: '2.1.1' })}
#ifndef EUSART_H
#define EUSART_H

/**
  Section: Included Files
*/

#include <xc.h>
#include <stdbool.h>
#include <stdint.h>${e.redirectStdio ? '\n#include <stdio.h>' : ''}

#define EUSART_DataReady  (EUSART_is_rx_ready())

${STATUS_T}

/**
 Section: Global variables
 */
${irq ? 'extern volatile uint8_t eusartTxBufferRemaining;\nextern volatile uint8_t eusartRxCount;\n\nextern void (*EUSART_TxDefaultInterruptHandler)(void);\nextern void (*EUSART_RxDefaultInterruptHandler)(void);\n' : ''}
/**
  Section: EUSART APIs
*/
void EUSART_Initialize(void);
bool EUSART_is_tx_ready(void);
bool EUSART_is_rx_ready(void);
bool EUSART_is_tx_done(void);
eusart_status_t EUSART_get_last_status(void);
uint8_t EUSART_Read(void);
void EUSART_Write(uint8_t txData);
${irq ? 'void EUSART_Transmit_ISR(void);\nvoid EUSART_Receive_ISR(void);\nvoid EUSART_RxDataHandler(void);\nvoid EUSART_SetTxInterruptHandler(void (* interruptHandler)(void));\nvoid EUSART_SetRxInterruptHandler(void (* interruptHandler)(void));\n' : ''}
#endif  // EUSART_H
/**
 End of File
*/
`
}

export function eusartDriver(cfg: MccConfig): DriverOutput | null {
  const e = cfg.eusart
  if (!e) return null
  const r = eusartRegisters(cfg, e)
  const head = generatedHeader({ title: 'Driver File', file: 'eusart.c', summary: 'This is the generated driver implementation file for the EUSART driver using PIC10 / PIC12 / PIC16 / PIC18 MCUs', description: ['This source file provides APIs for EUSART.'], driver: '2.1.1' })
  const c = `${head}\n/**\n  Section: Included Files\n*/\n${e.interrupts ? eusartIrqC(r, e) : eusartPollingC(r, e)}`
  return { files: { 'eusart.c': c, 'eusart.h': eusartH(e) }, includes: ['eusart.h'], inits: ['EUSART_Initialize();'] }
}

/** Fonctions de eusart.c et leur rôle (cours p. 110) */
export const EUSART_FUNCTIONS: [string, string][] = [
  ['EUSART_is_tx_ready', 'TXREG libre : un octet peut être écrit (TXIF)'],
  ['EUSART_is_tx_done', 'émission terminée : registre à décalage vide (TRMT)'],
  ['EUSART_is_rx_ready', 'un octet reçu attend d’être lu (RCIF)'],
  ['EUSART_Read', 'attend un octet reçu et le renvoie (RCREG)'],
  ['EUSART_Write', 'attend que TXREG soit libre puis y écrit l’octet'],
]
