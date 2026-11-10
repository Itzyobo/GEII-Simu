/**
 * Professeur virtuel du TP5 (PWM, UART, LED RGB). Défis rejoués dans la VM avec la configuration de
 * l'étudiant ; couleurs lues dans les registres des PWM (PWM6 = R, PWM7 = G, CCP1 = B), rapports cycliques
 * mesurés sur les broches, texte lu sur la sortie de l'EUSART (octets émis sur TX). Attendus : INFO3.tp5.
 */
import { INFO3 } from '../../data/reference'
import { compile, formatDiagnostic } from '../compiler'
import type { Program } from '../compiler/bytecode'
import { periodicOf } from '../vm/trace'
import { Vm, type RotarySlot } from '../vm/vm'
import type { Verdict } from './tp1'

export type Tp5Challenge = 'tp5-1' | 'tp5-2' | 'tp5-3' | 'tp5-4'
export const TP5_CHALLENGES: readonly Tp5Challenge[] = ['tp5-1', 'tp5-2', 'tp5-3', 'tp5-4']

const T = INFO3.tp5
const MS = INFO3.units.msPerS
const B = INFO3.c.bitsPerByte
const BYTE = (1 << B) - 1
const TWO = INFO3.pwm.dutyBits - B
const PCT = 100
const LF = 0x0a
const CR = 0x0d
/** Durée d'un appui propre et du repos qui suit — ms */
const PRESS_MS = 40
const pct = (x: number) => `${(x * PCT).toFixed(1).replace('.', ',')} %`
const RGB_PINS = INFO3.pins.rgb
const NAMES = ['R', 'G', 'B'] as const
const FIELDS = ['rouge', 'vert', 'bleu'] as const

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

/** Rapports cycliques 10 bits lus dans les registres : PWM6 (R), PWM7 (G), CCP1 (B) */
export function dutyRegisters(vm: Vm): [number, number, number] {
  const r = (n: string) => vm.readSfr(n)
  const pwmx = (n: number) => (r(`PWM${n}DCH`) << TWO) | (r(`PWM${n}DCL`) >> (B - TWO))
  const fmt = vm.bus.readBit('CCP1CON', 'CCP1FMT')
  const h = r('CCPR1H')
  const l = r('CCPR1L')
  const ccp = fmt ? (h << TWO) | (l >> (B - TWO)) : ((h & ((1 << TWO) - 1)) << B) | l
  return [pwmx(6), pwmx(7), ccp]
}

/** Niveaux 8 bits correspondant aux rapports cycliques (÷ 4) */
const levelsOf = (vm: Vm) => dutyRegisters(vm).map((d) => d >> T.colorShift) as [number, number, number]

/** Lignes émises sur TX : texte (sans \r\n) et instant de leur premier octet (s) */
function linesOf(vm: Vm): { text: string; t: number; end: string }[] {
  const out: { text: string; t: number; end: string }[] = []
  let cur: number[] = []
  let t0 = 0
  for (const s of vm.eusart.sent) {
    if (!cur.length) t0 = vm.toS(s.t)
    cur.push(s.byte)
    if (s.byte === LF) {
      const end = cur.length >= 2 && cur[cur.length - 2] === CR ? '\r\n' : '\n'
      out.push({ text: String.fromCharCode(...cur.slice(0, cur.length - end.length)), t: t0, end })
      cur = []
    }
  }
  return out
}

/** Source C de l'étudiant (fichiers hors MCC), espaces normalisés */
const studentSource = (files: Record<string, string>) =>
  Object.entries(files)
    .filter(([f]) => !f.startsWith(INFO3.mcc.dir) && /\.(c|h)$/.test(f))
    .map(([, s]) => s.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' '))
    .join('\n')
    .replace(/\s+/g, ' ')

const RGB_STRUCT = /typedef struct \{ ?uint8_t red; ?uint8_t green; ?uint8_t blue; ?\} ?rgb_color_t ?;/
const STATE_ENUM = /typedef enum \{ ?SET_RED ?, ?SET_GREEN ?, ?SET_BLUE ?,? ?\} ?state_t ?;/

const fn = (p: Program, name: string) => p.funcs.find((f) => f.name === name && f.entry >= 0)

function staticChecks(p: Program, files: Record<string, string>, want: ('struct' | 'setColor' | 'enum' | 'inc' | 'dec')[]): string[] {
  const src = studentSource(files)
  const msgs: string[] = []
  if (want.includes('struct') && !RGB_STRUCT.test(src)) msgs.push('Type rgb_color_t : « typedef struct { uint8_t red; uint8_t green; uint8_t blue; } rgb_color_t; » attendu, comme dans l’énoncé')
  if (want.includes('setColor')) {
    const f = fn(p, 'RGBL_SetColor')
    if (!f || f.params.length !== 1 || f.params[0].structSize !== NAMES.length) msgs.push('Fonction void RGBL_SetColor(rgb_color_t color) introuvable')
  }
  if (want.includes('enum') && !STATE_ENUM.test(src)) msgs.push('Type state_t : « typedef enum { SET_RED, SET_GREEN, SET_BLUE } state_t; » attendu, comme dans l’énoncé')
  for (const [k, name] of [['inc', 'IncrementCurrentColor'], ['dec', 'DecrementCurrentColor']] as const) {
    if (!want.includes(k)) continue
    const f = fn(p, name)
    if (!f || f.params.length !== 0) msgs.push(`Fonction void ${name}(void) introuvable`)
  }
  return msgs
}

/* ───────────── §1 : rouge et « (R,G,B) = (255,0,0) » ───────────── */

function q1(p: Program, rotary: RotarySlot | null): Verdict {
  const vm = boot(p, rotary)
  vm.runFor({ ms: 100 })
  const m = (pin: string) => periodicOf(vm.gpio.trace, pin, vm.msToTicks(40), vm.t).duty
  const [r, g, b] = [m(RGB_PINS.r), m(RGB_PINS.g), m(RGB_PINS.b)]
  const msgs: string[] = []
  if (r < T.redMinDuty) msgs.push(`Rouge (PWM6, ${RGB_PINS.r}) : rapport cyclique ≥ ${pct(T.redMinDuty)} attendu, ${pct(r)} mesuré`)
  if (g > 0) msgs.push(`Vert (PWM7, ${RGB_PINS.g}) : 0 % attendu, ${pct(g)} mesuré`)
  if (b > 0) msgs.push(`Bleu (CCP1, ${RGB_PINS.b}) : 0 % attendu, ${pct(b)} mesuré`)
  if (!r && !g && !b && !vm.ppsPinsOf(INFO3.pwm.modules.find((x) => x.id === 'PWM6')!.ppsOut).length) msgs.push(`PWM6 n’est relié à aucune broche : ${RGB_PINS.r} doit être la sortie de PWM6 (Pin Manager: Grid View, PPS)`)
  const lines = linesOf(vm)
  if (!vm.eusart.sent.length) msgs.push('Rien n’est envoyé sur TX : EUSART, « Redirect STDIO to USART » et printf attendus')
  else if (!lines.length) msgs.push(`Fin de ligne attendue après « ${T.redLine} » (\\r\\n)`)
  else if (lines[0].text !== T.redLine) msgs.push(`Terminal : « ${T.redLine} » attendu, « ${lines[0].text} » reçu`)
  return msgs.length ? { ok: false, messages: msgs } : { ok: true, messages: [`Rouge : ${pct(r)} sur PWM6, vert et bleu à 0 %`, `Terminal : « ${T.redLine} » suivi de ${lines[0].end === '\r\n' ? '\\r\\n' : '\\n'}`] }
}

/* ───────────── §2 : struct, RGBL_SetColor, une ligne par seconde ───────────── */

/** Appel unitaire RGBL_SetColor(couleur) : struct posée en fin d'espace de données */
function setColor(vm: Vm, c: readonly number[]): { ok: true; duty: [number, number, number] } | { ok: false; error: string } {
  const addr = INFO3.vm.memory.size - NAMES.length - 1
  c.forEach((v, i) => vm.pokeByte(addr + i, v))
  const r = vm.invoke('RGBL_SetColor', [addr])
  if (!r.ok) return r
  return { ok: true, duty: dutyRegisters(vm) }
}

function q2(p: Program, rotary: RotarySlot | null, files: Record<string, string>): Verdict {
  const st = staticChecks(p, files, ['struct', 'setColor'])
  if (st.length) return { ok: false, messages: st }
  const msgs: string[] = []
  const unit = boot(p, rotary)
  unit.runFor({ ms: 20 })
  for (const c of T.colors.slice(1)) {
    const r = setColor(unit, c)
    if (!r.ok) return { ok: false, messages: [`RGBL_SetColor(${c.join(', ')}) : ${r.error}`] }
    const want = c.map((v) => v << T.colorShift)
    if (r.duty.some((d, i) => d !== want[i])) {
      msgs.push(`RGBL_SetColor(${c.join(', ')}) : rapports cycliques ${want.join(', ')} attendus sur 10 bits (R, G, B), ${r.duty.join(', ')} écrits`)
      const max = Math.max(...r.duty) / ((1 << INFO3.pwm.dutyBits) - 1)
      if (max <= T.unconvertedMaxDuty && r.duty.every((d, i) => d === c[i])) msgs.push(`rapport cyclique au plus ${Math.round(T.unconvertedMaxDuty * PCT)} % : couleur non convertie sur 10 bits`)
      return { ok: false, messages: msgs }
    }
  }
  const vm = boot(p, rotary)
  const n = 4
  vm.runFor({ ms: (n + 0.5) * T.lineIntervalS * MS })
  const lines = linesOf(vm)
  if (lines.length < 2) return { ok: false, messages: [`Une ligne par seconde attendue au terminal : ${lines.length} reçue(s) en ${n + 0.5} s`] }
  for (let i = 1; i < lines.length; i++) {
    const dt = lines[i].t - lines[i - 1].t
    if (Math.abs(dt - T.lineIntervalS) / T.lineIntervalS > T.lineTolerance) return { ok: false, messages: [`Intervalle entre deux lignes : ${T.lineIntervalS} s ± ${Math.round(T.lineTolerance * PCT)} % attendu, ${dt.toFixed(3).replace('.', ',')} s mesuré (le printf dure aussi : environ 1 ms par caractère)`] }
  }
  // Chaque ligne contient les trois niveaux de la couleur affichée, dans l'ordre R, G, B (format libre)
  const check = boot(p, rotary)
  let seen = 0
  for (let k = 0; k < n; k++) {
    check.runUntil((v) => linesOf(v).length > k, (T.lineIntervalS + T.lineTolerance) * MS * 2)
    const line = linesOf(check)[k]
    if (!line) break
    const levels = levelsOf(check)
    const nums = (line.text.match(/\d+/g) ?? []).map(Number)
    let j = 0
    for (const x of nums) if (j < levels.length && x === levels[j]) j++
    if (j < levels.length) return { ok: false, messages: [`Ligne « ${line.text} » : les niveaux ${levels.join(', ')} (R, G, B de la couleur affichée) attendus dans cet ordre`] }
    seen++
  }
  return { ok: true, messages: [`RGBL_SetColor : (44, 117, 255) → 176, 468, 1020 ; (253, 63, 146) → 1012, 252, 584`, `${lines.length} lignes, une par seconde (± ${Math.round(T.lineTolerance * PCT)} %), ${seen} vérifiées : niveaux R, G, B dans l’ordre`] }
}

/* ───────────── §3 et §4 : machine à états (S2), +16 (S1), codeur ───────────── */

const ledPin = (name: string) => INFO3.pins.leds.find((l) => l.name === name)!.pin
const stateOf = (vm: Vm): number | null => {
  const lit = T.stateLeds.map((n) => vm.getPin(ledPin(n)))
  return lit.filter((x) => x).length === 1 ? lit.indexOf(1) : null
}
const fmtState = (vm: Vm) => T.stateLeds.map((n) => `${n} = ${vm.getPin(ledPin(n))}`).join(', ')

function click(vm: Vm, name: string) {
  vm.press(name)
  vm.runFor({ ms: PRESS_MS })
  vm.release(name)
  vm.runFor({ ms: PRESS_MS })
}

const [S1, S2] = INFO3.pins.buttons.map((b) => b.name)

/** Scénario commun : S2 fait tourner l'état, S1 ajoute 16 au champ courant ; renvoie le choix de débordement */
function stateScenario(vm: Vm, msgs: string[]): string | null {
  vm.runFor({ ms: 50 })
  if (stateOf(vm) !== 0) {
    msgs.push(`Au démarrage : état SET_RED attendu (seule ${T.stateLeds[0]} allumée), ${fmtState(vm)}`)
    return null
  }
  for (let s = 0; s < FIELDS.length; s++) {
    const before = levelsOf(vm)
    const dBefore = dutyRegisters(vm)[s]
    click(vm, S1)
    const after = levelsOf(vm)
    const want = before.map((v, i) => (i === s ? Math.min(BYTE, v + T.step) : v))
    if (dutyRegisters(vm)[s] - dBefore === T.step) {
      msgs.push(`S1 en ${FIELDS[s]} : le rapport cyclique n’a augmenté que de ${T.step} : couleur non convertie sur 10 bits (× 4)`)
      return null
    }
    if (after.some((v, i) => v !== want[i])) {
      msgs.push(`S1 en état ${['SET_RED', 'SET_GREEN', 'SET_BLUE'][s]} : (R, G, B) = (${want.join(', ')}) attendu, (${after.join(', ')}) obtenu`)
      return null
    }
    click(vm, S2)
    const next = (s + 1) % FIELDS.length
    if (stateOf(vm) !== next) {
      msgs.push(`S2 : passage au ${FIELDS[next]} attendu (seule ${T.stateLeds[next]} allumée), ${fmtState(vm)}`)
      return null
    }
  }
  // Retour en rouge : débordement au-delà de 255
  for (let k = 0; k <= BYTE / T.step + 1; k++) {
    const before = levelsOf(vm)[0]
    click(vm, S1)
    const after = levelsOf(vm)[0]
    if (before + T.step > BYTE) {
      if (after === before + T.step - (BYTE + 1)) return 'au-delà de 255 le champ repart de 0 (débordement du uint8_t)'
      if (after === BYTE || after === before) return 'au-delà de 255 le champ reste bloqué à 255'
      msgs.push(`Débordement du rouge : ${before} + ${T.step} donne ${after} (retour à ${before + T.step - (BYTE + 1)} ou blocage à 255 attendu)`)
      return null
    }
    if (after !== before + T.step) {
      msgs.push(`S1 en rouge : ${before + T.step} attendu, ${after} obtenu`)
      return null
    }
  }
  return null
}

function q3(p: Program, rotary: RotarySlot | null, files: Record<string, string>): Verdict {
  const st = staticChecks(p, files, ['enum', 'inc'])
  if (st.length) return { ok: false, messages: st }
  const vm = boot(p, rotary)
  const msgs: string[] = []
  const overflow = stateScenario(vm, msgs)
  if (msgs.length || !overflow) return { ok: false, messages: msgs.length ? msgs : ['Scénario S1 / S2 incomplet'] }
  return { ok: true, messages: [`S2 : rouge → vert → bleu → rouge, une seule LED (${T.stateLeds.join(', ')}) allumée, celle de l’état`, `S1 : +${T.step} sur le champ courant ; ${overflow} (les deux sont acceptés, H46)`] }
}

function q4(p: Program, rotary: RotarySlot | null, files: Record<string, string>): Verdict {
  const st = staticChecks(p, files, ['dec'])
  if (st.length) return { ok: false, messages: st }
  if (rotary !== 'mikrobus2') return { ok: false, messages: [rotary ? 'Carte Rotary sur le mikroBUS 1 : ENCA et ENCB n’arrivent pas sur RD1 et RA2, l’enficher sur le mikroBUS 2' : 'Carte Rotary absente du banc : l’enficher sur le mikroBUS 2'] }
  const vm = boot(p, rotary)
  vm.runFor({ ms: 50 })
  const msgs: string[] = []
  const turns = (dir: 1 | -1, field: number, label: string) => {
    for (let k = 0; k < T.encoderDetents; k++) {
      const before = levelsOf(vm)[field]
      const ring = vm.ring.outputs
      vm.turn(dir)
      vm.runFor({ ms: 30 })
      const after = levelsOf(vm)[field]
      const ok = dir > 0 ? after > before || before === BYTE : after < before || before === 0
      if (!ok) {
        msgs.push(`Cran ${k + 1} ${label} : le ${FIELDS[field]} devait ${dir > 0 ? 'augmenter' : 'diminuer'} (${before} → ${after})`)
        return false
      }
      if (vm.ring.outputs === ring) {
        msgs.push(`Cran ${k + 1} ${label} : l’anneau de LED ne réagit pas au codeur`)
        return false
      }
    }
    return true
  }
  if (!turns(1, 0, 'horaire (rouge)') || !turns(-1, 0, 'anti-horaire (rouge)')) return { ok: false, messages: msgs }
  click(vm, S2)
  if (stateOf(vm) !== 1) return { ok: false, messages: [`S2 : passage au vert attendu (seule ${T.stateLeds[1]} allumée), ${fmtState(vm)}`] }
  if (!turns(1, 1, 'horaire (vert)')) return { ok: false, messages: msgs }
  return { ok: true, messages: [`Codeur : sens horaire → le champ courant augmente, anti-horaire → il diminue (${T.encoderDetents} crans par sens)`, 'S2 change de champ ; l’anneau suit le codeur'] }
}

const GRADERS: Record<Tp5Challenge, (p: Program, r: RotarySlot | null, files: Record<string, string>) => Verdict> = { 'tp5-1': q1, 'tp5-2': q2, 'tp5-3': q3, 'tp5-4': q4 }

export function gradeTp5(id: Tp5Challenge, files: Record<string, string>, rotary: RotarySlot | null): Verdict {
  const b = build(files)
  if ('error' in b) return { ok: false, messages: [b.error] }
  try {
    return GRADERS[id](b.program, rotary, files)
  } catch (e) {
    return { ok: false, messages: [`Erreur du professeur virtuel : ${e instanceof Error ? e.message : String(e)}`] }
  }
}
