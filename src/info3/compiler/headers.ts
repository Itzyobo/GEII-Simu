/**
 * En-têtes virtuels fournis par le simulateur (xc.h, stdint.h, stdbool.h, stdio.h, stdlib.h)
 * et unité de compilation d'exécution (printf → putch). xc.h est généré depuis INFO3.sfr.
 */
import { INFO3 } from '../../data/reference'

const HEX = 16
const hex = (v: number, digits: number) => `0x${v.toString(HEX).toUpperCase().padStart(digits, '0')}`
/** Chiffres hexadécimaux d'une adresse SFR (espace de 4096 octets → 3 chiffres) */
const ADDR_DIGITS = Math.ceil(Math.log2(INFO3.vm.memory.sfrLimit) / Math.log2(HEX))

/** Registres dont les bits ont aussi un nom court (`LATA4`, `RA4`…) déclaré en `__bit`, comme XC8 */
const SHORT_BIT_REGS = /^(PORT|LAT|TRIS|ANSEL|WPU|ODCON)[A-E]$/

export function generateXcH(): string {
  const B = INFO3.c.bitsPerByte
  const lines: string[] = [
    '/* xc.h — généré par le simulateur INFO3 depuis INFO3.sfr (src/data/reference.ts). */',
    '#ifndef _XC_H_',
    '#define _XC_H_',
    '#include <stdint.h>',
    '',
  ]
  for (const [name, def] of Object.entries(INFO3.sfr)) {
    const addr = hex(def.addr, ADDR_DIGITS)
    lines.push(`extern volatile uint8_t ${name} __at(${addr});`)
    if (def.bits.some((b) => b !== null)) {
      lines.push('typedef struct {')
      for (const b of def.bits) lines.push(b ? `    unsigned ${b} :1;` : '    unsigned :1;')
      lines.push(`} ${name}bits_t;`)
      lines.push(`extern volatile ${name}bits_t ${name}bits __at(${addr});`)
      if (SHORT_BIT_REGS.test(name)) {
        def.bits.forEach((b, i) => {
          if (b) lines.push(`extern volatile __bit ${b} __at(${hex(def.addr * B + i, ADDR_DIGITS + 1)});`)
        })
      }
    }
    lines.push('')
  }
  lines.push(
    '#define NOP() __nop()',
    '#define CLRWDT() __nop()',
    '#define di() (INTCONbits.GIE = 0)',
    '#define ei() (INTCONbits.GIE = 1)',
    '#endif',
    '',
  )
  return lines.join('\n')
}

const STDINT = `#ifndef _STDINT_H_
#define _STDINT_H_
typedef signed char int8_t;
typedef unsigned char uint8_t;
typedef signed int int16_t;
typedef unsigned int uint16_t;
typedef signed long int32_t;
typedef unsigned long uint32_t;
typedef unsigned int uintptr_t;
typedef unsigned int size_t;
#define INT8_MAX 127
#define INT8_MIN (-128)
#define UINT8_MAX 255
#define INT16_MAX 32767
#define INT16_MIN (-32767-1)
#define UINT16_MAX 65535U
#define INT32_MAX 2147483647L
#define INT32_MIN (-2147483647L-1)
#define UINT32_MAX 4294967295UL
#endif
`

const STDBOOL = `#ifndef _STDBOOL_H_
#define _STDBOOL_H_
#define bool _Bool
#define true 1
#define false 0
#endif
`

const STDIO = `#ifndef _STDIO_H_
#define _STDIO_H_
int printf(const char *fmt, ...);
void putch(char c);
#endif
`

/** <conio.h> de XC8 : seules les entrées/sorties console sont déclarées */
const CONIO = `#ifndef _CONIO_H_
#define _CONIO_H_
char getch(void);
void putch(char c);
char getche(void);
#endif
`

const STDLIB = `#ifndef _STDLIB_H_
#define _STDLIB_H_
int abs(int x);
#endif
`

/** En-têtes virtuels, résolus par #include <…> (et "…" en dernier recours) */
export function virtualHeaders(): Record<string, string> {
  return { 'xc.h': generateXcH(), 'stdint.h': STDINT, 'stdbool.h': STDBOOL, 'stdio.h': STDIO, 'stdlib.h': STDLIB, 'conio.h': CONIO }
}

/** Nom de l'unité d'exécution (définitions faibles : remplacées par celles du projet) */
export const RUNTIME_FILE = '<runtime>'
export const PRINTF_BUF = '__printf_buf'
export const PRINTF_OUT = '__printf_out'

export function runtimeSource(): string {
  return `#include <stdio.h>
#include <stdlib.h>
unsigned char ${PRINTF_BUF}[${INFO3.c.printfBufferSize}];
/* putch par défaut : ne fait rien (branché sur l'EUSART à l'étape 5) */
void putch(char c) { (void)c; }
int ${PRINTF_OUT}(unsigned char len) {
    unsigned char i;
    for (i = 0; i < len; i++) putch((char)${PRINTF_BUF}[i]);
    return len;
}
int abs(int x) { return x < 0 ? -x : x; }
`
}
