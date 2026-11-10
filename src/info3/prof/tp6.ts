/**
 * Professeur virtuel du TP6 (CAN, joystick, matrice 8x8 / MAX7219). Défis rejoués dans la VM : entrées
 * analogiques pilotées (potentiomètre, joystick), texte lu sur TX, conversions lues dans le journal de l'ADCC,
 * matrice lue dans le modèle MAX7219, accès concurrents relevés par la VM. Attendus : INFO3.tp6, INFO3.adcc.
 */
import { INFO3 } from '../../data/reference'
import { compile, formatDiagnostic } from '../compiler'
import type { Program } from '../compiler/bytecode'
import { channelOf, codeOf } from '../models/adcc'
import { Vm, type RotarySlot } from '../vm/vm'
import type { Verdict } from './tp1'

export type Tp6Challenge = 'tp6-1-1' | 'tp6-1-3' | 'tp6-2' | 'tp6-3' | 'tp6-4'
export const TP6_CHALLENGES: readonly Tp6Challenge[] = ['tp6-1-1', 'tp6-1-3', 'tp6-2', 'tp6-3', 'tp6-4']

const T = INFO3.tp6
const A = INFO3.adcc
const MAX = 2 ** A.bits - 1
const PCT = 100
const MS = INFO3.units.msPerS
const LF = 0x0a
const N = INFO3.max7219.digits
const BYTE = (1 << INFO3.c.bitsPerByte) - 1
const J = INFO3.pins.joystick
const POT = INFO3.pins.pot.pin
const pctOf = (raw: number) => Math.floor((raw * PCT) / MAX)
/** Pourcentage calculé en entiers 16 bits (raw*100 tronqué à 16 bits), l'erreur typique */
const pct16 = (raw: number) => Math.floor(((raw * PCT) & 0xffff) / MAX)
const fmtS = (s: number) => `${(s * MS).toFixed(1).replace('.', ',')} ms`
const rel = (a: number, b: number) => Math.abs(a - b) / b

function build(files: Record<string, string>): { program: Program } | { error: string } {
  const r = compile(files)
  if (!r.ok || !r.program) {
    const first = r.diagnostics.find((d) => d.severity === 'error')
    return { error: `Le programme ne compile pas${first ? ` : ${formatDiagnostic(first)}` : ''}` }
  }
  return { program: r.program }
}

function boot(p: Program, matrix: RotarySlot | null): Vm {
  const vm = new Vm()
  vm.setMatrixSlot(matrix)
  vm.load(p)
  return vm
}

/** Source de l'étudiant (hors MCC), commentaires retirés */
const studentSource = (files: Record<string, string>) =>
  Object.entries(files)
    .filter(([f]) => !f.startsWith(INFO3.mcc.dir) && /\.(c|h)$/.test(f))
    .map(([, s]) => s.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' '))
    .join('\n')
const squash = (s: string) => s.replace(/\s+/g, '')

/** Lignes émises sur TX (texte, instant du premier octet en s) */
function linesOf(vm: Vm): { text: string; t: number }[] {
  const out: { text: string; t: number }[] = []
  let cur: number[] = []
  let t0 = 0
  for (const s of vm.eusart.sent) {
    if (!cur.length) t0 = vm.toS(s.t)
    cur.push(s.byte)
    if (s.byte === LF) {
      out.push({ text: String.fromCharCode(...cur).replace(/\r?\n$/, ''), t: t0 })
      cur = []
    }
  }
  return out
}
const ints = (s: string) => (s.match(/-?\d+/g) ?? []).map(Number)

/** Chaque valeur attendue (avec sa tolérance) trouve un nombre distinct dans `nums` */
function matchAll(nums: number[], want: { v: number; tol: number }[]): boolean {
  const used = new Set<number>()
  return want.every((w) => {
    const i = nums.findIndex((n, k) => !used.has(k) && Math.abs(n - w.v) <= w.tol)
    if (i < 0) return false
    used.add(i)
    return true
  })
}

/* ───────────── §1.1 : valeurs brutes et % des 3 entrées ───────────── */

const SCENARIOS: { label: string; pot: number; joy: [number, number] }[] = [
  { label: 'POT à 0 %, joystick au repos', pot: 0, joy: [0, 0] },
  { label: 'POT à 50 %, joystick en butée droite', pot: 0.5, joy: [1, 0] },
  { label: 'POT à 100 %, joystick en butée haute', pot: 1, joy: [0, 1] },
]

function q11(p: Program): Verdict {
  const vm = boot(p, null)
  const msgs: string[] = []
  for (const sc of SCENARIOS) {
    vm.setPot(sc.pot)
    vm.setJoystick(...sc.joy)
    const from = vm.timeS + 0.3
    vm.runFor({ ms: 900 })
    const raws = [POT, J.horz, J.vert].map((pin) => codeOf(vm.analogIn[pin]))
    const want = raws.flatMap((r) => [
      { v: r, tol: A.noiseLsb },
      { v: pctOf(r), tol: 1 },
    ])
    const lines = linesOf(vm).filter((l) => l.t >= from)
    if (!lines.length) return { ok: false, messages: ['Rien n’est affiché au terminal : EUSART avec « Redirect STDIO to USART » et printf attendus'] }
    // Une ligne, ou deux ou trois lignes consécutives (une par entrée)
    const ok = lines.some((_, i) => [1, 2, 3].some((n) => i + n <= lines.length && matchAll(ints(lines.slice(i, i + n).map((l) => l.text).join(' ')), want)))
    if (!ok) {
      const last = lines[lines.length - 1].text
      msgs.push(`${sc.label} : brut ${raws.join(', ')} et ${raws.map(pctOf).join(' %, ')} % attendus (± 1), « ${last} » affiché`)
      if (raws.some((r) => pct16(r) !== pctOf(r) && ints(last).includes(pct16(r)))) msgs.push('calcul du pourcentage : dépassement sur 16 bits, utilisez un calcul en 32 bits')
      return { ok: false, messages: msgs }
    }
  }
  return { ok: true, messages: [`Valeurs brutes (± ${A.noiseLsb} LSB) et pourcentages (± 1 point) des 3 entrées conformes : ${SCENARIOS.map((s) => s.label).join(' ; ')}`] }
}

/* ───────────── §1.3 : Joy_Cal_X, Joy_Cal_Y ───────────── */

const SIG_X = 'int16_t Joy_Cal_X(adc_result_t NumX)'
const SIG_Y = 'int16_t Joy_Cal_Y(adc_result_t NumY)'

function q13(p: Program, _r: RotarySlot | null, files: Record<string, string>): Verdict {
  const src = squash(studentSource(files))
  const msgs: string[] = []
  for (const sig of [SIG_X, SIG_Y]) if (!src.includes(squash(sig))) msgs.push(`Fonction « ${sig}; » attendue (signature de l’énoncé)`)
  if (msgs.length) return { ok: false, messages: msgs }
  const vm = boot(p, null)
  vm.runFor({ ms: 300 })
  const rest = INFO3.analog.joyRest
  const call = (f: string, raw: number) => {
    const r = vm.invoke(f, [raw])
    if (!r.ok) throw new Error(`${f}(${raw}) : ${r.error}`)
    return r.value
  }
  const cases: [string, string, number, (v: number) => boolean, string][] = [
    ['Joy_Cal_X', 'repos', rest.x, (v) => Math.abs(v) <= 2, '0 ± 2'],
    ['Joy_Cal_Y', 'repos', rest.y, (v) => Math.abs(v) <= 2, '0 ± 2'],
    ['Joy_Cal_X', 'butée gauche', 0, (v) => v < 0 && Math.abs(v) >= 480, '≤ -480'],
    ['Joy_Cal_X', 'butée droite', MAX, (v) => v >= 480, '≥ 480'],
    ['Joy_Cal_Y', 'butée basse', INFO3.analog.joyYDown ? MAX : 0, (v) => v < 0 && Math.abs(v) >= 480, '≤ -480'],
    ['Joy_Cal_Y', 'butée haute', INFO3.analog.joyYDown ? 0 : MAX, (v) => v >= 480, '≥ 480'],
  ]
  for (const [f, label, raw, ok, want] of cases) {
    const v = call(f, raw)
    if (!ok(v)) {
      msgs.push(`${f}(${raw}) (${label}) : ${want} attendu, ${v} obtenu`)
      if (f === 'Joy_Cal_Y' && label !== 'repos' && Math.sign(v) === (label === 'butée haute' ? -1 : 1)) msgs.push('La valeur brute de Y augmente vers le bas (H48) : inverser l’axe dans Joy_Cal_Y')
    }
  }
  return msgs.length ? { ok: false, messages: msgs } : { ok: true, messages: ['Repos → 0 ± 2 ; gauche et bas négatifs, droite et haut positifs ; butées |valeur| ≥ 480'] }
}

/* ───────────── §2 : CAN sous interruption, section critique ───────────── */

function q2(p: Program, _r: RotarySlot | null, files: Record<string, string>): Verdict {
  const src = studentSource(files)
  const banned = ['ADCC_GetSingleConversion', 'ADCC_IsConversionDone'].filter((f) => new RegExp(`\\b${f}\\s*\\(`).test(src))
  if (banned.length) return { ok: false, messages: [`§2 : fonctions bloquantes interdites (${banned.join(', ')}) ; utiliser ADCC_StartConversion et ADCC_GetConversionResult sous interruption`] }
  const vm = boot(p, null)
  vm.access = { isrWrites: new Set(), mainReads: new Map() }
  vm.setJoystick(1 / 2, -1 / 2)
  const n = 3
  vm.runFor({ ms: (n + 0.5) * T.printPeriodS * MS })
  const msgs: string[] = []
  const X = channelOf(J.horz)
  const Y = channelOf(J.vert)
  const xs = vm.adcLog.filter((c) => c.ch === X)
  if (xs.length < 3) return { ok: false, messages: [`Conversions de JOY_HORZ : une toutes les ${fmtS(T.acqPeriodS)} attendue, ${xs.length} en ${n + 0.5} s`] }
  for (let i = 2; i < xs.length; i++) {
    const dt = vm.toS(xs[i].t0 - xs[i - 1].t0)
    if (rel(dt, T.acqPeriodS) > T.acqTolerance) {
      msgs.push(`Départ des conversions de X : toutes les ${fmtS(T.acqPeriodS)} ± ${T.acqTolerance * PCT} % attendu, ${fmtS(dt)} mesuré`)
      break
    }
  }
  for (const x of xs.slice(1, -1)) {
    const y = vm.adcLog.find((c) => c.ch === Y && c.t0 >= x.t1)
    const gap = y ? vm.toS(y.t0 - x.t1) : Infinity
    if (gap > T.yAfterXMaxS) {
      msgs.push(y ? `La conversion de Y démarre ${(gap * INFO3.units.usPerS).toFixed(0)} µs après la fin de X : moins de ${T.yAfterXMaxS * INFO3.units.usPerS} µs attendu (l’enchaîner dans l’interruption du CAN)` : 'Aucune conversion de JOY_VERT après celle de JOY_HORZ')
      break
    }
  }
  const lines = linesOf(vm)
  if (lines.length < 2) msgs.push(`Affichage toutes les ${T.printPeriodS} s attendu : ${lines.length} ligne(s) en ${n + 0.5} s`)
  else
    for (let i = 1; i < lines.length; i++) {
      const dt = lines[i].t - lines[i - 1].t
      if (rel(dt, T.printPeriodS) > T.printTolerance) {
        msgs.push(`Affichage : toutes les ${T.printPeriodS} s ± ${T.printTolerance * PCT} % attendu, ${dt.toFixed(3).replace('.', ',')} s mesuré`)
        break
      }
    }
  const open = vm.unprotectedShared()
  if (open.length) msgs.push(`accès concurrent non protégé : ${open.join(', ')} (variables de plus de 8 bits écrites sous interruption, lues dans main sans couper les IT)`)
  return msgs.length ? { ok: false, messages: msgs } : { ok: true, messages: [`X toutes les ${fmtS(T.acqPeriodS)} (± ${T.acqTolerance * PCT} %), Y enchaînée en moins de ${T.yAfterXMaxS * INFO3.units.usPerS} µs, affichage toutes les ${T.printPeriodS} s ; variables partagées lues avec les IT coupées`] }
}

/* ───────────── §3 : LED8x8.c / .h et séquence ───────────── */

const SIGS = ['void LED8x8_Write (uint8_t reg, uint8_t val);', 'void LED8x8_Initialize(uint8_t intensity) ;', 'void LED8x8_Clear( );', 'void blank_100ms(uint8_t delay_100ms);']
const TAB = [0x30, 0x78, 0x7c, 0x3e, 0x3e, 0x7c, 0x78, 0x30]
const STEP_TOL = 0.01
const COL_S = 0.2
const BLINK_S = 0.5
/** Durée minimale d'un état « stable » de la matrice (les écritures d'une image entière durent ~1 ms) */
const STABLE_S = 0.02

type Kind = 'blank' | 'col' | 'row' | 'diag' | 'tab' | 'other'
const segsOf = (vm: Vm) => Array.from({ length: N }, (_, d) => vm.matrix.segments(d))
function classify(s: number[]): { kind: Kind; key: string } {
  const key = s.join(',')
  const bits = (v: number) => [...v.toString(2)].filter((c) => c === '1').length
  if (s.every((v) => v === 0)) return { kind: 'blank', key }
  if (s.filter((v) => v === BYTE).length === 1 && s.every((v) => v === 0 || v === BYTE)) return { kind: 'col', key }
  if (s.every((v) => v === s[0]) && bits(s[0]) === 1) return { kind: 'row', key }
  if (s.every((v, d) => v === 1 << d) || s.every((v, d) => v === 1 << (N - 1 - d))) return { kind: 'diag', key }
  if ([...s].sort((a, b) => a - b).join(',') === [...TAB].sort((a, b) => a - b).join(',')) return { kind: 'tab', key }
  return { kind: 'other', key }
}

function q3(p: Program, matrix: RotarySlot | null, files: Record<string, string>): Verdict {
  const names = Object.keys(files)
  const msgs: string[] = []
  if (!names.includes('LED8x8.c') || !names.includes('LED8x8.h')) msgs.push('Fichiers LED8x8.c (Source Files) et LED8x8.h (Header Files) attendus dans le projet')
  const h = squash(files['LED8x8.h'] ?? '')
  for (const s of SIGS) if (!h.includes(squash(s))) msgs.push(`LED8x8.h : déclaration « ${s} » attendue (signature de l’énoncé)`)
  if (msgs.length) return { ok: false, messages: msgs }
  if (matrix !== 'mikrobus1') return { ok: false, messages: [matrix ? 'Carte 8x8 R click sur le mikroBUS 2 : CS arrive sur RD3 au lieu de RA3, rien ne s’affiche ; l’enficher sur le mikroBUS 1' : 'Carte 8x8 R click absente du banc : l’enficher sur le mikroBUS 1'] }

  // Appels unitaires
  const u = boot(p, matrix)
  u.runFor({ ms: 30 })
  const call = (f: string, args: number[]) => {
    const r = u.invoke(f, args)
    if (!r.ok) throw new Error(`${f}(${args.join(', ')}) : ${r.error}`)
  }
  call('LED8x8_Initialize', [0])
  const m = u.matrix
  if (m.shutdown || m.scanLimit !== N - 1 || m.decode || m.test || m.intensity) msgs.push(`LED8x8_Initialize(0) : shutdown = 1 (marche), scan limit 7, decode 0, test 0, intensité 0 attendus ; obtenu shutdown = ${m.shutdown ? 0 : 1}, scan limit ${m.scanLimit}, decode ${m.decode}, test ${m.test ? 1 : 0}, intensité ${m.intensity}`)
  call('LED8x8_Write', [1, BYTE])
  if (m.segments(0) !== BYTE || m.litCount !== N) msgs.push(`LED8x8_Write(0x01, 0xFF) : une colonne pleine (8 LED) attendue, ${m.litCount} LED allumées`)
  call('LED8x8_Clear', [])
  if (m.litCount) msgs.push(`LED8x8_Clear() : 0 LED attendue, ${m.litCount} allumées`)
  call('LED8x8_Write', [1, BYTE])
  const t0 = u.t
  let litDuring = 0
  const off = u.onMatrix(() => (litDuring = Math.max(litDuring, u.matrix.litCount)))
  call('blank_100ms', [3])
  off()
  const dur = u.toS(u.t - t0)
  if (litDuring || m.litCount) msgs.push('blank_100ms(3) : les 64 LED doivent rester éteintes pendant l’attente')
  if (rel(dur, 3 * 0.1) > STEP_TOL) msgs.push(`blank_100ms(3) : 300 ms ± 1 % attendus, ${fmtS(dur)} mesurés`)
  if (msgs.length) return { ok: false, messages: msgs }

  // Séquence du main
  const vm = boot(p, matrix)
  const log: { t: number; key: string; s: number[] }[] = []
  vm.onMatrix((t) => {
    const s = segsOf(vm)
    const key = s.join(',')
    if (!log.length || log[log.length - 1].key !== key) log.push({ t: vm.toS(t), key, s })
  })
  vm.runFor({ ms: 17_000 })
  const states = log
    .map((e, i) => ({ ...e, dur: (i + 1 < log.length ? log[i + 1].t : vm.timeS) - e.t, ...classify(e.s) }))
    .filter((e) => e.dur >= STABLE_S)
  let at = 0
  const take = (kind: Kind, count: number) => {
    const out: typeof states = []
    while (at < states.length && out.length < count) {
      if (states[at].kind === kind) out.push(states[at])
      else if (out.length && states[at].kind !== 'blank') break
      at++
    }
    return out
  }
  const fail = (m: string) => ({ ok: false, messages: [m] })
  const cols = take('col', N)
  if (cols.length < N || new Set(cols.map((c) => c.key)).size < N) return fail(`Colonnes : les 8 colonnes une à une attendues, ${new Set(cols.map((c) => c.key)).size} distinctes observées`)
  const iv = (xs: typeof states) => xs.slice(1).map((x, i) => x.t - xs[i].t)
  const badCol = iv(cols).find((d) => rel(d, COL_S) > STEP_TOL)
  if (badCol !== undefined) return fail(`Colonnes : une toutes les 200 ms ± 1 % attendue, ${fmtS(badCol)} mesuré`)
  const rows = take('row', N)
  if (rows.length < N || new Set(rows.map((c) => c.key)).size < N) return fail(`Lignes : les 8 lignes une à une attendues après les colonnes, ${new Set(rows.map((c) => c.key)).size} distinctes observées`)
  const badRow = iv(rows).find((d) => rel(d, COL_S) > STEP_TOL)
  if (badRow !== undefined) return fail(`Lignes : une toutes les 200 ms ± 1 % attendue, ${fmtS(badRow)} mesuré`)
  const diags = take('diag', 5)
  if (diags.length < 5) return fail(`Diagonale : 5 clignotements attendus après les lignes, ${diags.length} observés`)
  const badDiag = diags.find((d) => rel(d.dur, BLINK_S) > STEP_TOL)
  if (badDiag) return fail(`Diagonale : allumée 500 ms ± 1 % attendue, ${fmtS(badDiag.dur)} mesurée`)
  const tabs = take('tab', 2)
  if (tabs.length < 2) return fail('Motif Tab[8] : il doit clignoter (au moins 2 fois) après la diagonale')
  const badTab = tabs.find((d) => rel(d.dur, BLINK_S) > STEP_TOL)
  if (badTab) return fail(`Motif Tab[8] : allumé 500 ms ± 1 % attendu, ${fmtS(badTab.dur)} mesuré`)
  const own = take('other', 2)
  if (own.length < 2 || own[0].key !== own[1].key) return fail('Motif personnel : un motif différent de Tab doit clignoter après Tab[8]')
  return { ok: true, messages: ['Fonctions conformes (Initialize, Write, Clear, blank_100ms 300 ms)', 'Séquence : 8 colonnes et 8 lignes (200 ms), diagonale × 5 et Tab[8] (500 ms), motif personnel'] }
}

/* ───────────── §4 : carré 2x2 qui suit le joystick ───────────── */

export const JOY_POSITIONS: [number, number][] = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]
/** Position de la LED origine (bas droite du carré) : ± 3 aux butées ; colonne 4 + x, ligne 4 - y (0 = haut gauche) */
const SPAN = 3
const ORIGIN = N / 2

function q4(p: Program, matrix: RotarySlot | null): Verdict {
  if (matrix !== 'mikrobus1') return { ok: false, messages: ['Carte 8x8 R click à enficher sur le mikroBUS 1'] }
  const vm = boot(p, matrix)
  vm.runFor({ ms: 300 })
  for (const [x, y] of JOY_POSITIONS) {
    vm.setJoystick(x, y)
    vm.runFor({ ms: 300 })
    const mx = vm.matrix.matrix()
    const lit: [number, number][] = []
    mx.forEach((row, r) => row.forEach((on, c) => on && lit.push([r, c])))
    const col = ORIGIN + x * SPAN
    const row = ORIGIN - y * SPAN
    const want = [[row, col], [row - 1, col], [row, col - 1], [row - 1, col - 1]].map(([r, c]) => `${r},${c}`).sort()
    const got = lit.map(([r, c]) => `${r},${c}`).sort()
    const where = `joystick (${x}, ${y})`
    if (got.length !== 4) return { ok: false, messages: [`${where} : exactement 4 LED attendues, ${got.length} allumées`] }
    if (want.join(' ') !== got.join(' ')) return { ok: false, messages: [`${where} : carré lignes ${row}–${row + 1}, colonnes ${col}–${col + 1} attendu (en partant de 1, en haut à gauche), LED ${lit.map(([r, c]) => `(${r + 1}, ${c + 1})`).join(' ')} allumées`] }
  }
  return { ok: true, messages: [`${JOY_POSITIONS.length} positions (centre, 4 butées, 4 diagonales) : carré de 4 LED, décalage de ± ${SPAN} aux butées`] }
}

const GRADERS: Record<Tp6Challenge, (p: Program, r: RotarySlot | null, files: Record<string, string>) => Verdict> = { 'tp6-1-1': q11, 'tp6-1-3': q13, 'tp6-2': q2, 'tp6-3': q3, 'tp6-4': q4 }

/** `matrix` : mikroBUS où la carte 8x8 R click est enfichée */
export function gradeTp6(id: Tp6Challenge, files: Record<string, string>, matrix: RotarySlot | null): Verdict {
  const b = build(files)
  if ('error' in b) return { ok: false, messages: [b.error] }
  try {
    return GRADERS[id](b.program, matrix, files)
  } catch (e) {
    return { ok: false, messages: [`Erreur du professeur virtuel : ${e instanceof Error ? e.message : String(e)}`] }
  }
}
