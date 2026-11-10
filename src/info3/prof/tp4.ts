/**
 * Professeur virtuel du TP4 (SPI et anneau de 16 LED). Défis rejoués dans la VM avec la configuration de
 * l'étudiant et la carte Rotary là où il l'a enfichée ; mesures sur le modèle mssp-spi (octets datés)
 * et sur l'anneau (sorties des 74HC595). Attendus : INFO3.tp4, INFO3.ring, INFO3.rotary.
 */
import { INFO3 } from '../../data/reference'
import { compile, formatDiagnostic } from '../compiler'
import type { Program } from '../compiler/bytecode'
import { Vm, type RotarySlot } from '../vm/vm'
import type { Verdict } from './tp1'
import { fmtMsFr } from './tp23'

export type Tp4Challenge = 'tp4-1' | 'tp4-2' | 'tp4-3' | 'tp4-4' | 'tp4-5' | 'tp4-6'
export const TP4_CHALLENGES: readonly Tp4Challenge[] = ['tp4-1', 'tp4-2', 'tp4-3', 'tp4-4', 'tp4-5', 'tp4-6']

const T = INFO3.tp4
const N = INFO3.ring.leds
const RING_MASK = (1 << N) - 1
const BYTE = (1 << INFO3.c.bitsPerByte) - 1
const MS = INFO3.units.msPerS
const NIBBLE = (1 << INFO3.tp1.patternBits) - 1
const pct = (x: number) => `${String(x * 100).replace('.', ',')} %`
const hex = (v: number, digits: number) => `0x${v.toString(16).toUpperCase().padStart(digits, '0')}`
const bin8 = (v: number) => v.toString(2).padStart(INFO3.c.bitsPerByte, '0')
/** LED allumées (1 à 16) */
const litList = (o: number) => Array.from({ length: N }, (_, k) => k + 1).filter((k) => (o >> (k - 1)) & 1)
const fmtLeds = (o: number) => (o ? `LED ${litList(o).join(', ')}` : 'aucune LED')
const rotl = (v: number, n = 1) => ((v << n) | (v >>> (N - n))) & RING_MASK
const rotr = (v: number) => rotl(v, N - 1)

function build(files: Record<string, string>): { program: Program } | { error: string } {
  const r = compile(files)
  if (!r.ok || !r.program) {
    const first = r.diagnostics.find((d) => d.severity === 'error')
    return { error: `Le programme ne compile pas${first ? ` : ${formatDiagnostic(first)}` : ''}` }
  }
  return { program: r.program }
}

function boot(p: Program, rotary: RotarySlot | null): Vm {
  const vm = new Vm()
  vm.setRotarySlot(rotary)
  vm.load(p)
  return vm
}

/** Sorties successives de l'anneau (instant en s, valeur) */
function ringLog(vm: Vm): { t: number; v: number }[] {
  const log: { t: number; v: number }[] = []
  vm.onRing((t, v) => log.push({ t: vm.toS(t), v }))
  return log
}

function needRotary(rotary: RotarySlot | null): Verdict | null {
  if (rotary === 'mikrobus2') return null
  return { ok: false, messages: [rotary ? 'Carte Rotary sur le mikroBUS 1 : RST et LATCH arrivent sur RD0 et RA3, l’anneau reste éteint ; l’enficher sur le mikroBUS 2' : 'Carte Rotary absente du banc : l’enficher sur le mikroBUS 2 (MODULE 2)'] }
}

/* ───────────── §1 : octet 0x31 toutes les 100 ms, mode 3 ───────────── */

function q1(p: Program, rotary: RotarySlot | null): Verdict {
  const vm = boot(p, rotary)
  const periods = 6
  vm.runFor({ ms: (periods + 1) * T.byteIntervalS * MS })
  const bytes = vm.mssp.bytes
  if (bytes.length < 2) return { ok: false, messages: [bytes.length ? 'Un seul octet envoyé : il doit être renvoyé toutes les 100 ms' : 'Aucun octet n’est sorti sur MOSI : SPI1_Open() puis SPI1_WriteByte() attendus'] }
  const msgs: string[] = []
  const wrong = bytes.find((b) => b.tx !== T.byte)
  if (wrong) msgs.push(`Octet envoyé : ${hex(T.byte, 2)} (0b${bin8(T.byte)}) attendu, ${hex(wrong.tx, 2)} observé`)
  if (bytes[0].mode !== T.q1Mode) msgs.push(`Mode SPI : ${T.q1Mode} attendu, ${bytes[0].mode} configuré`)
  for (let i = 1; i < bytes.length; i++) {
    const dt = vm.toS(bytes[i].t0 - bytes[i - 1].t0)
    if (Math.abs(dt - T.byteIntervalS) / T.byteIntervalS > T.byteTolerance) {
      msgs.push(`Intervalle entre deux octets : ${fmtMsFr(T.byteIntervalS)} attendu, ${fmtMsFr(dt)} mesuré`)
      break
    }
  }
  if (vm.readSfr('SSP1CON1') >> (INFO3.c.bitsPerByte - 1)) msgs.push('WCOL = 1 : un octet a été écrit dans SSP1BUF pendant un transfert')
  return msgs.length ? { ok: false, messages: msgs } : { ok: true, messages: [`${bytes.length} octets ${hex(T.byte, 2)} en mode ${T.q1Mode}, un toutes les ${fmtMsFr(T.byteIntervalS)} (± ${pct(T.byteTolerance)})`] }
}

/* ───────────── §2 : LED 1 à 8 = 00110001 ───────────── */

function q2(p: Program, rotary: RotarySlot | null): Verdict {
  const miss = needRotary(rotary)
  if (miss) return miss
  const vm = boot(p, rotary)
  vm.runFor({ ms: 3 * T.byteIntervalS * MS })
  const o = vm.ring.outputs
  const low = o & BYTE
  if (low !== T.byte) {
    const msgs = [`LED 1 à 8 : ${fmtLeds(T.byte)} attendues (0b${bin8(T.byte)}), ${fmtLeds(low)} observées`]
    // Décalé d'un rang : bits 7 à 1 envoyés sur LED 7 à 1, LED 8 = dernier bit de l'octet précédent
    if ((low & (BYTE >> 1)) === T.byte >> 1) msgs.push('Motif décalé d’un rang : en mode SPI 1 ou 2, MOSI change au front montant où le 74HC595 lit la donnée (H14). Utiliser le mode 0 ou 3')
    if (!o && !vm.mssp.bytes.length) msgs.push('Aucun octet envoyé sur le bus SPI')
    else if (!o) msgs.push('Anneau éteint : RST (RD2) doit être une sortie à 1 et LATCH (RD3) doit passer de 0 à 1 après l’envoi')
    return { ok: false, messages: msgs }
  }
  const msgs = [`LED 1 à 8 : ${fmtLeds(low)} (0b${bin8(low)})`]
  if (o >> INFO3.c.bitsPerByte) msgs.push(`Remarque : ${fmtLeds(o & ~BYTE)} aussi allumées — l’octet envoyé au tour précédent est passé de U2 dans U3 (comportement réel de la chaîne de 74HC595)`)
  return { ok: true, messages: msgs }
}

/* ───────────── §3 : led_ring_clear, led_ring_display16 ───────────── */

function q3(p: Program, rotary: RotarySlot | null): Verdict {
  const miss = needRotary(rotary)
  if (miss) return miss
  const msgs: string[] = []
  const fn = (name: string) => p.funcs.find((f) => f.name === name && f.entry >= 0 && f.file === 'main.c')
  const clear = fn('led_ring_clear')
  const disp = fn('led_ring_display16')
  if (!clear || clear.params.length !== 0) msgs.push('Fonction void led_ring_clear(void) introuvable dans main.c')
  if (!disp || disp.params.length !== 1) msgs.push('Fonction void led_ring_display16(uint16_t led_state) introuvable dans main.c')
  else {
    const t = disp.locals[0]?.type
    if (!t || t.k !== 'int' || t.size !== INFO3.c.sizes.int || t.signed) msgs.push('Le paramètre de led_ring_display16 doit être de type uint16_t')
  }
  if (msgs.length) return { ok: false, messages: msgs }
  const vm = boot(p, rotary)
  // main exécute SYSTEM_Initialize, RST à 1 et SPI1_Open avant les appels unitaires
  vm.runFor({ ms: 20 })
  for (const v of T.displayCases) {
    const r = vm.invoke('led_ring_display16', [v])
    if (!r.ok) return { ok: false, messages: [`led_ring_display16(${hex(v, 4)}) : ${r.error}`] }
    vm.runFor({ ms: 1 })
    if (vm.ring.outputs !== v) {
      const m = [`led_ring_display16(${hex(v, 4)}) : ${fmtLeds(v)} attendues, ${fmtLeds(vm.ring.outputs)} observées`]
      if (vm.ring.outputs === (((v & BYTE) << INFO3.c.bitsPerByte) | (v >> INFO3.c.bitsPerByte))) m.push('Les deux octets sont inversés : envoyer d’abord l’octet de poids fort (il finit dans U3, LED 9 à 16)')
      return { ok: false, messages: m }
    }
  }
  const r = vm.invoke('led_ring_clear')
  if (!r.ok) return { ok: false, messages: [`led_ring_clear() : ${r.error}`] }
  vm.runFor({ ms: 1 })
  if (vm.ring.outputs) return { ok: false, messages: [`led_ring_clear() : aucune LED attendue, ${fmtLeds(vm.ring.outputs)} observées`] }
  return { ok: true, messages: [`led_ring_display16 : ${T.displayCases.map((v) => hex(v, 4)).join(', ')} conformes ; led_ring_clear éteint l’anneau`] }
}

/* ───────────── §4 : chenillard LED 1 → 16, 1 s par pas ───────────── */

function q4(p: Program, rotary: RotarySlot | null): Verdict {
  const miss = needRotary(rotary)
  if (miss) return miss
  const vm = boot(p, rotary)
  const log = ringLog(vm)
  vm.runFor({ ms: (N + 2.5) * T.chaseStepS * MS })
  const steps = log.filter((x, i) => i === 0 || x.v !== log[i - 1].v)
  if (steps.length < N + 1) return { ok: false, messages: [`${N + 1} pas attendus en ${N + 2} s (LED 1 à 16 puis retour à la LED 1), ${steps.length} observés`] }
  for (let i = 0; i < steps.length; i++) {
    const v = steps[i].v
    if (litList(v).length !== 1) return { ok: false, messages: [`Pas ${i + 1} : une seule LED allumée attendue, ${fmtLeds(v)} observées`] }
    const expected = i === 0 ? 1 : rotl(steps[i - 1].v)
    if (v !== expected) return { ok: false, messages: [`Pas ${i + 1} : ${fmtLeds(expected)} attendue, ${fmtLeds(v)} observée`] }
  }
  for (let i = 1; i < steps.length; i++) {
    const dt = steps[i].t - steps[i - 1].t
    if (Math.abs(dt - T.chaseStepS) / T.chaseStepS > T.chaseTolerance) return { ok: false, messages: [`Durée d’un pas : ${fmtMsFr(T.chaseStepS)} attendue, ${fmtMsFr(dt)} mesurée`] }
  }
  return { ok: true, messages: [`Chenillard LED 1 → LED 16 → LED 1, ${fmtMsFr(T.chaseStepS)} par pas (± ${pct(T.chaseTolerance)})`] }
}

/* ───────────── §5 : l'anneau suit le codeur, compteur sur D5 à D2 ───────────── */

function q5(p: Program, rotary: RotarySlot | null): Verdict {
  const miss = needRotary(rotary)
  if (miss) return miss
  const vm = boot(p, rotary)
  vm.runFor({ ms: 50 })
  const ledIndex = () => {
    const l = litList(vm.ring.outputs)
    return l.length === 1 ? l[0] - 1 : -1
  }
  const nibble = () => INFO3.pins.leds.reduce((v, l, i) => v | (vm.getPin(l.pin) << i), 0)
  let ring = ledIndex()
  let cpt = nibble()
  if (ring < 0) return { ok: false, messages: [`Au repos : une seule LED de l’anneau attendue, ${fmtLeds(vm.ring.outputs)} observées`] }
  const plan = [...Array(T.encoderDetents - T.encoderBack).fill(1), ...Array(T.encoderBack).fill(-1)] as (1 | -1)[]
  for (let i = 0; i < plan.length; i++) {
    const d = plan[i]
    vm.turn(d)
    vm.runFor({ ms: 30 })
    const r = ledIndex()
    const n = nibble()
    const expR = (ring + d + N) % N
    const expN = (cpt + d) & NIBBLE
    const sens = d > 0 ? 'horaire' : 'antihoraire'
    if (r !== expR) return { ok: false, messages: [`Cran ${i + 1} (${sens}) : LED ${expR + 1} de l’anneau attendue, ${fmtLeds(vm.ring.outputs)} observée(s)`] }
    if (n !== expN) return { ok: false, messages: [`Cran ${i + 1} (${sens}) : compteur D5…D2 = ${expN} attendu, ${n} observé`] }
    ring = r
    cpt = n
  }
  return { ok: true, messages: [`${T.encoderDetents} crans (${T.encoderDetents - T.encoderBack} horaires, ${T.encoderBack} antihoraires) : l’anneau et le compteur D5…D2 suivent le codeur`] }
}

/* ───────────── §6 : 0xF0F0 qui tourne, puis une autre animation (déclenchement libre) ───────────── */

/** Plus petite période p (≥ 1) telle que la séquence se répète au moins deux fois, sinon null */
function periodOf(seq: number[]): number | null {
  for (let per = 1; 2 * per <= seq.length; per++) if (seq.slice(per).every((v, i) => v === seq[i])) return per
  return null
}

function q6(p: Program, rotary: RotarySlot | null): Verdict {
  const miss = needRotary(rotary)
  if (miss) return miss
  const vm = boot(p, rotary)
  const log = ringLog(vm)
  const states = () => log.filter((x, i) => i === 0 || x.v !== log[i - 1].v).map((x) => x.v)
  const total = T.animationWindowS * MS
  const slice = total / (T.animationStimuli.length + 1)
  const isRotation = (a: number, b: number) => b === rotl(a) || b === rotr(a)
  /** Début de la seconde animation : premier changement d'état qui n'est plus une rotation d'une LED */
  const breakAt = (seq: number[], from: number) => {
    for (let i = from + 1; i < seq.length; i++) if (!isRotation(seq[i - 1], seq[i])) return i
    return -1
  }

  // Fenêtre de 60 s simulées ; si la seconde animation n'a pas démarré seule, un appui sur S1, puis sur S2
  vm.runFor({ ms: slice })
  const used: string[] = []
  for (const name of T.animationStimuli) {
    const seq = states()
    const start = seq.indexOf(T.animation)
    if (start >= 0 && breakAt(seq, start) >= 0) break
    vm.press(name)
    vm.runFor({ ms: T.pressMs })
    vm.release(name)
    used.push(name)
    vm.runFor({ ms: slice - T.pressMs })
  }
  vm.runFor({ ms: Math.max(0, total - vm.timeS * MS) })

  const seq = states()
  const start = seq.indexOf(T.animation)
  if (start < 0) return { ok: false, messages: [`Animation 1 : le motif ${hex(T.animation, 4)} n’apparaît pas sur l’anneau`] }
  const end = breakAt(seq, start)
  const run = (end < 0 ? seq.length : end) - start - 1
  if (run < N) {
    if (end < 0) return { ok: false, messages: [`Animation 1 : au moins ${N} pas attendus, ${run} observés en ${T.animationWindowS} s`] }
    return { ok: false, messages: [`Animation 1 : chaque pas doit tourner le motif d’une LED (${hex(seq[start + run], 4)} → ${hex(rotl(seq[start + run]), 4)} ou ${hex(rotr(seq[start + run]), 4)}), ${hex(seq[end], 4)} observé`] }
  }
  const how = used.length ? `après un appui sur ${used.join(' puis ')}` : 'sans action (enchaînement)'
  if (end < 0) return { ok: false, messages: [`Animation 2 : aucune autre animation en ${T.animationWindowS} s (ni seule, ni après un appui sur ${T.animationStimuli.join(' ou ')})`] }
  // Seconde animation : la suite des états à partir de la rupture se répète (les deux animations peuvent alterner)
  const tail = seq.slice(end)
  const period = periodOf(tail)
  const rotations = new Set(Array.from({ length: N }, (_, k) => rotl(T.animation, k)))
  if (tail.every((v) => rotations.has(v))) return { ok: false, messages: [`Animation 2 (${how}) : elle n’affiche que des rotations de ${hex(T.animation, 4)} ; une animation différente est attendue`] }
  if (!period || new Set(tail).size < 2) return { ok: false, messages: [`Animation 2 (${how}) : un motif qui se répète est attendu sur l’anneau, la séquence observée ne l’est pas`] }
  return { ok: true, messages: [`Animation 1 : ${hex(T.animation, 4)} tourne d’une LED par pas (${run} pas observés)`, `Animation 2 : démarrée ${how}, périodique (${period} états par cycle)`] }
}

const GRADERS: Record<Tp4Challenge, (p: Program, r: RotarySlot | null) => Verdict> = { 'tp4-1': q1, 'tp4-2': q2, 'tp4-3': q3, 'tp4-4': q4, 'tp4-5': q5, 'tp4-6': q6 }

export function gradeTp4(id: Tp4Challenge, files: Record<string, string>, rotary: RotarySlot | null): Verdict {
  const b = build(files)
  if ('error' in b) return { ok: false, messages: [b.error] }
  try {
    return GRADERS[id](b.program, rotary)
  } catch (e) {
    return { ok: false, messages: [`Erreur du professeur virtuel : ${e instanceof Error ? e.message : String(e)}`] }
  }
}
