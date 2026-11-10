/** EUSART : MCC, code généré, modèle dans la VM, terminal (consigne étape 5, tests 4 à 7). */
import { describe, expect, it } from 'vitest'
import { INFO3 } from '../../data/reference'
import { compile, formatDiagnostic } from '../compiler'
import { frameBits } from '../models/eusart'
import { SerialTerminal, terminalText } from '../models/terminal'
import { Vm } from '../vm/vm'
import { updateEusart, type MccConfig } from './config'
import { eusartBaud, eusartNotifications, eusartRegisters, EUSART_FUNCTIONS } from './eusart'
import { generate } from './generator'
import { interruptTable } from './interrupts'
import { tp51Config } from './presets'

const DIR = INFO3.mcc.dir
const TB = INFO3.clock.timeBaseHz
const HEAD = '#include "mcc_generated_files/mcc.h"\n'

function boot(main: string, cfg: MccConfig = tp51Config()) {
  const r = compile({ 'main.c': main, ...generate(cfg) })
  if (!r.ok) throw new Error(r.diagnostics.map(formatDiagnostic).join('\n'))
  const vm = new Vm()
  vm.load(r.program!)
  return vm
}
const once = (body: string) => `${HEAD}void main(void)\n{\n    SYSTEM_Initialize();\n${body}\n    while (1) {}\n}\n`
/** Terminal branché sur RC6, alimenté par les changements de broche de la VM */
function terminal(vm: Vm, baud = 9600, plugged = true) {
  const term = new SerialTerminal(TB, baud)
  term.connect(plugged)
  vm.onPinChange((c) => c.pin === INFO3.eusart.defaultPins.TX1 && term.edge(c.t, c.level))
  return term
}
const bytesOf = (s: string) => [...s].map((c) => c.charCodeAt(0))

describe('MCC EUSART (test 4)', () => {
  it('9600 bauds à 4 MHz : BRG16 = BRGH = 1, SP1BRGL = 0x67, SP1BRGH = 0x00, baud réel 9615 (+0,16 %)', () => {
    const c = tp51Config()
    expect(eusartRegisters(c, c.eusart!)).toEqual({ BAUD1CON: 0x08, RC1STA: 0x90, TX1STA: 0x24, SP1BRGL: 0x67, SP1BRGH: 0x00 })
    const b = eusartBaud(c, c.eusart!)
    expect(Math.round(b.actual)).toBe(9615)
    expect(b.error * 100).toBeCloseTo(0.16, 2)
    const g = generate(c)
    expect(g[`${DIR}/eusart.c`]).toContain('    SP1BRGL = 0x67;')
    expect(g[`${DIR}/eusart.c`]).toContain('    SP1BRGH = 0x00;')
    expect(g[`${DIR}/pin_manager.c`]).toContain('RC6PPS = 0x10;   //RC6->EUSART:TX;')
    expect(g[`${DIR}/pin_manager.c`]).toContain('RXPPS = 0x17;   //RC7->EUSART:RX;')
    expect(eusartNotifications(c)).toEqual([])
  })
  it('fonctions du cours p. 110 et redirection STDIO : putch → EUSART_Write, getch → EUSART_Read', () => {
    const c = generate(tp51Config())[`${DIR}/eusart.c`]
    for (const [f] of EUSART_FUNCTIONS) expect(c, f).toMatch(new RegExp(`\\b${f}\\(`))
    expect(c).toContain('void putch(char txData)\n{\n    EUSART_Write(txData);\n}')
    expect(c).toContain('char getch(void)\n{\n    return EUSART_Read();\n}')
    expect(generate(updateEusart(tp51Config(), { redirectStdio: false }))[`${DIR}/eusart.c`]).not.toContain('putch')
  })
  it('écart de plus de 5 % signalé : 115200 bauds à 1 MHz', () => {
    let c = tp51Config()
    c = updateEusart({ ...c, system: { ...c.system, hfMHz: 1 } }, { baud: 115200 })
    expect(eusartNotifications(c).join(' ')).toContain('écart de plus de 5 %')
  })
  it('trame de 0x41 sur RC6 : 1,040 ms ± 1 %, start 0, LSB en premier, stop 1 (vérifiée bit à bit)', () => {
    const vm = boot(once('    EUSART_Write(0x41);'))
    vm.runFor({ ms: 5 })
    const edges = vm.gpio.trace.filter((c) => c.pin === 'RC6')
    const start = edges.find((c) => c.level === 0)!
    const bitS = 1 / vm.baud
    expect(Math.round(vm.baud)).toBe(9615)
    const levelAt = (t: number) => {
      let l = 1
      for (const e of edges) if (e.t <= t) l = e.level
      return l
    }
    const bits = Array.from({ length: 10 }, (_, k) => levelAt(start.t + (k + 0.5) * bitS * TB))
    expect(bits).toEqual(frameBits(0x41))
    expect(bits).toEqual([0, 1, 0, 0, 0, 0, 0, 1, 0, 1])
    // Durée de l'octet : du start au retour au repos après le stop
    const stopEnd = start.t + 10 * bitS * TB
    expect(Math.abs((stopEnd - start.t) / TB - 1.04e-3) / 1.04e-3).toBeLessThanOrEqual(0.01)
    expect(vm.eusart.sent.map((s) => s.byte)).toEqual([0x41])
  })
})

describe('terminal (test 5)', () => {
  const msg = 'Bonjour (R,G,B)\r\n'
  const prog = once(`    printf("${msg.replace('\r', '\\r').replace('\n', '\\n')}");`)
  it('terminal à 9600 bauds : texte identique, octet pour octet', () => {
    const vm = boot(prog)
    const term = terminal(vm)
    vm.runFor({ ms: 40 })
    term.poll(vm.t)
    expect(term.received.map((b) => b.byte)).toEqual(bytesOf(msg))
    expect(terminalText(term.received.map((b) => b.byte), false)).toBe('Bonjour (R,G,B)\n')
    expect(terminalText(bytesOf('a\r\n'), true)).toBe('a\\r\\n\n')
  })
  it('terminal à 19 200 bauds alors que le PIC émet à 9600 : texte reçu ≠ texte émis', () => {
    const vm = boot(prog)
    const term = terminal(vm, 19200)
    vm.runFor({ ms: 40 })
    term.poll(vm.t)
    expect(term.received.length).toBeGreaterThan(0)
    expect(term.received.map((b) => b.byte)).not.toEqual(bytesOf(msg))
  })
  it('sans USB blanc : terminal vide', () => {
    const vm = boot(prog)
    const term = terminal(vm, 9600, false)
    vm.runFor({ ms: 40 })
    expect(term.poll(vm.t)).toEqual([])
    expect(term.received).toEqual([])
  })
  it('réception : octets tapés au terminal → EUSART_Read', () => {
    const vm = boot(`${HEAD}volatile uint8_t got[2];\nvoid main(void)\n{\n    SYSTEM_Initialize();\n    got[0] = EUSART_Read();\n    got[1] = getch();\n    while (1) {}\n}\n`)
    // L'USB blanc tient la ligne RX du PIC au repos (1)
    vm.setExternal('RC7', 1)
    vm.runFor({ ms: 1 })
    const term = new SerialTerminal(TB)
    for (const e of term.sendEdges([0x31, 0x7a], vm.t)) vm.setExternal('RC7', e.level, e.t)
    vm.runFor({ ms: 10 })
    expect(vm.peekVar('got')).toEqual([0x31, 0x7a])
  })
})

/** Texte émis sur RC6 par un programme (octets de l'EUSART) */
function sent(main: string, ms = 60) {
  const vm = boot(main)
  vm.runFor({ ms })
  return String.fromCharCode(...vm.eusart.sent.map((s) => s.byte))
}

describe('printf conforme à XC8 (test 6)', () => {
  it('printf("(R,G,B) = (%d,%d,%d)\\r\\n", 255, 0, 0) : octets exacts', () => {
    expect(sent(once('    printf("(R,G,B) = (%d,%d,%d)\\r\\n", 255, 0, 0);'))).toBe('(R,G,B) = (255,0,0)\r\n')
  })
  it('%u d’un uint8_t, %x, %ld, %d d’un int16_t négatif', () => {
    const src = once('    uint8_t u = 200;\n    int16_t n = -1234;\n    int32_t l = 100000L;\n    printf("%u|%x|%X|%ld|%d|%5d|%-3u|", u, 0xBEEF, 0xBEEF, l, n, n, (uint8_t)7);')
    expect(sent(src, 80)).toBe('200|beef|BEEF|100000|-1234|-1234|7  |')
  })
})

describe('ralentissement (test 7) : un printf de 20 caractères sans délai', () => {
  it('≈ 48 itérations par seconde à 9600 bauds (± 5 %)', () => {
    const vm = boot(`${HEAD}volatile uint16_t n = 0;\nvoid main(void)\n{\n    SYSTEM_Initialize();\n    while (1)\n    {\n        printf("0123456789ABCDEFGH\\r\\n");\n        n++;\n    }\n}\n`)
    vm.runFor({ ms: 1000 })
    const a = vm.peekVar('n') as number
    vm.runFor({ ms: 2000 })
    const perS = ((vm.peekVar('n') as number) - a) / 2
    expect(Math.abs(perS - 48) / 48, `${perS} itérations/s`).toBeLessThanOrEqual(0.05)
    // Un caractère toutes les 1,04 ms environ
    const s = vm.eusart.sent
    const dt = (s[s.length - 1].t - s[s.length - 101].t) / 100 / TB
    expect(Math.abs(dt - 1.04e-3) / 1.04e-3).toBeLessThanOrEqual(0.01)
  })
})

describe('EUSART avec interruptions', () => {
  it('Enable EUSART Interrupts : TXI et RCI dans la table, printf passe par le tampon et l’ISR', () => {
    const cfg = tp51Config(16, true)
    expect(interruptTable(cfg).map((r) => `${r.module} ${r.interrupt}`)).toEqual(['EUSART TXI', 'EUSART RCI'])
    const im = generate(cfg)[`${DIR}/interrupt_manager.c`]
    expect(im).toContain('if(PIE3bits.TXIE == 1 && PIR3bits.TXIF == 1)')
    expect(im).toContain('EUSART_TxDefaultInterruptHandler();')
    const vm = boot(`${HEAD}void main(void)\n{\n    SYSTEM_Initialize();\n    INTERRUPT_GlobalInterruptEnable();\n    INTERRUPT_PeripheralInterruptEnable();\n    printf("(R,G,B) = (%d,%d,%d)\\r\\n", 255, 0, 0);\n    while (1) {}\n}\n`, cfg)
    vm.runFor({ ms: 60 })
    expect(String.fromCharCode(...vm.eusart.sent.map((s) => s.byte))).toBe('(R,G,B) = (255,0,0)\r\n')
  })
})
