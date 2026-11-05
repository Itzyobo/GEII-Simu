/**
 * Professeur virtuel du TP1 : défis de code (scénarios rejoués dans la VM) et contrôles statiques
 * (fonctions, variables) avec appels unitaires. Les attendus viennent de INFO3.tp1 et INFO3.pins
 * et du modèle de référence de rotation ci-dessous ; les messages citent la mesure face à la cible.
 */
import { INFO3 } from '../../data/reference'
import { compile, formatDiagnostic } from '../compiler'
import type { Program } from '../compiler/bytecode'
import { busValues, intervals, pinEdges } from '../vm/trace'
import { Vm } from '../vm/vm'

export interface Verdict {
  ok: boolean
  messages: string[]
}

export type Tp1Challenge = 'tp1-3-3' | 'tp1-3-4' | 'tp1-3-5' | 'tp1-3-6' | 'tp1-3-7' | 'tp1-4-2' | 'tp1-4-3'
export const TP1_CHALLENGES: readonly Tp1Challenge[] = ['tp1-3-3', 'tp1-3-4', 'tp1-3-5', 'tp1-3-6', 'tp1-3-7', 'tp1-4-2', 'tp1-4-3']

const T = INFO3.tp1
const MS = INFO3.units.msPerS
const BITS = T.patternBits
const MASK = (1 << BITS) - 1
const ledPins = () => INFO3.pins.leds.map((l) => l.pin)
const ledPin = (name: string) => INFO3.pins.leds.find((l) => l.name === name)!.pin
const S1 = () => INFO3.pins.buttons[0].name
const S2 = () => INFO3.pins.buttons[1].name

/* ───────────── Modèle de référence ───────────── */

/** Rotation de `BITS` bits vers la gauche (vers D5) et vers la droite (vers D2) */
export const rotl = (m: number) => ((m << 1) | (m >> (BITS - 1))) & MASK
export const rotr = (m: number) => ((m >> 1) | (m << (BITS - 1))) & MASK

/* ───────────── Mise en forme ───────────── */

const THOUSANDS = 3
/** 1000 → « 1 000 » (séparateur de milliers français, espace simple) */
export function fmtInt(n: number): string {
  const s = String(Math.abs(Math.round(n)))
  const groups: string[] = []
  for (let i = s.length; i > 0; i -= THOUSANDS) groups.unshift(s.slice(Math.max(0, i - THOUSANDS), i))
  return (n < 0 ? '-' : '') + groups.join(' ')
}
/** Chiffres significatifs affichés pour une durée (résolution d'un oscilloscope) */
const SIG_DIGITS = 3
export const fmtMs = (s: number) => `${fmtInt(Number((s * MS).toPrecision(SIG_DIGITS)))} ms`
const fmtBin = (v: number) => `0b${v.toString(2).padStart(BITS, '0')}`
const within = (measured: number, target: number) => Math.abs(measured - target) / target <= T.tolerance
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/* ───────────── Exécution ───────────── */

function build(files: Record<string, string>): { program: Program } | { error: string } {
  const r = compile(files)
  if (!r.ok || !r.program) {
    const first = r.diagnostics.find((d) => d.severity === 'error')
    return { error: `Le programme ne compile pas${first ? ` : ${formatDiagnostic(first)}` : ''}` }
  }
  return { program: r.program }
}

function boot(program: Program): Vm {
  const vm = new Vm()
  vm.load(program)
  return vm
}

/** Motifs successifs affichés sur D2…D5 (bit 0 = D2) après l'instant t0 */
const words = (vm: Vm, t0 = 0) => busValues(vm.gpio.trace, ledPins()).filter((w) => w.t >= t0)

/** Durée d'un pas (médiane des écarts entre changements de motif après t0, premier écart ignoré) */
function stepAfter(vm: Vm, t0: number): number | null {
  const iv = intervals(words(vm, t0).map((w) => vm.toS(w.t))).slice(1)
  return iv.length ? median(iv) : null
}

const tap = (vm: Vm, name: string, holdMs: number, afterMs: number) => {
  vm.press(name)
  vm.runFor({ ms: holdMs })
  vm.release(name)
  vm.runFor({ ms: afterMs })
}

/* ───────────── Défis ───────────── */

function q33(p: Program): Verdict {
  const vm = boot(p)
  const target = 2 * T.blinkHalfPeriodS
  const periods = 5
  vm.runFor({ ms: (periods + 1) * target * MS + T.blinkHalfPeriodS * MS })
  const rises = pinEdges(vm.gpio.trace, ledPin('D2'), 1).map((t) => vm.toS(t))
  if (rises.length < 2) return { ok: false, messages: ['D2 ne clignote pas'] }
  const iv = intervals(rises).slice(0, periods)
  const bad = iv.find((x) => !within(x, target))
  if (bad !== undefined || iv.length < periods) return { ok: false, messages: [`Période de D2 : ${fmtMs(target)} attendu, ${fmtMs(bad ?? median(iv))} mesuré`] }
  return { ok: true, messages: [`Période de D2 : ${fmtMs(median(iv))} (cible ${fmtMs(target)} ± ${String(T.tolerance * 100).replace('.', ',')} %)`] }
}

function q34(p: Program): Verdict {
  const vm = boot(p)
  const d2 = ledPin('D2')
  const followMs = T.followMaxS * MS
  vm.runFor({ ms: followMs * 10 })
  for (let k = 1; k <= 5; k++) {
    vm.press(S1())
    vm.runFor({ ms: followMs })
    if (vm.getPin(d2) !== 1) return { ok: false, messages: [`Appui ${k} sur S1 : D2 doit s’allumer en moins de ${fmtMs(T.followMaxS)}, elle est restée éteinte`] }
    vm.runFor({ ms: followMs * 20 })
    vm.release(S1())
    vm.runFor({ ms: followMs })
    if (vm.getPin(d2) !== 0) return { ok: false, messages: [`Relâchement ${k} de S1 : D2 doit s’éteindre en moins de ${fmtMs(T.followMaxS)}, elle est restée allumée`] }
    vm.runFor({ ms: followMs * 20 })
  }
  return { ok: true, messages: ['D2 suit S1 (5 appuis, délai inférieur à 1 ms)'] }
}

function q35(p: Program): Verdict {
  const vm = boot(p)
  const step = T.chaserStepS
  vm.runFor({ ms: 9 * step * MS })
  const w = words(vm)
  const msgs: string[] = []
  if (w.length < 5) return { ok: false, messages: [`Chenillard : au moins 5 pas attendus en ${fmtMs(9 * step)}, ${w.length} observés`] }
  if (w[0].value !== 1) msgs.push(`Premier motif : D2 seule allumée attendue (${fmtBin(1)}), observé ${fmtBin(w[0].value)}`)
  for (let i = 1; i < w.length; i++) {
    const exp = w[i - 1].value === 1 << (BITS - 1) ? 1 : w[i - 1].value << 1
    if (w[i].value !== exp) {
      msgs.push(`Séquence D2 → D3 → D4 → D5 → D2 : après ${fmtBin(w[i - 1].value)}, ${fmtBin(exp)} attendu, ${fmtBin(w[i].value)} observé`)
      break
    }
  }
  const iv = intervals(w.map((x) => vm.toS(x.t)))
  const bad = iv.find((x) => !within(x, step))
  if (bad !== undefined) msgs.push(`Durée d’un pas : ${fmtMs(step)} attendu, ${fmtMs(bad)} mesuré`)
  const lowTris = vm.readSfr('TRISA') & MASK
  if (lowTris !== MASK) msgs.push(`TRISA<3:0> = ${fmtBin(lowTris)} : RA0 à RA3 doivent rester en entrée (1111)`)
  return msgs.length ? { ok: false, messages: msgs } : { ok: true, messages: [`Séquence correcte, pas de ${fmtMs(median(iv))}`] }
}

/** Le motif tourne à gauche (S1 relâché) puis à droite (S1 maintenu), un pas toutes les `step` s */
function directionCheck(vm: Vm, step: number, label: string): string[] {
  const msgs: string[] = []
  const t0 = vm.t
  vm.runFor({ ms: 5 * step * MS })
  const wl = words(vm, t0)
  for (let i = 1; i < wl.length; i++) {
    if (wl[i].value !== rotl(wl[i - 1].value)) {
      msgs.push(`${label} S1 relâché : décalage vers la gauche attendu (${fmtBin(wl[i - 1].value)} → ${fmtBin(rotl(wl[i - 1].value))}), observé ${fmtBin(wl[i - 1].value)} → ${fmtBin(wl[i].value)}`)
      break
    }
  }
  vm.press(S1())
  const t1 = vm.t
  vm.runFor({ ms: 5 * step * MS })
  const wr = words(vm, t1)
  for (let i = 1; i < wr.length; i++) {
    if (wr[i].value !== rotr(wr[i - 1].value)) {
      msgs.push(`${label} S1 maintenu : décalage vers la droite attendu (${fmtBin(wr[i - 1].value)} → ${fmtBin(rotr(wr[i - 1].value))}), observé ${fmtBin(wr[i - 1].value)} → ${fmtBin(wr[i].value)}`)
      break
    }
  }
  vm.release(S1())
  if (wl.length < 3 || wr.length < 3) msgs.push(`${label} le motif doit se décaler toutes les ${fmtMs(step)}`)
  const iv = [...intervals(wl.map((x) => vm.toS(x.t))), ...intervals(wr.map((x) => vm.toS(x.t))).slice(1)]
  const bad = iv.find((x) => !within(x, step))
  if (bad !== undefined) msgs.push(`${label} durée d’un pas : ${fmtMs(step)} attendu, ${fmtMs(bad)} mesuré`)
  return msgs
}

function hasFunction(p: Program, name: string, params: number) {
  return p.funcs.some((f) => f.name === name && f.entry >= 0 && f.params.length === params && f.file === 'main.c')
}

function q36(p: Program): Verdict {
  const msgs: string[] = []
  if (!p.globals.some((g) => g.name === 'Chenille' && g.file === 'main.c')) msgs.push('Variable globale Chenille introuvable dans main.c')
  for (const f of ['Decale_Droite', 'Decale_Gauche']) if (!hasFunction(p, f, 0)) msgs.push(`Fonction void ${f}(void) introuvable`)
  if (msgs.length) return { ok: false, messages: msgs }
  for (const [f, model] of [['Decale_Droite', rotr], ['Decale_Gauche', rotl]] as const) {
    const vm = boot(p)
    vm.pokeVar('Chenille', T.pattern)
    const r = vm.invoke(f)
    if (!r.ok) return { ok: false, messages: [`${f}() : ${r.error}`] }
    const got = vm.peekVar('Chenille') as number
    if (got !== model(T.pattern)) msgs.push(`${f}() avec Chenille = ${fmtBin(T.pattern)} donne ${fmtBin(got)}, attendu ${fmtBin(model(T.pattern))}`)
  }
  if (msgs.length) return { ok: false, messages: msgs }
  const vm = boot(p)
  msgs.push(...directionCheck(vm, T.bidirStepS, 'Comportement :'))
  return msgs.length ? { ok: false, messages: msgs } : { ok: true, messages: ['Fonctions et comportement conformes'] }
}

/** Appel unitaire Rotate_xxx(&motif) : motif placé en fin d'espace de données */
function rotateCall(p: Program, f: string, motif: number): { ok: true; value: number } | { ok: false; error: string } {
  const vm = boot(p)
  const addr = INFO3.vm.memory.size - 1
  vm.pokeByte(addr, motif)
  const r = vm.invoke(f, [addr])
  return r.ok ? { ok: true, value: vm.peekByte(addr) } : r
}

function q37(p: Program): Verdict {
  const msgs: string[] = []
  for (const f of ['Rotate_Right_4Bits', 'Rotate_Left_4Bits']) {
    const meta = p.funcs.find((x) => x.name === f && x.entry >= 0 && x.file === 'main.c')
    if (!meta) msgs.push(`Fonction ${f} introuvable`)
    else {
      const prm = meta.locals[0]
      const t = prm?.type
      if (meta.params.length !== 1 || !t || t.k !== 'ptr' || t.to.k !== 'int' || t.to.size !== INFO3.c.sizes.char || t.to.signed) msgs.push(`${f} doit recevoir un seul paramètre de type uint8_t *`)
    }
  }
  if (msgs.length) return { ok: false, messages: msgs }
  const cases: [string, (m: number) => number, number][] = [
    ['Rotate_Right_4Bits', rotr, T.pattern],
    ['Rotate_Left_4Bits', rotl, T.pattern],
    ['Rotate_Right_4Bits', rotr, 1],
  ]
  for (const [f, model, input] of cases) {
    const r = rotateCall(p, f, input)
    if (!r.ok) return { ok: false, messages: [`${f}(${fmtBin(input)}) : ${r.error}`] }
    if (r.value !== model(input)) msgs.push(`${f}(${fmtBin(input)}) = ${fmtBin(r.value)}, attendu ${fmtBin(model(input))}`)
  }
  if (msgs.length) return { ok: false, messages: msgs }
  const main = p.funcs[p.mainIndex]
  if (!main.locals.some((l) => l.name === 'Motif')) msgs.push('Variable locale Motif introuvable dans main')
  const globals = p.globals.filter((g) => g.file === 'main.c')
  if (globals.length) msgs.push(`Aucune variable globale attendue dans main.c, trouvé : ${globals.map((g) => g.name).join(', ')}`)
  return msgs.length ? { ok: false, messages: msgs } : { ok: true, messages: ['Fonctions à pointeur conformes, Motif local à main'] }
}

/* ───────────── §4 : cahier des charges ───────────── */

interface Scenario {
  vm: Vm
  /** Instants (ticks) des validations par S2 pendant la saisie */
  validations: number[]
  /** Instants (ticks) des appuis S2 de changement de tempo */
  tempoTaps: number[]
  msgs: string[]
}

/** Saisie du motif 0001 (S1 bascule D2, S2 valide chaque bit), puis tempo et changements de tempo */
function scenario4(p: Program, stopAtFirstError: boolean): Scenario {
  const vm = boot(p)
  const msgs: string[] = []
  const validations: number[] = []
  const tempoTaps: number[] = []
  const tapMs = 100
  vm.runFor({ ms: tapMs })
  tap(vm, S1(), tapMs, tapMs)
  for (let bit = 0; bit < BITS; bit++) {
    validations.push(vm.t)
    tap(vm, S2(), tapMs, bit < BITS - 1 ? 8 * tapMs : 0)
  }
  vm.runFor({ ms: 8 * tapMs })
  const cycle = T.tempoCycleS
  // Tempo initiale, S1 relâché : décalage vers la gauche
  const t0 = vm.t
  vm.runFor({ ms: 6 * cycle[0] * MS })
  const initial = stepAfter(vm, t0)
  if (initial === null || !within(initial, cycle[0])) {
    msgs.push(`Tempo initiale : ${fmtMs(cycle[0])} attendu, ${initial === null ? 'aucun décalage' : fmtMs(initial)} mesuré`)
    if (stopAtFirstError) return { vm, validations, tempoTaps, msgs }
  }
  msgs.push(...directionCheck(vm, cycle[0], 'Tempo initiale,'))
  if (msgs.length && stopAtFirstError) return { vm, validations, tempoTaps, msgs }
  // Cycle S2 : chaque appui fait passer à la tempo suivante
  for (let k = 1; k < cycle.length; k++) {
    tempoTaps.push(vm.t)
    tap(vm, S2(), tapMs + tapMs / 2, 0)
    const t1 = vm.t
    vm.runFor({ ms: Math.max(2, 5 * cycle[k]) * MS })
    const m = stepAfter(vm, t1)
    if (m === null || !within(m, cycle[k])) {
      msgs.push(`Après ${k} appui${k > 1 ? 's' : ''} sur S2 : ${fmtMs(cycle[k])} attendu, ${m === null ? 'aucun décalage' : fmtMs(m)} mesuré`)
      if (stopAtFirstError) break
    }
  }
  return { vm, validations, tempoTaps, msgs }
}

function q42(p: Program): Verdict {
  const s = scenario4(p, true)
  return s.msgs.length ? { ok: false, messages: s.msgs } : { ok: true, messages: ['Cahier des charges respecté : saisie, sens, cycle de tempo 500 ms → 1 s → 2 s → 500 ms'] }
}

/** Bonus : clignotement d'acquittement après chaque validation et des 4 LED à chaque changement de tempo */
function q43(p: Program): Verdict {
  const s = scenario4(p, false)
  const vm = s.vm
  const win = vm.msToTicks(T.ackWithinS * MS)
  const transitions = (pin: string, t: number) => vm.gpio.trace.filter((c) => c.pin === pin && c.t > t && c.t <= t + win).length
  const msgs: string[] = []
  s.validations.forEach((t, i) => {
    const pin = INFO3.pins.leds[i].pin
    if (transitions(pin, t) < 2) msgs.push(`Validation du bit ${INFO3.pins.leds[i].name} : aucun clignotement de la LED dans la seconde qui suit`)
  })
  s.tempoTaps.forEach((t, i) => {
    if (ledPins().some((pin) => transitions(pin, t) < 2)) msgs.push(`Changement de tempo ${i + 1} : les 4 LED doivent clignoter dans la seconde qui suit`)
  })
  return msgs.length ? { ok: false, messages: msgs } : { ok: true, messages: ['Clignotements d’acquittement présents'] }
}

const GRADERS: Record<Tp1Challenge, (p: Program) => Verdict> = {
  'tp1-3-3': q33,
  'tp1-3-4': q34,
  'tp1-3-5': q35,
  'tp1-3-6': q36,
  'tp1-3-7': q37,
  'tp1-4-2': q42,
  'tp1-4-3': q43,
}

/** Note un défi du TP1 à partir des fichiers du projet (main.c + mcc_generated_files) */
export function gradeTp1(id: Tp1Challenge, files: Record<string, string>): Verdict {
  const b = build(files)
  if ('error' in b) return { ok: false, messages: [b.error] }
  try {
    return GRADERS[id](b.program)
  } catch (e) {
    return { ok: false, messages: [`Erreur du professeur virtuel : ${e instanceof Error ? e.message : String(e)}`] }
  }
}
