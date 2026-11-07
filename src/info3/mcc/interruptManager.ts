/**
 * Pilote « Interrupt Module » du générateur : interrupt_manager.c et interrupt_manager.h, ajoutés dès qu'une
 * source d'interruption est activée (cours p. 39 et 59 ; en-têtes et commentaires = H34).
 */
import { generatedHeader, type DriverOutput } from './templates'
import { activeSources, interruptManagerBody } from './interrupts'
import type { MccConfig } from './config'

const macro = (desc: string, name: string, body: string) => `/**
 * @Param
    none
 * @Returns
    none
 * @Description
    ${desc}
 * @Example
    ${name}();
 */
#define ${name}() (${body})`

export function interruptManagerFiles(cfg: MccConfig): DriverOutput | null {
  if (activeSources(cfg).length === 0) return null
  const c = `${generatedHeader({
    title: 'Interrupt Manager Source File',
    file: 'interrupt_manager.c',
    summary: 'This is the Interrupt Manager file generated using PIC10 / PIC12 / PIC16 / PIC18 MCUs',
    description: ['This header file provides implementations for global interrupt handling.', 'For individual peripheral handlers please see the peripheral driver for', 'all modules selected in the GUI.'],
    driver: '2.04',
  })}
#include "interrupt_manager.h"
#include "mcc.h"

void __interrupt() INTERRUPT_InterruptManager (void)
{
${interruptManagerBody(cfg)}
}
/**
 End of File
*/
`
  const h = `${generatedHeader({
    title: 'Interrupt Manager File',
    file: 'interrupt_manager.h',
    summary: 'This is the Interrupt Manager file generated using PIC10 / PIC12 / PIC16 / PIC18 MCUs',
    description: ['This header file provides implementations for global interrupt handling.', 'For individual peripheral handlers please see the peripheral driver for', 'all modules selected in the GUI.'],
    driver: '2.03',
  })}
#ifndef INTERRUPT_MANAGER_H
#define INTERRUPT_MANAGER_H


${macro('This macro will enable global interrupts.', 'INTERRUPT_GlobalInterruptEnable', 'INTCONbits.GIE = 1')}

${macro('This macro will disable global interrupts.', 'INTERRUPT_GlobalInterruptDisable', 'INTCONbits.GIE = 0')}
${macro('This macro will enable peripheral interrupts.', 'INTERRUPT_PeripheralInterruptEnable', 'INTCONbits.PEIE = 1')}

${macro('This macro will disable peripheral interrupts.', 'INTERRUPT_PeripheralInterruptDisable', 'INTCONbits.PEIE = 0')}


#endif  // INTERRUPT_MANAGER_H
/**
 End of File
*/
`
  return { files: { 'interrupt_manager.c': c, 'interrupt_manager.h': h }, includes: ['interrupt_manager.h'], inits: [] }
}
