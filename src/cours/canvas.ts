import { useEffect, useRef } from 'react'
import { nextTick } from '../lib/scope'

export const TAU = Math.PI * 2
export const DEG = Math.PI / 180
export const REDUCE = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
export const fr = (x: number, d = 0) => x.toFixed(d).replace('.', ',').replace('-', '−')

const NOMS = ['ink', 'muted', 'line', 'card', 'card-2', 'accent', 'ok', 'err', 'warn', 'north', 'south', 'copper', 'l1', 'l2', 'l3', 'steel', 'steel-2', 'rotor', 'ch1', 'ch2'] as const
export type Couleurs = Record<(typeof NOMS)[number], string>
const SOMBRE = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null
let cache: { cle: string; c: Couleurs } | null = null
/** Couleurs du thème (variables --color-* de index.css), relues seulement quand le thème clair / sombre change. */
export function couleurs(): Couleurs {
  const cle = `${document.documentElement.dataset.theme ?? ''}${SOMBRE?.matches}`
  if (cache?.cle !== cle) {
    const cs = getComputedStyle(document.documentElement)
    cache = { cle, c: Object.fromEntries(NOMS.map((n) => [n, cs.getPropertyValue(`--color-${n}`).trim()])) as Couleurs }
  }
  return cache.c
}

export type Dessin = (ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, c: Couleurs) => void

/**
 * Canvas redessiné à l'horloge commune des animations (ANIM_FPS) et à chaque redimensionnement.
 * `draw` reçoit dt en secondes (0 quand `animate` est faux) : la simulation avance dans le dessin même.
 */
export function useCanvas(draw: Dessin, animate = true) {
  const ref = useRef<HTMLCanvasElement>(null)
  const live = useRef({ draw, animate })
  live.current = { draw, animate }
  useEffect(() => {
    const el = ref.current!
    const ctx = el.getContext('2d')!
    let w = 0
    let h = 0
    const size = () => {
      const r = el.getBoundingClientRect()
      const d = window.devicePixelRatio || 1
      el.width = Math.max(1, Math.round(r.width * d))
      el.height = Math.max(1, Math.round(r.height * d))
      ctx.setTransform(d, 0, 0, d, 0, 0)
      w = r.width
      h = r.height
    }
    let last = performance.now()
    let timer = 0
    const frame = () => {
      const now = performance.now()
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      ctx.clearRect(0, 0, w, h)
      live.current.draw(ctx, w, h, live.current.animate ? dt : 0, couleurs())
      timer = window.setTimeout(frame, nextTick())
    }
    const ro = new ResizeObserver(size)
    ro.observe(el)
    size()
    frame()
    return () => {
      ro.disconnect()
      clearTimeout(timer)
    }
  }, [])
  return ref
}

/* ---------- primitives de dessin ---------- */

export const mono = (px: number, poids = 400) => `${poids} ${px}px "JetBrains Mono", monospace`

/** Point (r, θ) d'un repère polaire centré (cx, cy), θ en radians, sens trigonométrique. */
export const polaire = (cx: number, cy: number, r: number, t: number): [number, number] => [cx + r * Math.cos(t), cy - r * Math.sin(t)]

/** Secteur d'anneau entre les rayons r0, r1 et les angles a0, a1 (sens trigonométrique). */
export function secteur(ctx: CanvasRenderingContext2D, cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  ctx.beginPath()
  ctx.arc(cx, cy, r1, -a0, -a1, true)
  ctx.arc(cx, cy, r0, -a1, -a0, false)
  ctx.closePath()
}

export function fleche(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string, lw = 2) {
  const a = Math.atan2(y1 - y0, x1 - x0)
  const L = Math.hypot(x1 - x0, y1 - y0)
  if (L < 2) return
  const hs = Math.min(10, L * 0.35)
  ctx.strokeStyle = col
  ctx.fillStyle = col
  ctx.lineWidth = lw
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1 - hs * 0.8 * Math.cos(a), y1 - hs * 0.8 * Math.sin(a))
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x1 - hs * Math.cos(a - 0.4), y1 - hs * Math.sin(a - 0.4))
  ctx.lineTo(x1 - hs * Math.cos(a + 0.4), y1 - hs * Math.sin(a + 0.4))
  ctx.closePath()
  ctx.fill()
}

/** Courant dans un conducteur vu en coupe : ⊙ sortant (v > 0), ⊗ entrant (v < 0), taille ∝ |v|. */
export function conducteur(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, v: number, col: string) {
  if (Math.abs(v) < 0.1) return
  const k = r * Math.min(1, Math.abs(v)) * 0.62
  ctx.strokeStyle = col
  ctx.fillStyle = col
  ctx.lineWidth = 1.6
  ctx.beginPath()
  if (v > 0) {
    ctx.arc(x, y, Math.max(1.3, k * 0.5), 0, TAU)
    ctx.fill()
  } else {
    ctx.moveTo(x - k, y - k)
    ctx.lineTo(x + k, y + k)
    ctx.moveTo(x + k, y - k)
    ctx.lineTo(x - k, y + k)
    ctx.stroke()
  }
}

export interface Trace {
  f: (x: number) => number
  col: string
  lw?: number
  /** tracé en escalier (créneaux) : pas d'échantillonnage plus fin */
  n?: number
}

/**
 * Repère simple : axes, graduations Y, traces f(x) sur [x0, x1] × [y0, y1].
 * Renvoie les fonctions d'échelle pour superposer des annotations.
 */
export function repere(
  ctx: CanvasRenderingContext2D,
  c: Couleurs,
  box: { x: number; y: number; w: number; h: number },
  dom: { x0: number; x1: number; y0: number; y1: number },
  traces: Trace[],
  opts: { label?: string; yTicks?: number[]; yFmt?: (v: number) => string } = {},
) {
  const X = (x: number) => box.x + ((x - dom.x0) / (dom.x1 - dom.x0)) * box.w
  const Y = (y: number) => box.y + box.h - ((y - dom.y0) / (dom.y1 - dom.y0)) * box.h
  ctx.strokeStyle = c.line
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(box.x, box.y)
  ctx.lineTo(box.x, box.y + box.h)
  if (dom.y0 <= 0 && dom.y1 >= 0) {
    ctx.moveTo(box.x, Y(0))
    ctx.lineTo(box.x + box.w, Y(0))
  } else {
    ctx.moveTo(box.x, box.y + box.h)
    ctx.lineTo(box.x + box.w, box.y + box.h)
  }
  ctx.stroke()
  ctx.font = mono(10)
  ctx.fillStyle = c.muted
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (const v of opts.yTicks ?? []) ctx.fillText(opts.yFmt ? opts.yFmt(v) : fr(v), box.x - 4, Y(v))
  if (opts.label) {
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.font = mono(11, 600)
    ctx.fillStyle = c.ink
    ctx.fillText(opts.label, box.x + 4, box.y)
  }
  ctx.save()
  ctx.beginPath()
  ctx.rect(box.x, box.y - 2, box.w, box.h + 4)
  ctx.clip()
  for (const t of traces) {
    const n = t.n ?? Math.max(60, Math.round(box.w))
    ctx.strokeStyle = t.col
    ctx.lineWidth = t.lw ?? 2
    ctx.beginPath()
    for (let i = 0; i <= n; i++) {
      const x = dom.x0 + ((dom.x1 - dom.x0) * i) / n
      const px = X(x)
      const py = Y(t.f(x))
      if (i) ctx.lineTo(px, py)
      else ctx.moveTo(px, py)
    }
    ctx.stroke()
  }
  ctx.restore()
  return { X, Y }
}
