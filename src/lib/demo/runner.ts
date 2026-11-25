/**
 * Lecteur de démonstration : exécute les étapes d'un script sur un Lab, uniquement par ses méthodes (mêmes setters
 * que l'utilisateur). Instantané au début de chaque étape ⇒ Précédent / Suivant / reprise fiables.
 * La mise en scène (pointeur, entourages, carte de calcul) est confiée à un Presenter facultatif.
 */
import { defaultSetup } from '../scope/engine'
import type { PartielSubject } from '../reseaux/partiel'
import type { CaptureInfo, Lab, LabSnapshot, Zone } from './lab'
import { resolve, type Action, type CalcCard, type Ctx, type DemoScript, type KnobId, type Step, type Target } from './types'

export const HIGHLIGHT_COLOR = '#f43f5e'
/** Durée de « Run puis Stop » : plus d'une période du message (200 ms), le holdoff a le temps de caler le déclenchement — s */
export const RUN_STOP_S = 0.5

/** Mise en scène ; toutes les méthodes sont facultatives (tests : aucune) */
export interface Presenter {
  /** Avant l'action : amener la cible à l'écran, déplacer le pointeur fantôme */
  before?(a: Action, ctx: Ctx): Promise<void>
  /** Tourner une molette : appelle `apply` sur des valeurs intermédiaires puis la valeur finale */
  turn?(knob: KnobId, from: number, to: number, apply: (v: number) => void, ms?: number): Promise<void>
  highlight?(target: { dom: string } | { zone: { from: number; to: number } }, label: string): Promise<void>
  calc?(card: CalcCard): Promise<void>
  step?(step: Step, index: number, narration: string): void
  wait?(ms: number): Promise<void>
}

const fr = (v: number, digits = 3) => String(Number(v.toPrecision(digits))).replace('.', ',')

/** Valeur actuelle et setter d'une molette, via le Lab */
export function knobAccess(lab: Lab, k: KnobId): { get: () => number; set: (v: number) => void } {
  const s = () => lab.scope()
  switch (k) {
    case 'sdiv':
      return { get: () => s().sdiv, set: (v) => lab.set({ sdiv: v }) }
    case 'delay':
      return { get: () => s().delay, set: (v) => lab.set({ delay: v }) }
    case 'vdiv0':
      return { get: () => s().ch[0].vdiv, set: (v) => lab.setCh(0, { vdiv: v }) }
    case 'vdiv1':
      return { get: () => s().ch[1].vdiv, set: (v) => lab.setCh(1, { vdiv: v }) }
    case 'offset0':
      return { get: () => s().ch[0].offset, set: (v) => lab.setCh(0, { offset: v }) }
    case 'level':
      return { get: () => s().trig.level, set: (v) => lab.setTrig({ level: v }) }
    case 'holdoff':
      return { get: () => s().trig.holdoff, set: (v) => lab.setTrig({ holdoff: v }) }
    case 'pot':
      return { get: () => lab.potR(), set: (v) => lab.setPotR(v) }
    case 'eg':
      return { get: () => lab.gen().eg, set: (v) => lab.setGen({ eg: v }) }
    case 'width':
      return { get: () => lab.gen().width, set: (v) => lab.setGen({ width: v }) }
    case 'period':
      return { get: () => lab.gen().period, set: (v) => lab.setGen({ period: v }) }
    case 'f':
      return { get: () => lab.gen().f, set: (v) => lab.setGen({ f: v }) }
  }
}

interface Saved {
  lab: LabSnapshot
  memo: Record<string, number | string>
  capture: CaptureInfo | null
  grid: Zone[]
}

export class DemoRunner {
  readonly ctx: Ctx
  /** Prochaine étape à jouer */
  index = 0
  private saved: Saved[] = []
  private grid: Zone[] = []
  private hl: Zone[] = []

  readonly script: DemoScript
  readonly lab: Lab
  readonly presenter: Presenter

  constructor(script: DemoScript, lab: Lab, subject: PartielSubject, presenter: Presenter = {}) {
    this.script = script
    this.lab = lab
    this.presenter = presenter
    this.ctx = {
      lab,
      subject,
      memo: {},
      capture: null,
      turn: async (knob, value) => {
        const k = knobAccess(lab, knob)
        if (presenter.turn) await presenter.turn(knob, k.get(), value, k.set)
        k.set(value)
      },
      single: async () => (this.ctx.capture = await lab.single()),
      runStop: async (seconds) => (this.ctx.capture = await lab.runThenStop(seconds)),
      mark: async (zone, label) => {
        this.hl = [...this.hl, { ...zone, label, color: HIGHLIGHT_COLOR }]
        this.pushZones()
        await presenter.highlight?.({ zone }, label)
      },
    }
  }

  get done() {
    return this.index >= this.script.steps.length
  }

  private pushZones() {
    this.lab.setZones([...this.grid, ...this.hl])
  }

  /** Joue l'étape courante (instantané pris avant) puis avance */
  async next(): Promise<void> {
    if (this.done) return
    const i = this.index
    this.saved[i] = { lab: this.lab.snapshot(), memo: { ...this.ctx.memo }, capture: this.ctx.capture, grid: [...this.grid] }
    const step = this.script.steps[i]!
    this.hl = []
    this.pushZones()
    this.presenter.step?.(step, i, resolve(step.narration, this.ctx))
    for (const a of step.actions) await this.apply(a)
    this.index = i + 1
  }

  /** Revient au début de l'étape précédente (celle avant l'étape affichée) et la rejoue */
  async prev(): Promise<void> {
    this.restoreTo(Math.max(0, this.index - 2))
    await this.next()
  }

  /** Rétablit exactement l'état du début de l'étape i (si elle a déjà été jouée) */
  restoreTo(i: number) {
    const s = this.saved[i]
    if (!s) return
    this.lab.restore(s.lab)
    this.ctx.memo = { ...s.memo }
    this.ctx.capture = s.capture
    this.grid = [...s.grid]
    this.hl = []
    this.index = i
    this.saved.length = i
  }

  async runAll(): Promise<void> {
    while (!this.done) await this.next()
  }

  private async apply(a: Action): Promise<void> {
    const { lab, ctx, presenter: p } = this
    await p.before?.(a, ctx)
    switch (a.type) {
      case 'connect':
        lab.plug(a.male, a.female)
        break
      case 'disconnect':
        lab.unplug(a.male)
        break
      case 'range':
        lab.range()
        break
      case 'setGenerator':
        lab.setGen(resolve(a.patch, ctx))
        break
      case 'setScope':
        lab.set(resolve(a.patch, ctx))
        break
      case 'setChannel':
        lab.setCh(a.ch, resolve(a.patch, ctx))
        break
      case 'setTrigger':
        lab.setTrig(resolve(a.patch, ctx))
        break
      case 'turnKnob': {
        const k = knobAccess(lab, a.knob)
        const to = resolve(a.value, ctx)
        if (p.turn) await p.turn(a.knob, k.get(), to, k.set, a.ms)
        k.set(to)
        break
      }
      case 'pressButton':
        if (a.button === 'defaultSetup') {
          lab.setSettings(defaultSetup())
          lab.setMode('run')
        } else if (a.button === 'single') ctx.capture = await lab.single()
        else if (a.button === 'runStop') ctx.capture = await lab.runThenStop(RUN_STOP_S)
        else lab.setMode(a.button)
        break
      case 'moveCursor':
        lab.setCur({ on: true, [a.cursor]: resolve(a.value, ctx), ...(a.ych !== undefined ? { ych: a.ych } : {}) })
        break
      case 'zoom':
        lab.set({ ...(a.sdiv !== undefined ? { sdiv: resolve(a.sdiv, ctx) } : {}), ...(a.delay !== undefined ? { delay: resolve(a.delay, ctx) } : {}) })
        break
      case 'highlight': {
        const label = resolve(a.label, ctx)
        const target = resolveTarget(a.target, ctx)
        if ('zone' in target) {
          this.hl = [...this.hl, { ...target.zone, label, color: HIGHLIGHT_COLOR }]
          this.pushZones()
        }
        await p.highlight?.(target, label)
        break
      }
      case 'overlayGrid':
        this.grid = resolve(a.cells, ctx)
        this.pushZones()
        break
      case 'writeBit': {
        const v = resolve(a.value, ctx)
        this.grid = this.grid.map((z, i) => (i === a.index ? { ...z, label: `${z.label.split('=')[0]}=${v}` } : z))
        this.pushZones()
        break
      }
      case 'calc': {
        const result = resolve(a.result, ctx)
        ctx.memo[a.key] = result
        await p.calc?.({ formula: a.formula, subst: resolve(a.subst, ctx), result: `${fr(result, a.digits ?? 3)} ${a.unit}`.trim() })
        break
      }
      case 'fillAnswer':
        lab.setAnswer(a.part, { [a.field]: resolve(a.value, ctx) } as never)
        break
      case 'read':
        a.run(ctx)
        break
      case 'run':
        await a.run(ctx)
        break
      case 'tab':
        lab.setTab(a.index)
        break
      case 'wait':
        await p.wait?.(a.ms)
        break
    }
  }
}

function resolveTarget(t: Target, ctx: Ctx): { dom: string } | { zone: { from: number; to: number } } {
  return 'dom' in t ? t : { zone: resolve(t.zone, ctx) }
}
