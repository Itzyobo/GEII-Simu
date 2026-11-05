import { describe, expect, it } from 'vitest'
import { Vm } from '../vm/vm'
import { compile, formatDiagnostic } from '.'
import { generateXcH } from './headers'

function run(src: string, ms = 50, extra: Record<string, string> = {}) {
  const r = compile({ 'main.c': src, ...extra })
  if (!r.ok) throw new Error(r.diagnostics.map(formatDiagnostic).join('\n'))
  const vm = new Vm()
  vm.load(r.program!)
  vm.runFor({ ms })
  return vm
}

const firstError = (files: Record<string, string>) => {
  const r = compile(files)
  expect(r.ok).toBe(false)
  const e = r.diagnostics.find((d) => d.severity === 'error')!
  return e
}

describe('xc.h généré depuis INFO3.sfr', () => {
  it('déclare les SFR à leur adresse et les champs de bits', () => {
    const h = generateXcH()
    expect(h).toContain('extern volatile uint8_t PORTA __at(0x00C);')
    expect(h).toMatch(/typedef struct \{\n {4}unsigned RA0 :1;/)
    expect(h).toContain('extern volatile PORTAbits_t PORTAbits __at(0x00C);')
    for (const f of ['LATA4', 'TRISA4', 'ANSA4', 'WPUA4', 'ODCA4', 'GIE', 'PEIE', 'IOCIE', 'TMR0IE', 'INTE', 'IOCIF', 'TMR0IF', 'INTF', 'TMR2IE', 'TMR2IF', 'STKOVF']) {
      expect(h).toContain(`unsigned ${f} :1;`)
    }
  })
})

describe('champs de bits', () => {
  it('LATAbits.LATA4 = ~LATAbits.LATA4 bascule 1000 fois sans rester bloqué', () => {
    const vm = run(`#include <xc.h>
uint16_t ok = 0;
void main(void) {
    uint8_t prev;
    uint16_t n;
    TRISA = 0x0F;
    LATA = 0x00;
    prev = LATAbits.LATA4;
    for (n = 0; n < 1000; n++) {
        LATAbits.LATA4 = ~LATAbits.LATA4;
        if (LATAbits.LATA4 != prev) ok++;
        prev = LATAbits.LATA4;
    }
    while (1) { }
}
`, 1000)
    expect(vm.peekVar('ok')).toBe(1000)
    expect(vm.gpio.trace.filter((c) => c.pin === 'RA4')).toHaveLength(1000)
  })

  it('nom court __bit : LATA4 = ~LATA4 bascule aussi', () => {
    const vm = run(`#include <xc.h>
uint16_t ok = 0;
void main(void) {
    uint16_t n;
    TRISA = 0x0F;
    for (n = 0; n < 1000; n++) { uint8_t before = LATA4; LATA4 = ~LATA4; if (LATA4 != before) ok++; }
    while (1) { }
}
`, 1000)
    expect(vm.peekVar('ok')).toBe(1000)
  })

  it('struct utilisateur à champs de bits : troncature exacte', () => {
    const vm = run(`struct f { unsigned a : 3; unsigned b : 5; signed c : 4; };
struct f s;
int ra, rb, rc;
void main(void) { s.a = 9; s.b = 33; s.c = 9; ra = s.a; rb = s.b; rc = s.c; while (1) { } }
`)
    expect([vm.peekVar('ra'), vm.peekVar('rb'), vm.peekVar('rc')]).toEqual([1, 1, -7])
  })
})

describe('promotions et troncatures (int 16 bits, char non signé)', () => {
  it('12 cas', () => {
    const vm = run(`#include <stdint.h>
int32_t r[14];
void main(void) {
    uint8_t x = 0x80;
    int i = 32767;
    unsigned char c = 0x80;
    uint8_t a = 200, b = 100;
    uint16_t u = 65535;
    char ch = 0xFF;
    long l = 32767;
    int big = 300;
    uint8_t y;
    r[0] = (uint8_t)(0x0F << 4) == 0xF0;
    x <<= 1;
    r[1] = x;
    i = i + 1;
    r[2] = i;
    r[3] = c << 1;
    r[4] = a + b;
    y = a + b;
    r[5] = y;
    r[6] = (int8_t)0xFF;
    u++;
    r[7] = u;
    r[8] = ~(uint8_t)0;
    r[9] = -1 < 0u;
    r[10] = ch >> 1;
    r[11] = l + 1;
    y = big;
    r[12] = y;
    r[13] = sizeof(int) * 10 + sizeof(long);
    while (1) { }
}
`)
    expect(vm.peekVar('r')).toEqual([1, 0, -32768, 256, 300, 44, -1, 0, -1, 0, 127, 32768, 44, 24])
  })

  it('constantes repliées à la compilation : mêmes résultats', () => {
    const vm = run(`int32_t r[4];
void main(void) { r[0] = 32767 + 1; r[1] = (unsigned char)0x80 << 1; r[2] = (unsigned char)(200 + 100); r[3] = 0xFFFF + 1; while (1) { } }
#include <stdint.h>
`.replace('#include <stdint.h>\n', '').replace('int32_t', 'long'))
    // 32767 + 1 en int 16 bits déborde ; 0xFFFF est unsigned int → 0
    expect(vm.peekVar('r')).toEqual([-32768, 256, 44, 0])
  })
})

describe('langage', () => {
  it('struct, typedef, enum, tableaux 2D, pointeurs de fonction, switch, do/while, ternaire, virgule', () => {
    const vm = run(`#include <stdint.h>
typedef struct { uint8_t r, g, b; } rgb_t;
enum state_t { SET_RED, SET_GREEN = 5, SET_BLUE };
const uint8_t M[2][3] = { {1, 2, 3}, {4, 5, 6} };
int add(int a, int b) { return a + b; }
int (*op)(int, int) = add;
rgb_t mk(uint8_t v) { rgb_t c; c.r = v; c.g = v + 1; c.b = v + 2; return c; }
int r[10];
void main(void) {
    rgb_t c = mk(10);
    rgb_t *p = &c;
    enum state_t s = SET_BLUE;
    int k = 0, sum = 0;
    r[0] = p->g;
    r[1] = M[1][2] + M[0][1];
    r[2] = op(3, 4);
    switch (s) { case SET_RED: r[3] = 1; break; case SET_BLUE: r[3] = 6; break; default: r[3] = -1; }
    do { sum += k; k++; } while (k < 5);
    r[4] = sum;
    r[5] = (sum > 5) ? 100 : 200;
    r[6] = (k = 2, k * 3);
    for (int j = 0; j < 10; j++) { if (j == 3) continue; if (j == 6) break; r[7] += j; }
    r[8] = sizeof(rgb_t);
    r[9] = SET_GREEN;
    while (1) { }
}
`)
    expect(vm.peekVar('r')).toEqual([11, 8, 7, 6, 10, 100, 6, 12, 3, 5])
  })

  it('plusieurs fichiers .c liés, static local à chaque fichier', () => {
    const vm = run('int f(void);\nstatic int k = 1;\nint res;\nvoid main(void) { res = f() + k; while (1) { } }\n', 10, {
      'lib.c': 'static int k = 40;\nint f(void) { return k; }\n',
    })
    expect(vm.peekVar('res')).toBe(41)
  })

  it('printf compilé appelle putch() pour chaque caractère', () => {
    const vm = run(`#include <stdio.h>
char buf[64];
uint8_t n = 0;
void putch(char c) { buf[n++] = c; }
void main(void) { printf("%d|%u|%x|%X|%c|%s|%ld|%lu|%.2f|%%|%4d", -5, 65535u, 255, 255, 'A', "ok", 100000L, 4000000000UL, 3.14159, 7); while (1) { } }
#include <stdint.h>
`.replace('uint8_t', 'unsigned char').replace('#include <stdint.h>\n', ''))
    const bytes = vm.peekVar('buf') as number[]
    const text = String.fromCharCode(...bytes.slice(0, vm.peekVar('n') as number))
    console.info(JSON.stringify(text))
    expect(text).toBe('-5|65535|ff|FF|A|ok|100000|4000000000|3.14|%|   7')
  })

  it('préprocesseur : #define fonction multi-lignes, #ifdef/#else, #if 0, #pragma ignoré', () => {
    const vm = run(`#pragma config WDTE = OFF
#define SQUARE(x) \\
    ((x) * (x))
#define MODE 2
#ifdef MODE
#define VAL 10
#else
#define VAL 20
#endif
#if 0
cette ligne n'est jamais compilée
#endif
#ifndef ABSENT
int r = SQUARE(VAL + 1) + MODE;
#endif
void main(void) { while (1) { } }
`)
    expect(vm.peekVar('r')).toBe(123)
  })
})

describe('programmes invalides : message et ligne:colonne', () => {
  const cases: { name: string; files: Record<string, string>; file?: string; line: number; col: number; msg: RegExp }[] = [
    { name: 'identifiant non déclaré', files: { 'main.c': '#include <xc.h>\nvoid main(void) {\n    x = 1;\n}\n' }, line: 3, col: 5, msg: /use of undeclared identifier 'x'/ },
    { name: '; manquant', files: { 'main.c': 'void main(void) {\n    int a = 1\n    a++;\n}\n' }, line: 2, col: 14, msg: /expected ';'/ },
    { name: '__delay_ms(variable)', files: { 'main.c': '#define _XTAL_FREQ 1000000\n#include <xc.h>\nvoid main(void) {\n    int d = 10;\n    __delay_ms(d);\n}\n' }, line: 5, col: 16, msg: /inline delay argument must be constant/ },
    { name: '_XTAL_FREQ absent avec un delay', files: { 'main.c': '#include <xc.h>\nvoid main(void) {\n    __delay_ms(10);\n}\n' }, line: 3, col: 5, msg: /_XTAL_FREQ is not defined/ },
    { name: 'mauvais nombre d’arguments', files: { 'main.c': 'void f(int a) { }\nvoid main(void) {\n    f(1, 2);\n}\n' }, line: 3, col: 10, msg: /too many arguments to function call, expected 1, have 2/ },
    { name: 'fonction déclarée mais non définie (liaison)', files: { 'main.c': 'void g(void);\nvoid main(void) {\n    g();\n}\n' }, line: 3, col: 5, msg: /undefined symbol 'g'/ },
    { name: 'définition multiple dans 2 fichiers (liaison)', files: { 'main.c': 'void f(void) { }\nvoid main(void) { f(); }\n', 'autre.c': 'void f(void) { }\n' }, file: 'autre.c', line: 1, col: 6, msg: /multiple definition of 'f' \(first defined in main\.c:1:6\)/ },
    { name: 'goto', files: { 'main.c': 'void main(void) {\n    goto fin;\n}\n' }, line: 2, col: 5, msg: /'goto' is not supported/ },
    { name: 'union', files: { 'main.c': 'union u { int a; char b; };\nvoid main(void) { }\n' }, line: 1, col: 1, msg: /unions are not supported/ },
    { name: 'malloc', files: { 'main.c': '#include <stdlib.h>\nvoid main(void) {\n    char *p = malloc(10);\n}\n' }, line: 3, col: 15, msg: /dynamic memory allocation \('malloc'\) is not supported/ },
    { name: 'break hors boucle', files: { 'main.c': 'void main(void) {\n    break;\n}\n' }, line: 2, col: 5, msg: /'break' statement not in loop or switch statement/ },
    { name: 'affectation à une non-lvalue', files: { 'main.c': 'void main(void) {\n    int a = 0, b = 0;\n    a + b = 3;\n}\n' }, line: 3, col: 11, msg: /expression is not assignable/ },
  ]
  it('12 cas couverts', () => expect(cases).toHaveLength(12))
  it.each(cases)('$name', ({ files, file, line, col, msg }) => {
    const e = firstError(files)
    expect(formatDiagnostic(e)).toMatch(/^[\w.]+:\d+:\d+: error: /)
    expect({ file: e.file, line: e.line, col: e.col }).toEqual({ file: file ?? 'main.c', line, col })
    expect(e.message).toMatch(msg)
  })

  it('fonction variadique utilisateur refusée', () => {
    const e = firstError({ 'main.c': 'void f(int a, ...) { }\nvoid main(void) { }\n' })
    expect([e.line, e.col]).toEqual([1, 15])
    expect(e.message).toMatch(/variadic functions are not supported/)
  })

  it('deux ISR refusées', () => {
    const e = firstError({ 'main.c': 'void __interrupt() a(void) { }\nvoid __interrupt() b(void) { }\nvoid main(void) { }\n' })
    expect(e.line).toBe(2)
    expect(e.message).toMatch(/only one interrupt function/)
  })

  it('erreur dans un fichier inclus : fichier, ligne et colonne de l’en-tête', () => {
    const e = firstError({ 'main.c': '#include "lib.h"\nvoid main(void) { }\n', 'lib.h': '\nint x = ;\n' })
    expect({ file: e.file, line: e.line, col: e.col }).toEqual({ file: 'lib.h', line: 2, col: 9 })
  })
})

describe('F12 : préprocesseur, #if / #elif avec expressions constantes complètes', () => {
  const evalIf = (cond: string, extra = '') => {
    const vm = run(`${extra}\n#if ${cond}\nint r = 1;\n#else\nint r = 0;\n#endif\nvoid main(void) { while (1) { } }\n`, 1)
    return vm.peekVar('r')
  }
  it.each([
    ['(__XC8_VERSION < 1360)', '', 0],
    ['__XC8_VERSION == 2310', '', 1],
    ['defined(PIN_MANAGER_H)', '#define PIN_MANAGER_H', 1],
    ['defined PIN_MANAGER_H && !defined(MCC_H)', '#define PIN_MANAGER_H', 1],
    ['(2 + 3) * 4 == 20 && 7 % 3 == 1', '', 1],
    ['(1 << 4) > 15 || 0', '', 1],
    ['!(10 / 3 == 3)', '', 0],
    ['UNDEFINED_MACRO', '', 0],
    ['FOO > 2 ? 1 : 0', '#define FOO 3', 1],
  ])('#if %s', (cond, extra, expected) => {
    expect(evalIf(cond, extra)).toBe(expected)
  })
  it('#elif : branche ZCD = OFF de device_config.c retenue avec XC8 2.31', () => {
    const vm = run(`#if (__XC8_VERSION < 1360)\nint r = 1;\n#elif __XC8_VERSION < 2000\nint r = 2;\n#elif defined(__XC8)\nint r = 3;\n#else\nint r = 4;\n#endif\nvoid main(void) { while (1) { } }\n`, 1)
    expect(vm.peekVar('r')).toBe(3)
    const r = compile({ 'main.c': '#pragma config ZCD = OFF\n#if (__XC8_VERSION < 1360)\n#pragma config ZCDDIS = OFF\n#else\n#pragma config ZCD = ON\n#endif\nvoid main(void) { }\n' })
    expect(r.program!.config).toEqual({ ZCD: 'ON' })
  })
  it('<conio.h> virtuel ; #pragma config mal formé → erreur', () => {
    expect(compile({ 'main.c': '#include <conio.h>\nvoid main(void) { }\n' }).ok).toBe(true)
    const e = firstError({ 'main.c': '#pragma config LVP\nvoid main(void) { }\n' })
    expect([e.line, e.message]).toEqual([1, "malformed '#pragma config': expected 'SETTING = VALUE'"])
  })
})