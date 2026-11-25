/**
 * Moteur d'affichage de l'oscilloscope réaliste, commun à la face avant et à la vue compacte :
 * réglages, automate Run/Stop/Single, boucle de dessin du canevas (traces, repères, curseurs), mesures.
 * Toute la physique est dans src/lib/scope/ ; ce hook règle, anime et dessine.
 */
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { OSCILLO } from '../../data/reference'
import { gaussien, mulberry32 } from '../../au3/sim/prng'
import { formatSI } from '../../lib/format'
import { nextTick } from '../../lib/scope'
import {
  channelFn,
  defaultSetup,
  digitize,
  envelope,
  recordChannel,
  renderRecord,
  measure,
  measureDelay,
  measureRecord,
  refDiv,
  sampleRate,
  screenWindow,
  type Envelope,
  type Measures,
  type Trace,
} from '../../lib/scope/engine'
import { patchChannel, patchCursors, patchSettings, patchTrig, withProbe } from '../../lib/scope/settings'
import { initRun, stepRun, type RunMode, type RunState, type Status } from '../../lib/scope/runtime'
import type { Ch, ChannelSettings, MeasureKind, ScopeSettings, SignalSource } from '../../lib/scope/types'

const { divX, divY } = OSCILLO
const MAX_COLS = 2000
export const COLORS = ['var(--color-ch1)', 'var(--color-ch2)'] as const
export const CHS = [0, 1] as const
const READOUT_MS = 250
/** Course de la position verticale — div de part et d'autre du centre */
export const OFFSET_DIV = 20
export const AVG_STEPS = [2, 4, 8, 16, 32, 64, 128, 256]
/** Évite « −0 V » et les restes d'arrondi des pas de réglage */
export const zero = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v)

/** Zone colorée sur l'écran (champ d'une trame), en temps du banc */
export interface ScopeZone {
  from: number
  to: number
  label: string
  /** Couleur #rrggbb */
  color: string
}

export interface ScopeProps {
  sources: readonly [SignalSource | null, SignalSource | null]
  title?: string
  /** Réglages courants, à chaque changement (étapes qui valident les réglages de l'étudiant) */
  onStateChange?: (s: ScopeSettings) => void
  /** Zones à surligner entre deux instants du banc (révélation des champs d'une trame) */
  annotate?: (t0: number, t1: number) => ScopeZone[]
}

export const MEASURES: { kind: MeasureKind; label: string; unit: string }[] = [
  { kind: 'vpp', label: 'Vpp', unit: 'V' },
  { kind: 'max', label: 'Max', unit: 'V' },
  { kind: 'min', label: 'Min', unit: 'V' },
  { kind: 'ampl', label: 'Amplitude', unit: 'V' },
  { kind: 'largeurP', label: 'Largeur +', unit: 's' },
  { kind: 'largeurN', label: 'Largeur −', unit: 's' },
  { kind: 'periode', label: 'Période', unit: 's' },
  { kind: 'freq', label: 'Fréquence', unit: 'Hz' },
  { kind: 'montee', label: 'Montée', unit: 's' },
  { kind: 'retard', label: 'Retard 1→2', unit: 's' },
]
export const STATUS_COLOR: Record<Status, string> = { "Trig'd": '#3ee07a', Auto: '#f5d90a', Armé: '#fb923c', Stop: '#f87171' }

export const fr = (v: number, unit: string) => formatSI(v, unit, 3)

export interface Readout {
  status: Status
  mode: RunMode
  fs: number
  m: [Measures | null, Measures | null]
  delay: number
  clipped: [boolean, boolean]
  /** Déclenchement hors écran : -1 à gauche, +1 à droite */
  trigOff: -1 | 0 | 1
}

/** Dernière image dessinée : sert aux curseurs glissés à l'écran */
interface Frame {
  tTrig: number
  view: [number, number]
}

const srcIds = new WeakMap<SignalSource, number>()
let nextSrcId = 1
const idOf = (s: SignalSource) => srcIds.get(s) ?? (srcIds.set(s, nextSrcId), nextSrcId++)


export const DEFAULT_TITLE = 'OSCILLOSCOPE NUMÉRIQUE · 2 VOIES · 100 MHz · 2 GSa/s'

export function useScope({ sources, title = DEFAULT_TITLE, onStateChange, annotate }: ScopeProps) {
  const [st, setSt] = useState<ScopeSettings>(defaultSetup)
  const [readout, setReadout] = useState<Readout>({ status: 'Armé', mode: 'run', fs: 0, m: [null, null], delay: NaN, clipped: [false, false], trigOff: 0 })
  const [cursorKey, setCursorKey] = useState<'x1' | 'x2' | 'y1' | 'y2'>('x1')
  // Ref de rappel : le canevas peut changer quand on bascule face avant / compact
  const [canvasEl, canvasRef] = useState<HTMLCanvasElement | null>(null)
  const live = useRef({ st, sources, annotate })
  live.current = { st, sources, annotate }
  const onState = useRef(onStateChange)
  onState.current = onStateChange
  useEffect(() => onState.current?.(st), [st])
  const run = useRef<RunState>(initRun(0))
  const frame = useRef<Frame | null>(null)
  /** Dessin d'une image, appelé aussi hors de la boucle quand un réglage change */
  const redraw = useRef<(() => void) | null>(null)

  useEffect(() => {
    const canvas = canvasEl
    if (!canvas) return
    run.current = initRun(performance.now() / 1000)
    const ctx = canvas.getContext('2d', { alpha: false })!
    const css = getComputedStyle(document.documentElement)
    const colors = [css.getPropertyValue('--color-ch1').trim() || '#e8b500', css.getPropertyValue('--color-ch2').trim() || '#12b5c9']
    const cache: (Map<string, Envelope>)[] = [new Map(), new Map()]
    let timer = 0
    let frameNo = 0
    let lastReadout = 0
    let prevKey = ''
    const avgs: { key: string; count: number; t: number; min?: Float32Array; max?: Float32Array; clipped: boolean }[] = CHS.map(() => ({ key: '', count: 0, t: NaN, clipped: false }))

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = Math.min(MAX_COLS, Math.round(canvas.clientWidth * dpr)) || MAX_COLS / 2
      if (canvas.width !== w) {
        canvas.width = w
        canvas.height = Math.round((w * divY) / divX)
        prevKey = ''
      }
    }

    const draw = () => {
      resize()
      const { st: s, sources: srcs } = live.current
      const tNow = performance.now() / 1000
      run.current = stepRun(run.current, s, srcs, tNow)
      const r = run.current
      const cap = r.capture
      const W = canvas.width
      const H = canvas.height
      const ncol = W
      const px = H / divY
      frameNo++
      const stopped = r.mode === 'stop'
      const key = JSON.stringify([s, W, cap?.tTrig, r.status])
      if (stopped && key === prevKey) return
      prevKey = key

      // Graticule
      ctx.fillStyle = '#050607'
      ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = 'rgba(160,170,180,0.22)'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 4])
      ctx.beginPath()
      for (let i = 1; i < divX; i++) {
        ctx.moveTo(Math.round((i * W) / divX) + 0.5, 0)
        ctx.lineTo(Math.round((i * W) / divX) + 0.5, H)
      }
      for (let j = 1; j < divY; j++) {
        ctx.moveTo(0, Math.round(j * px) + 0.5)
        ctx.lineTo(W, Math.round(j * px) + 0.5)
      }
      ctx.stroke()
      ctx.setLineDash([])
      ctx.strokeStyle = 'rgba(160,170,180,0.45)'
      ctx.beginPath()
      for (let k = 0; k <= divX * 5; k++) {
        const x = Math.round((k * W) / (divX * 5)) + 0.5
        ctx.moveTo(x, H / 2 - 4)
        ctx.lineTo(x, H / 2 + 4)
      }
      for (let k = 0; k <= divY * 5; k++) {
        const y = Math.round((k * px) / 5) + 0.5
        ctx.moveTo(W / 2 - 4, y)
        ctx.lineTo(W / 2 + 4, y)
      }
      ctx.stroke()
      ctx.strokeStyle = 'rgba(160,170,180,0.5)'
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1)

      const font = Math.max(10, Math.round(H / 32))
      ctx.font = `600 ${font}px "JetBrains Mono", monospace`
      const yOf = (ch: ChannelSettings, v: number) => H / 2 - ((v - ch.offset) / ch.vdiv) * px
      const marker = (x: number, y: number, dx: number, label: string, color: string) => {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.moveTo(x, y - font * 0.6)
        ctx.lineTo(x + dx, y)
        ctx.lineTo(x, y + font * 0.6)
        ctx.fill()
        ctx.fillText(label, dx > 0 ? x + dx + 2 : x + dx - font * 0.8, y + font * 0.35)
      }

      const ms: [Measures | null, Measures | null] = [null, null]
      const fns: (((t: number) => number) | null)[] = [null, null]
      const clipped: [boolean, boolean] = [false, false]
      const recRises: (number[] | null)[] = [null, null]
      let view: [number, number] | null = null
      let measView: [number, number] | null = null
      if (cap) {
        view = screenWindow(s, cap.tTrig)
        measView = [Math.max(view[0], cap.rec[0]), Math.min(view[1], cap.rec[1])]
        frame.current = { tTrig: cap.tTrig, view }
        const v = view
        // Champs de trame surlignés (révélation), sous les traces
        for (const z of live.current.annotate?.(v[0], v[1]) ?? []) {
          const x0 = Math.max(0, ((z.from - v[0]) / (v[1] - v[0])) * W)
          const x1 = Math.min(W, ((z.to - v[0]) / (v[1] - v[0])) * W)
          if (x1 <= x0) continue
          ctx.fillStyle = z.color + '38'
          ctx.fillRect(x0, 0, x1 - x0, H)
          ctx.fillStyle = z.color
          ctx.fillRect(x0, H - font * 0.4, x1 - x0, font * 0.4)
          if (ctx.measureText(z.label).width < x1 - x0 - 4) ctx.fillText(z.label, x0 + 2, H - font * 0.6)
        }
        const peak = s.acq.mode === 'peak'
        const avg = s.acq.mode === 'moyenne'
        const gauss = gaussien(mulberry32(stopped ? Math.floor(cap.tTrig * 1e6) : frameNo))
        // Acquisition arrêtée : tout l'enregistrement (≤ 1 Mpts) est numérisé une fois, puis seulement relu
        if (stopped && !cap.records)
          cap.records = CHS.map((c) => {
            const src = cap.sources[c]
            const ch = s.ch[c]
            return src && ch.on ? recordChannel(channelFn(src, ch, cap.rec), src, cap.tTrig, cap.fs, cap.rec, ch, peak, gauss) : null
          })
        for (const c of CHS) {
          const src = cap.sources[c]
          const ch = s.ch[c]
          if (!src || !ch.on) continue
          const f = channelFn(src, ch, view)
          fns[c] = f
          let tr: Trace
          const stored = cap.records?.[c]
          const avgKey = JSON.stringify([idOf(src), s.ch[c], s.sdiv, s.delay, s.ref, s.acq, ncol])
          const a = avgs[c]
          if (stopped && avg && a.key === avgKey && a.min && a.max) tr = { min: a.min, max: a.max, clipped: a.clipped }
          else if (stopped && stored) tr = renderRecord(stored, cap.tTrig, cap.fs, view, ncol)
          else {
            const phase = src.period ? cap.tTrig - Math.floor(cap.tTrig / src.period) * src.period : cap.tTrig
            const k = [idOf(src), phase.toPrecision(10), view[0] - cap.tTrig, view[1] - cap.tTrig, cap.rec[0] - cap.tTrig, cap.rec[1] - cap.tTrig, ncol, cap.fs, ch.coupling, ch.probe, peak].join('|')
            let env = cache[c].get(k)
            if (!env) {
              env = envelope(f, src, cap.tTrig, cap.fs, cap.rec, view, ncol, peak)
              if (cache[c].size > 8) cache[c].clear()
              cache[c].set(k, env)
            }
            tr = digitize(env, ch, gauss, avg)
            if (avg) {
              // Moyenne glissante sur N acquisitions déclenchées : le bruit baisse, la trace converge
              if (a.key !== avgKey || !a.min || !a.max) Object.assign(a, { key: avgKey, count: 0, t: NaN, min: new Float32Array(ncol), max: new Float32Array(ncol) })
              const am = a.min!
              const aM = a.max!
              if (a.t !== cap.tTrig) {
                a.t = cap.tTrig
                a.count = Math.min(s.acq.n, a.count + 1)
                for (let i = 0; i < ncol; i++) {
                  am[i] = a.count === 1 || Number.isNaN(am[i]) ? tr.min[i] : am[i] + (tr.min[i] - am[i]) / a.count
                  aM[i] = a.count === 1 || Number.isNaN(aM[i]) ? tr.max[i] : aM[i] + (tr.max[i] - aM[i]) / a.count
                }
                a.clipped = tr.clipped
              }
              tr = { min: am, max: aM, clipped: a.clipped }
            }
          }
          clipped[c] = tr.clipped
          ctx.strokeStyle = colors[c]
          ctx.lineWidth = Math.max(1, W / 800)
          ctx.beginPath()
          let pMin = NaN
          let pMax = NaN
          for (let i = 0; i < ncol; i++) {
            const lo = tr.min[i]
            const hi = tr.max[i]
            if (Number.isNaN(lo)) {
              pMin = pMax = NaN
              continue
            }
            // Colonne prolongée jusqu'à la précédente : trace continue
            const a = Number.isNaN(pMax) ? hi : Math.max(hi, pMin)
            const b = Number.isNaN(pMin) ? lo : Math.min(lo, pMax)
            const x = i + 0.5
            ctx.moveTo(x, yOf(ch, a) - 0.5)
            ctx.lineTo(x, yOf(ch, b) + 0.5)
            pMin = lo
            pMax = hi
          }
          ctx.stroke()
          if (Date.now() - lastReadout > READOUT_MS) {
            // Arrêté : mesures sur les échantillons mémorisés (bruit et quantification compris)
            if (stopped && stored) {
              const m = measureRecord(stored, cap.tTrig, cap.fs, measView)
              ms[c] = m
              recRises[c] = m.rises
            } else ms[c] = measure(f, src, measView, tr, cap.fs)
          }
        }
      }
      // Repères : masse des voies, niveau et instant de déclenchement
      for (const c of CHS) if (s.ch[c].on) marker(0, Math.min(H - font, Math.max(font, yOf(s.ch[c], 0))), font, String(c + 1), colors[c])
      const tch = s.ch[s.trig.source]
      marker(W, Math.min(H - font, Math.max(font, yOf(tch, s.trig.level))), -font, 'T', colors[s.trig.source])
      let trigOff: Readout['trigOff'] = 0
      if (view && cap) {
        const xt = ((cap.tTrig - view[0]) / (view[1] - view[0])) * W
        trigOff = xt < 0 ? -1 : xt > W ? 1 : 0
        ctx.fillStyle = '#fb923c'
        ctx.beginPath()
        const x = Math.min(W - font, Math.max(font, xt))
        if (trigOff === 0) {
          ctx.moveTo(x - font * 0.6, 0)
          ctx.lineTo(x + font * 0.6, 0)
          ctx.lineTo(x, font)
        } else {
          const d = trigOff * font
          ctx.moveTo(x + d, font * 0.6)
          ctx.lineTo(x, 0)
          ctx.lineTo(x, font * 1.2)
        }
        ctx.fill()
      }
      if (s.cursors.on && cap && view) {
        ctx.setLineDash([6, 4])
        ctx.lineWidth = 1
        ctx.strokeStyle = 'rgba(231,232,234,0.9)'
        ctx.beginPath()
        for (const x of [s.cursors.x1, s.cursors.x2]) {
          const xp = Math.round(((cap.tTrig + x - view[0]) / (view[1] - view[0])) * W) + 0.5
          ctx.moveTo(xp, 0)
          ctx.lineTo(xp, H)
        }
        ctx.stroke()
        ctx.strokeStyle = colors[s.cursors.ych]
        ctx.beginPath()
        for (const y of [s.cursors.y1, s.cursors.y2]) {
          const yp = Math.round(yOf(s.ch[s.cursors.ych], y)) + 0.5
          ctx.moveTo(0, yp)
          ctx.lineTo(W, yp)
        }
        ctx.stroke()
        ctx.setLineDash([])
      }

      if (Date.now() - lastReadout > READOUT_MS) {
        lastReadout = Date.now()
        const c0 = cap?.sources[0]
        const c1 = cap?.sources[1]
        const nearest = (ts: number[], t: number) => ts.reduce((b, x) => (Number.isNaN(b) || Math.abs(x - t) < Math.abs(b - t) ? x : b), NaN)
        const [r1, r2] = recRises
        const delay =
          stopped && r1 && r2 && cap
            ? nearest(r2, nearest(r1, cap.tTrig)) - nearest(r1, cap.tTrig)
            : cap && measView && fns[0] && fns[1] && c0 && c1
              ? measureDelay(fns[0], c0, fns[1], c1, measView, cap.tTrig)
              : NaN
        setReadout({ status: r.status, mode: r.mode, fs: cap?.fs ?? 0, m: ms, delay, clipped, trigOff })
      }
    }

    // Redessin immédiat quand un réglage change (molette tournée) : pas d'attente de l'image suivante
    redraw.current = draw
    const tick = () => {
      timer = window.setTimeout(tick, nextTick())
      draw()
    }
    const io = new IntersectionObserver(([e]) => {
      clearTimeout(timer)
      if (e.isIntersecting) tick()
    })
    io.observe(canvas)
    return () => {
      clearTimeout(timer)
      io.disconnect()
    }
  }, [canvasEl])
  useEffect(() => {
    redraw.current?.()
  }, [st])

  /* ─────────── Réglages ─────────── */
  // Mêmes fonctions pures que le mode démonstration (lib/scope/settings.ts)
  const set = (patch: Partial<ScopeSettings>) => setSt((s) => patchSettings(s, patch))
  const setCh = (c: Ch, patch: Partial<ChannelSettings>) => setSt((s) => patchChannel(s, c, patch))
  const setTrig = (patch: Partial<ScopeSettings['trig']>) => setSt((s) => patchTrig(s, patch))
  const setCur = (patch: Partial<ScopeSettings['cursors']>) => setSt((s) => patchCursors(s, patch))
  /** Touche Force : une acquisition immédiate, non déclenchée (puis Stop si Single) */
  const forceTrigger = () => {
    const tNow = performance.now() / 1000
    const post = divX * st.sdiv - (refDiv(st) * st.sdiv - st.delay)
    const tTrig = tNow - Math.max(0, post)
    const hz = { sdiv: st.sdiv, delay: st.delay, ref: st.ref }
    const r = run.current
    run.current = { ...r, status: 'Auto', mode: r.mode === 'single' ? 'stop' : r.mode, capture: { tTrig, triggered: false, sources, fs: sampleRate(st.sdiv), rec: screenWindow(hz, tTrig), hz } }
    redraw.current?.()
  }
  const endDrag = () => {
    drag.current = null
  }
  const setMode = (mode: RunMode) => {
    const t = performance.now() / 1000
    run.current = mode === 'stop' ? { ...run.current, mode, status: 'Stop' } : { ...run.current, mode, armedAt: t, lastTrig: t }
    setReadout((r) => ({ ...r, mode, status: run.current.status }))
  }
  const setProbe = (c: Ch, probe: 1 | 10) => setSt((s) => withProbe(s, c, probe))

  /* ─────────── Curseurs glissés à l'écran (zone tactile ≥ 22 px de chaque côté) ─────────── */
  const drag = useRef<typeof cursorKey | null>(null)
  const pointer = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, w: r.width, h: r.height }
  }
  const cursorPx = (k: typeof cursorKey, p: ReturnType<typeof pointer>) => {
    const fr0 = frame.current
    if (!fr0) return Infinity
    if (k[0] === 'x') return Math.abs((fr0.tTrig + st.cursors[k] - fr0.view[0]) / (fr0.view[1] - fr0.view[0]) - p.x) * p.w
    const ch = st.ch[st.cursors.ych]
    return Math.abs(0.5 - (st.cursors[k] - ch.offset) / ch.vdiv / divY - p.y) * p.h
  }
  const moveCursor = (k: typeof cursorKey, p: ReturnType<typeof pointer>) => {
    const fr0 = frame.current
    if (!fr0) return
    if (k[0] === 'x') setCur({ [k]: fr0.view[0] + p.x * (fr0.view[1] - fr0.view[0]) - fr0.tTrig })
    else {
      const ch = st.ch[st.cursors.ych]
      setCur({ [k]: ch.offset + (0.5 - p.y) * divY * ch.vdiv })
    }
  }
  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!st.cursors.on) return
    const p = pointer(e)
    const best = (['x1', 'x2', 'y1', 'y2'] as const).map((k) => [k, cursorPx(k, p)] as const).sort((a, b) => a[1] - b[1])[0]
    if (best[1] > 22) return
    drag.current = best[0]
    setCursorKey(best[0])
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* pointeur déjà relâché */
    }
  }
  const onMove = (e: PointerEvent<HTMLCanvasElement>) => drag.current && moveCursor(drag.current, pointer(e))
  const nudgeCursor = (dir: 1 | -1) => {
    const k = cursorKey
    const step = k[0] === 'x' ? (divX * st.sdiv) / 500 : st.ch[st.cursors.ych].vdiv / 25
    setCur({ [k]: st.cursors[k] + dir * step })
  }

  const dX = st.cursors.x2 - st.cursors.x1
  const dY = st.cursors.y2 - st.cursors.y1
  const mSrc = readout.m[st.measures.source]
  const measureValue = (k: MeasureKind) => (k === 'retard' ? readout.delay : mSrc ? mSrc[k] : NaN)
  const fiftyPct = () => {
    const m = readout.m[st.trig.source]
    if (m) setTrig({ level: (m.max + m.min) / 2 })
  }
  const span = divX * st.sdiv

  return { st, setSt, readout, cursorKey, setCursorKey, canvasRef, set, setCh, setTrig, setCur, setMode, setProbe, onDown, onMove, endDrag, forceTrigger, nudgeCursor, dX, dY, measureValue, fiftyPct, span, sources, title }
}

export type ScopeApi = ReturnType<typeof useScope>
