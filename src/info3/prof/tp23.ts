/**
 * Professeur virtuel des TP2 et TP3 : défis rejoués dans la VM avec la configuration de l'étudiant
 * (fichiers générés de son projet) et la carte Rotary là où il l'a enfichée.
 * Attendus : INFO3.pins, INFO3.rotary, INFO3.tp3 ; messages « attendu / mesuré ».
 */
import { INFO3 } from '../../data/reference'
import { compile, formatDiagnostic } from '../compiler'
import type { Program } from '../compiler/bytecode'
import { intervals, pinEdges } from '../vm/trace'
import { Vm, type RotarySlot } from '../vm/vm'
import { fmtInt, type Verdict } from './tp1'

export type Tp23Challenge = 'tp2-1-1' | 'tp2-2-2' | 'tp2-2-3' | 'tp2-2-4' | 'tp3-1' | 'tp3-2'
export const TP23_CHALLENGES: readonly Tp23Challenge[] = ['tp2-1-1', 'tp2-2-2', 'tp2-2-3', 'tp2-2-4', 'tp3-1', 'tp3-2']

const MS = INFO3.units.msPerS
const NIBBLE = (1 << INFO3.tp1.patternBits) - 1
const SIG_DIGITS = 3
const [S1, S2] = INFO3.pins.buttons
const led = (name: string) => INFO3.pins.leds.find((l) => l.name === name)!.pin

/** Durée en ms, 3 chiffres significatifs, au format français : 63,5 ms ; 1 000 ms */
export function fmtMsFr(s: number): string {
  const v = Number((s * MS).toPrecision(SIG_DIGITS))
  const int = Math.trunc(v)
  const dec = Math.abs(v - int)
  const decStr = dec ? `,${dec.toFixed(SIG_DIGITS).replace(/^0\./, '').replace(/0+$/, '')}` : ''
  return `${fmtInt(int)}${decStr} ms`
}
const pct = (x: number) => `${String(x * 100).replace('.', ',')} %`
const fmtNibble = (v: number) => `0b${(v & NIBBLE).toString(2).padStart(INFO3.tp1.patternBits, '0')}`

function build(files: Record<string, string>): { program: Program } | { error: string } {
  const r = compile(files)
  if (!r.ok || !r.program) {
    const first = r.diagnostics.find((d) => d.severity === 'error')
    return { error: `Le programme ne compile pas${first ? ` : ${formatDiagnostic(first)}` : ''}` }
  }
  return { program: r.program }
}

function boot(p: Program, rotary: RotarySlot | null = null): Vm {
  const vm = new Vm()
  vm.setRotarySlot(rotary)
  vm.load(p)
  vm.runFor({ ms: 5 })
  return vm
}

/** Valeur des LED D5…D2 (D2 = bit 0) */
const ledNibble = (vm: Vm) => INFO3.pins.leds.reduce((v, l, i) => v | (vm.getPin(l.pin) << i), 0)

const tap = (vm: Vm, name: string, bounce = false, holdMs = 25, afterMs = 25) => {
  vm.press(name, bounce)
  vm.runFor({ ms: holdMs })
  vm.release(name, bounce)
  vm.runFor({ ms: afterMs })
}

/* ───────────── TP2 §1 ───────────── */

function q211(p: Program): Verdict {
  const vm = boot(p)
  const presses = 20
  for (let k = 1; k <= presses; k++) {
    tap(vm, S1.name)
    if (ledNibble(vm) !== (k & NIBBLE)) {
      const noIrq = !(vm.irqCalls.IOC ?? 0)
      return {
        ok: false,
        messages: [
          `Après ${k} appui${k > 1 ? 's' : ''} propre${k > 1 ? 's' : ''} sur S1 : D5…D2 = ${fmtNibble(k)} attendu, ${fmtNibble(ledNibble(vm))} observé`,
          ...(noIrq ? ['Aucune interruption n’a eu lieu : décommenter INTERRUPT_GlobalInterruptEnable() dans main.c'] : []),
        ],
      }
    }
  }
  const back = 3
  for (let k = 1; k <= back; k++) tap(vm, S2.name)
  if (ledNibble(vm) !== ((presses - back) & NIBBLE)) return { ok: false, messages: [`Après ${back} appuis sur S2 : D5…D2 = ${fmtNibble(presses - back)} attendu, ${fmtNibble(ledNibble(vm))} observé`] }
  // Constat du CR : avec rebonds, certains appuis comptent plusieurs fois
  const bouncy = boot(p)
  let jumps = 0
  for (let k = 0; k < 100; k++) {
    const before = ledNibble(bouncy)
    tap(bouncy, S1.name, true)
    if (((ledNibble(bouncy) - before) & NIBBLE) >= 2) jumps++
  }
  return { ok: true, messages: [`Compteur correct sur ${presses} appuis propres de S1 et ${back} de S2`, `Avec rebonds (H3) : ${jumps} appui${jumps > 1 ? 's' : ''} sur 100 compté${jumps > 1 ? 's' : ''} plusieurs fois — l’IOC voit chaque rebond`] }
}

/* ───────────── TP2 §2 : codeur ───────────── */

const STEP_MS = 20

function rotaryMissing(rotary: RotarySlot | null): Verdict | null {
  if (!rotary) return { ok: false, messages: ['Carte Rotary absente du banc : l’enficher sur le mikroBUS 2 (MODULE 2)'] }
  return null
}

function q222(p: Program, rotary: RotarySlot | null): Verdict {
  const miss = rotaryMissing(rotary)
  if (miss) return miss
  const vm = boot(p, rotary)
  const d2 = led('D2')
  const d3 = led('D3')
  for (let i = 1; i <= INFO3.rotary.detentsPerTurn; i++) {
    vm.turn(1)
    vm.runFor({ ms: STEP_MS })
    const expected = vm.encoder.a
    if (vm.getPin(d2) !== vm.getPin(d3) || vm.getPin(d3) !== expected)
      return { ok: false, messages: [`Cran ${i} : position stable ENCA = ENCB = ${expected} attendue sur D3 et D2, observé D3 = ${vm.getPin(d3)}, D2 = ${vm.getPin(d2)}`] }
  }
  const pulses = pinEdges(vm.gpio.trace, d3, 1).length
  return { ok: true, messages: [`Un tour (${INFO3.rotary.detentsPerTurn} crans) : D3 et D2 égales à chaque cran, ${pulses} impulsions sur ENCA`] }
}

function q223(p: Program, rotary: RotarySlot | null): Verdict {
  const miss = rotaryMissing(rotary)
  if (miss) return miss
  const vm = boot(p, rotary)
  const d3 = led('D3')
  const n = INFO3.rotary.detentsPerTurn
  let cw = 0
  let ccw = 0
  for (let i = 0; i < n; i++) {
    vm.turn(1)
    vm.runFor({ ms: STEP_MS })
    if (vm.getPin(d3) === 1) cw++
  }
  for (let i = 0; i < n; i++) {
    vm.turn(-1)
    vm.runFor({ ms: STEP_MS })
    if (vm.getPin(d3) === 0) ccw++
  }
  if (cw !== n || ccw !== n) {
    const msgs = [`Sens horaire : D3 = 1 attendu après chaque cran, ${cw}/${n} observés`, `Sens antihoraire : D3 = 0 attendu après chaque cran, ${ccw}/${n} observés`]
    if (!(vm.irqCalls.IOC ?? 0)) msgs.push(rotary === 'mikrobus1' ? 'Aucune interruption : sur le mikroBUS 1, ENCB arrive sur RA1 et non sur RA2 (carte à enficher sur le mikroBUS 2)' : 'Aucune interruption : IOC « any » sur ENCB (RA2) et INTERRUPT_GlobalInterruptEnable() attendus')
    return { ok: false, messages: msgs }
  }
  return { ok: true, messages: [`D3 indique le sens : ${n}/${n} crans horaires, ${n}/${n} antihoraires`] }
}

function q224(p: Program, rotary: RotarySlot | null): Verdict {
  const miss = rotaryMissing(rotary)
  if (miss) return miss
  const vm = boot(p, rotary)
  const n = INFO3.rotary.detentsPerTurn
  for (let i = 1; i <= n; i++) {
    vm.turn(1)
    vm.runFor({ ms: STEP_MS })
    if (ledNibble(vm) !== (i & NIBBLE)) return { ok: false, messages: [`Après ${i} cran${i > 1 ? 's' : ''} horaire${i > 1 ? 's' : ''} : D5…D2 = ${fmtNibble(i)} attendu, ${fmtNibble(ledNibble(vm))} observé`] }
  }
  for (let i = 1; i <= n; i++) {
    vm.turn(-1)
    vm.runFor({ ms: STEP_MS })
    if (ledNibble(vm) !== ((n - i) & NIBBLE)) return { ok: false, messages: [`Après ${i} cran${i > 1 ? 's' : ''} antihoraire${i > 1 ? 's' : ''} : D5…D2 = ${fmtNibble(n - i)} attendu, ${fmtNibble(ledNibble(vm))} observé`] }
  }
  return { ok: true, messages: [`Compteur : +${n} crans → ${fmtNibble(n)}, −${n} crans → ${fmtNibble(0)}`] }
}

/* ───────────── TP3 ───────────── */

function q31(p: Program): Verdict {
  const T = INFO3.tp3
  const vm = boot(p)
  const periods = 3
  vm.runFor({ ms: (periods + 1.5) * T.blinkPeriodS * MS })
  // Le premier front de D2 peut venir de l'initialisation de PORTA : les périodes se mesurent entre bascules du timer
  const edges = pinEdges(vm.gpio.trace, led('D2')).map((t) => vm.toS(t))
  const iv = intervals(edges.slice(1))
  const measured = iv.length ? iv[iv.length - 1] : null
  if (measured === null) return { ok: false, messages: [`D2 ne bascule pas (période de ${fmtMsFr(T.blinkPeriodS)} attendue)`] }
  if (Math.abs(measured - T.blinkPeriodS) / T.blinkPeriodS > T.blinkTolerance) return { ok: false, messages: [`Période : ${fmtMsFr(T.blinkPeriodS)} attendue, ${fmtMsFr(measured)} mesurée`] }
  return { ok: true, messages: [`Période : ${fmtMsFr(measured)} (cible ${fmtMsFr(T.blinkPeriodS)} ± ${pct(T.blinkTolerance)})`] }
}

function q32(p: Program): Verdict {
  const T = INFO3.tp3
  const vm = boot(p)
  const msgs: string[] = []
  // Délai entre le front descendant de S2 et TMR2IF
  const t0 = vm.t
  tap(vm, S2.name)
  const tm = vm.timers[INFO3.timers.ids[0]]
  if (tm.lastFlagT < t0) return { ok: false, messages: ['TMR2IF n’est pas levé après l’appui sur S2 : Timer2 en Monostable, démarrage sur front descendant de TMR2_ers, T2IN sur RC5'] }
  const delay = vm.toS(tm.lastFlagT - t0)
  if (Math.abs(delay - T.debounceS) / T.debounceS > T.debounceTolerance) msgs.push(`Délai entre le front descendant de S2 et TMR2IF : ${fmtMsFr(T.debounceS)} attendu, ${fmtMsFr(delay)} mesuré`)
  // 100 appuis avec rebonds : exactement −1 par appui
  const start = ledNibble(vm)
  const presses = 100
  let wrong = 0
  for (let k = 0; k < presses; k++) {
    const before = ledNibble(vm)
    tap(vm, S2.name, true)
    if (((before - ledNibble(vm)) & NIBBLE) !== 1) wrong++
  }
  if (wrong) msgs.push(`${presses} appuis sur S2 avec rebonds : ${wrong} n’ont pas décrémenté le compteur d’exactement 1 (D5…D2 ${fmtNibble(start)} → ${fmtNibble(ledNibble(vm))}, attendu ${fmtNibble(start - presses)})`)
  return msgs.length ? { ok: false, messages: msgs } : { ok: true, messages: [`S2 : ${presses} appuis avec rebonds → exactement −${presses} (anti-rebond de ${fmtMsFr(delay)})`] }
}

/** Note un défi du TP2 ou du TP3 (fichiers du projet, carte Rotary là où l'étudiant l'a enfichée) */
export function gradeTp23(id: Tp23Challenge, files: Record<string, string>, rotary: RotarySlot | null): Verdict {
  const b = build(files)
  if ('error' in b) return { ok: false, messages: [b.error] }
  try {
    switch (id) {
      case 'tp2-1-1':
        return q211(b.program)
      case 'tp2-2-2':
        return q222(b.program, rotary)
      case 'tp2-2-3':
        return q223(b.program, rotary)
      case 'tp2-2-4':
        return q224(b.program, rotary)
      case 'tp3-1':
        return q31(b.program)
      case 'tp3-2':
        return q32(b.program)
    }
  } catch (e) {
    return { ok: false, messages: [`Erreur du professeur virtuel : ${e instanceof Error ? e.message : String(e)}`] }
  }
}
