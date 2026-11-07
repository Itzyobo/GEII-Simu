/**
 * Fixtures du CR TP1 avec la configuration MCC du TP1 (appuis « propres » sauf mention contraire).
 * Tolérances du PRD §3.5 et §7 (étape 1) : non négociables.
 */
import { describe, expect, it } from 'vitest'
import { INFO3 } from '../../data/reference'
import { compile, formatDiagnostic } from '../compiler'
import { implementedMask, parsePin, PORT_NAMES } from '../models/gpio'
import { busValues, intervals, pinEdges } from '../vm/trace'
import { Vm } from '../vm/vm'
import { CR_FIXTURES, crProject, MCC_DIR, MCC_TP1, project } from '.'

const LED_PINS = INFO3.pins.leds.map((l) => l.pin)
const S1 = INFO3.pins.buttons.find((b) => b.name === 'S1')!
const TOL = 0.005

function boot(files: Record<string, string>) {
  const r = compile(files)
  if (!r.ok) throw new Error(r.diagnostics.map(formatDiagnostic).join('\n'))
  const vm = new Vm()
  vm.load(r.program!)
  return vm
}

const expectRel = (measured: number, target: number, tol = TOL) => {
  expect(Math.abs(measured - target) / target, `${measured} s au lieu de ${target} s`).toBeLessThanOrEqual(tol)
}

/** Rotation sur 4 bits (modèle de référence du chenillard) */
const MASK4 = 0x0f
const rotl4 = (m: number) => ((m << 1) | (m >> 3)) & MASK4
const rotr4 = (m: number) => ((m >> 1) | (m << 3)) & MASK4

/** Motifs affichés sur D5…D2 (bit 0 = D2) */
const ledWords = (vm: Vm) => busValues(vm.gpio.trace, LED_PINS)

describe('fixtures du CR TP1 : compilation', () => {
  it.each(Object.keys(CR_FIXTURES).filter((id) => id.startsWith('tp1/')))('%s compile sans erreur avec mcc-tp1', (id) => {
    const r = compile(crProject(id))
    expect(r.diagnostics.filter((d) => d.severity === 'error').map(formatDiagnostic)).toEqual([])
    expect(r.ok).toBe(true)
  })
})

describe('TP1 3.3 — LED_D2_Toggle + __delay_ms(500)', () => {
  it('période de D2 = 1,000 s ± 0,5 % sur 5 périodes', () => {
    const vm = boot(crProject('tp1/q3_3'))
    vm.runFor({ ms: 6000 })
    const rises = pinEdges(vm.gpio.trace, 'RA4', 1).map((t) => vm.toS(t))
    expect(rises.length).toBeGreaterThanOrEqual(6)
    const periods = intervals(rises.slice(0, 6))
    expect(periods).toHaveLength(5)
    for (const p of periods) expectRel(p, 1.0)
  })
})

describe('TP1 3.5 — chenillard 4 bits', () => {
  it('D2 → D3 → D4 → D5 → D2, 1 pas = 1,000 s ± 0,5 %, RA0–RA3 jamais modifiées', () => {
    const vm = boot(crProject('tp1/q3_5'))
    const lowNibble: number[] = []
    for (let k = 0; k < 9; k++) {
      vm.runFor({ ms: 1000 })
      lowNibble.push(vm.readSfr('LATA') & MASK4)
    }
    const words = ledWords(vm)
    // Séquence attendue : un seul bit, décalé vers la gauche, retour à D2 après D5
    const expected: number[] = []
    const last = 1 << (LED_PINS.length - 1)
    let m = 1
    for (let k = 0; k < words.length; k++) {
      expected.push(m)
      m = m === last ? 1 : m * 2
    }
    expect(words.map((w) => w.value)).toEqual(expected)
    expect(words.length).toBeGreaterThanOrEqual(8)
    for (const p of intervals(words.map((w) => vm.toS(w.t)))) expectRel(p, 1.0)
    expect(vm.gpio.trace.filter((c) => ['RA0', 'RA1', 'RA2', 'RA3'].includes(c.pin))).toEqual([])
    expect(lowNibble.every((v) => v === 0)).toBe(true)
  })
})

describe('TP1 3.6 — chenillard bidirectionnel (motif 0110)', () => {
  it('S1 relâché → gauche ; S1 maintenu → droite ; pas = 0,500 s ± 0,5 %', () => {
    const vm = boot(crProject('tp1/q3_6'))
    vm.runFor({ ms: 2600 })
    const left = ledWords(vm)
    const seqL = [0b0110]
    while (seqL.length < left.length) seqL.push(rotl4(seqL[seqL.length - 1]))
    expect(left.map((w) => w.value)).toEqual(seqL)
    const n = left.length
    vm.press('S1')
    vm.runFor({ ms: 2600 })
    const all = ledWords(vm)
    const right = all.slice(n)
    const seqR = [rotr4(seqL[seqL.length - 1])]
    while (seqR.length < right.length) seqR.push(rotr4(seqR[seqR.length - 1]))
    expect(right.map((w) => w.value)).toEqual(seqR)
    expect(right.length).toBeGreaterThanOrEqual(4)
    for (const p of intervals(all.map((w) => vm.toS(w.t)))) expectRel(p, 0.5)
  })
})

describe('TP1 3.7 — pointeurs (bug de nommage du CR conservé)', () => {
  it('S1 relâché → décalage vers la GAUCHE (la fonction appelée est Decale_Droite), pas = 1,000 s ± 0,5 %', () => {
    expect(CR_FIXTURES['tp1/q3_7']).toMatch(/if \(BP_S1_GetValue\(\) == 1\)\s+Decale_Droite\(&Chenille\);/)
    const vm = boot(crProject('tp1/q3_7'))
    vm.runFor({ ms: 5500 })
    const words = ledWords(vm)
    const seq = [0b0001]
    while (seq.length < words.length) seq.push(rotl4(seq[seq.length - 1]))
    expect(words.map((w) => w.value)).toEqual(seq)
    expect(words.length).toBeGreaterThanOrEqual(5)
    for (const p of intervals(words.map((w) => vm.toS(w.t)))) expectRel(p, 1.0)
  })
})

describe('TP1 §4 — saisie du motif et tempo Tempo[3] = {2, 10, 20}', () => {
  const TEMPO_UNIT_S = 0.1 // __delay_ms(100) du CR
  const tap = (vm: Vm, name: string, holdMs: number, afterMs: number) => {
    vm.press(name)
    vm.runFor({ ms: holdMs })
    vm.release(name)
    vm.runFor({ ms: afterMs })
  }
  /** Saisie 0001 : S1 bascule D2, puis S2 tenu 50 ms valide chacun des 4 bits */
  function enterPattern() {
    const vm = boot(crProject('tp1/q4'))
    vm.runFor({ ms: 100 })
    tap(vm, 'S1', 50, 50)
    expect(vm.getPin('RA4')).toBe(1)
    for (let bit = 0; bit < 3; bit++) tap(vm, 'S2', 50, 600)
    // 4e bit : S2 encore appuyé quand la boucle principale démarre → indextempo passe à 1
    tap(vm, 'S2', 50, 0)
    return vm
  }
  /** Périodes stables (s) des changements de motif entre t0 et maintenant */
  const periodsSince = (vm: Vm, t0: number) =>
    intervals(
      ledWords(vm)
        .filter((w) => w.t >= t0)
        .map((w) => vm.toS(w.t)),
    )

  it('motif 0001, puis 1 s, 2 s et 0,200 s par pas (± 0,5 %)', () => {
    const vm = enterPattern()
    const t1 = vm.t
    vm.runFor({ ms: 5500 })
    expect(ledWords(vm).filter((w) => w.t >= t1)[0].value).toBe(0b0010)
    const p1 = periodsSince(vm, t1)
    expect(p1.length).toBeGreaterThanOrEqual(4)
    for (const p of p1) expectRel(p, 10 * TEMPO_UNIT_S)

    // Appui S2 maintenu assez longtemps pour être vu en début d'itération → Tempo[2] = 20
    tap(vm, 'S2', 1200, 0)
    vm.runFor({ ms: 2200 })
    const t2 = vm.t
    vm.runFor({ ms: 8500 })
    const p2 = periodsSince(vm, t2)
    expect(p2.length).toBeGreaterThanOrEqual(3)
    for (const p of p2) expectRel(p, 20 * TEMPO_UNIT_S)

    // indextempo = 3 → 0 → Tempo[0] = 2
    tap(vm, 'S2', 2200, 0)
    vm.runFor({ ms: 500 })
    const t3 = vm.t
    vm.runFor({ ms: 2100 })
    const p3 = periodsSince(vm, t3)
    expect(p3.length).toBeGreaterThanOrEqual(8)
    for (const p of p3) expectRel(p, 2 * TEMPO_UNIT_S)
  })

  it('temps d’exécution du code (période − Tempo × 100 ms) sous 0,25 % à 200 ms', () => {
    const vm = enterPattern()
    vm.runFor({ ms: 1500 })
    tap(vm, 'S2', 1200, 2200)
    tap(vm, 'S2', 2200, 0)
    vm.runFor({ ms: 500 })
    const t0 = vm.t
    vm.runFor({ ms: 2100 })
    const periods = periodsSince(vm, t0)
    expect(periods.length).toBeGreaterThanOrEqual(8)
    const target = 2 * TEMPO_UNIT_S
    for (const p of periods) {
      const overhead = p - target
      expect(overhead).toBeGreaterThan(0)
      // F14 (4 MHz, fichiers MCC réels) : sous 0,1 %
      expect(overhead / target).toBeLessThan(0.001)
    }
    console.info(`F14 : surcoût à 200 ms = ${((Math.max(...periods) - target) / target * 100).toFixed(4)} %`)
  })
})

describe('TP1 3.4 — RB4 laissée en analogique (ANSELB = 0xFF)', () => {
  const patched = () => {
    const mcc = { ...MCC_TP1 }
    const key = `${MCC_DIR}/pin_manager.c`
    expect(mcc[key]).toContain('ANSELB = 0xEF;')
    mcc[key] = mcc[key].replace('ANSELB = 0xEF;', 'ANSELB = 0xFF;')
    return crProject('tp1/q3_4', mcc)
  }

  it('configuration correcte : D2 suit S1 (contrôle)', () => {
    const vm = boot(crProject('tp1/q3_4'))
    vm.runFor({ ms: 10 })
    expect(vm.getPin('RA4')).toBe(0)
    vm.press('S1')
    vm.runFor({ ms: 5 })
    expect(vm.getPin('RA4')).toBe(1)
    vm.release('S1')
    vm.runFor({ ms: 5 })
    expect(vm.getPin('RA4')).toBe(0)
  })

  it('S1 lu à 0 sur 100 appuis sur 100 : D2 ne suit jamais S1 (reste allumée)', () => {
    const vm = boot(patched())
    vm.runFor({ ms: 10 })
    let followed = 0
    for (let k = 0; k < 100; k++) {
      vm.press('S1')
      vm.runFor({ ms: 5 })
      const pressedRead = vm.readSfr('PORTB') & (1 << parsePin(S1.pin).bit)
      const ledPressed = vm.getPin('RA4')
      vm.release('S1')
      vm.runFor({ ms: 5 })
      const releasedRead = vm.readSfr('PORTB') & (1 << parsePin(S1.pin).bit)
      const ledReleased = vm.getPin('RA4')
      expect(pressedRead).toBe(0)
      expect(releasedRead).toBe(0)
      // La broche, elle, change bien de niveau : seule la lecture numérique est bloquée
      expect(vm.getPin(S1.pin)).toBe(1)
      if (ledPressed !== ledReleased) followed++
      expect(ledReleased).toBe(1)
    }
    expect(followed).toBe(0)
  })
})

describe('pin_manager de mcc-tp1 (règle du cours p. 22)', () => {
  it('après SYSTEM_Initialize, TRISx/ANSELx valent les valeurs calculées depuis le brochage', () => {
    const vm = boot(project('#include "mcc_generated_files/mcc.h"\nvoid main(void) { SYSTEM_Initialize(); while (1) { } }\n'))
    vm.runFor({ ms: 5 })
    // Règle : bit TRIS = 0 pour une sortie (LED), bit ANSEL = 0 pour une broche numérique (LED, bouton)
    const outputs = INFO3.pins.leds.map((l) => l.pin)
    const digital = [...outputs, ...INFO3.pins.buttons.map((b) => b.pin)]
    const sfr = INFO3.sfr as Record<string, { reset: number }>
    const expected: Record<string, number> = {}
    for (const p of PORT_NAMES) {
      let tris = sfr[`TRIS${p}`].reset
      let ansel = sfr[`ANSEL${p}`].reset
      for (const pin of outputs) if (parsePin(pin).port === p) tris &= ~(1 << parsePin(pin).bit)
      for (const pin of digital) if (parsePin(pin).port === p) ansel &= ~(1 << parsePin(pin).bit)
      expected[`TRIS${p}`] = tris & implementedMask(`TRIS${p}`)
      expected[`ANSEL${p}`] = ansel & implementedMask(`ANSEL${p}`)
    }
    const actual = Object.fromEntries(Object.keys(expected).map((r) => [r, vm.readSfr(r)]))
    expect(actual).toEqual(expected)
    // Les valeurs de l'étape 1 (consigne) découlent bien de cette règle
    expect(expected).toEqual({ TRISA: 0x0f, ANSELA: 0x0f, TRISB: 0xff, ANSELB: 0xef, TRISC: 0xff, ANSELC: 0xdf, TRISD: 0xff, ANSELD: 0xff, TRISE: 0x07, ANSELE: 0x07 })
    for (const p of PORT_NAMES) {
      expect(vm.readSfr(`LAT${p}`)).toBe(0)
      expect(vm.readSfr(`WPU${p}`)).toBe(0)
      expect(vm.readSfr(`ODCON${p}`)).toBe(0)
    }
  })
})

describe('performance (Node)', () => {
  it('10 s simulées de q3_5 en moins de 300 ms', () => {
    const vm = boot(crProject('tp1/q3_5'))
    const t0 = performance.now()
    vm.runFor({ ms: 10_000 })
    const dt = performance.now() - t0
    console.info(`q3_5 : 10 s simulées en ${dt.toFixed(1)} ms`)
    expect(vm.timeS).toBeGreaterThanOrEqual(10)
    expect(dt).toBeLessThan(300)
  })
  it('1 s simulée de q3_4 (boucle sans délai) en moins de 250 ms', () => {
    const vm = boot(crProject('tp1/q3_4'))
    const t0 = performance.now()
    vm.runFor({ ms: 1000 })
    const dt = performance.now() - t0
    console.info(`q3_4 : 1 s simulée en ${dt.toFixed(1)} ms`)
    expect(dt).toBeLessThan(250)
  })
})
