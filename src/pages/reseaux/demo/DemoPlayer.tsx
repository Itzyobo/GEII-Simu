/**
 * Lecteur de démonstration avec mise en scène : pointeur fantôme qui va sur la commande, clique, tourne une molette
 * ou porte un câble jusqu'à la BNC ; entourage pulsé de la valeur à lire ; carte de calcul (formule → valeurs lues
 * → résultat) ; narration (aria-live, voix fr-FR facultative) ; Lecture / Pause, Précédent, Suivant, vitesse,
 * pas à pas ou automatique ; toucher l'interface met la démo en pause. prefers-reduced-motion : pas de vol du
 * pointeur ni de rotation, entourages conservés.
 */
import { useEffect, useRef, useState } from 'react'
import { SDIV_STEPS, VDIV_STEPS } from '../../../lib/scope/engine'
import type { Lab } from '../../../lib/demo/lab'
import { DemoRunner, type Presenter } from '../../../lib/demo/runner'
import type { Action, CalcCard, DemoScript, KnobId } from '../../../lib/demo/types'
import type { PartielSubject } from '../../../lib/reseaux/partiel'
import type { Female, Male } from '../../../lib/reseaux/benchTopology'

const SPEEDS = [0.5, 1, 2] as const
/** Temps de lecture en mode automatique : ≈ 60 ms par caractère, au moins 2,5 s */
const READ_MS_PER_CHAR = 60
const READ_MIN_MS = 2500

interface Ring {
  id: number
  el: Element
  label: string
  /** Cible dans la fenêtre au moment où on l'entoure */
  shown: boolean
}

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))

const femaleSel = (f: Female) =>
  f === 'ch1' ? '[data-port="scope-ch1"]' : f === 'ch2' ? '[data-port="scope-ch2"]' : f.startsWith('tee') ? `[data-demo="male-${f.slice(0, 4)}"]` : `[data-port="${f}"]`

export default function DemoPlayer({
  script,
  lab,
  subject,
  part,
  initialSpeed = 1,
  onEnd,
  onQuit,
}: {
  script: DemoScript
  lab: Lab
  subject: PartielSubject
  part: 0 | 1 | 2
  initialSpeed?: number
  onEnd: (recap: string[]) => void
  onQuit: () => void
}) {
  const [phase, setPhase] = useState('')
  const [narration, setNarration] = useState('Prêt : appuie sur Lecture.')
  const [index, setIndex] = useState(0)
  const [calc, setCalc] = useState<{ card: CalcCard; stage: number } | null>(null)
  const [rings, setRings] = useState<Ring[]>([])
  const [pointer, setPointer] = useState<{ x: number; y: number; on: boolean; turning: boolean; click: number }>({ x: 0, y: 0, on: false, turning: false, click: 0 })
  const [playing, setPlaying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [paused, setPaused] = useState(false)
  const [auto, setAuto] = useState(true)
  const [speed, setSpeed] = useState(initialSpeed)
  const [voice, setVoice] = useState(false)
  const speedRef = useRef(speed)
  speedRef.current = speed
  const playingRef = useRef(false)
  const autoRef = useRef(auto)
  autoRef.current = auto
  const voiceRef = useRef(voice)
  voiceRef.current = voice
  const root = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const ringSeq = useRef(0)

  const t = (ms: number) => (reduceMotion() ? Math.min(ms, 120) : ms) / speedRef.current
  const find = (sel: string): Element | null => document.querySelector(`[data-demo-part="${part}"] ${sel}`) ?? document.querySelector(sel)

  /** Amène la cible au milieu de la zone visible (sous la barre d'épreuve, au-dessus de la feuille de narration) */
  const ensureVisible = async (el: Element) => {
    const r = el.getBoundingClientRect()
    const top = 76
    const sheetH = window.innerWidth < 768 ? (sheet.current?.getBoundingClientRect().height ?? 0) : 0
    const bottom = window.innerHeight - sheetH - 12
    if (r.top < top || r.bottom > bottom) {
      window.scrollBy({ top: r.top + r.height / 2 - (top + bottom) / 2, behavior: reduceMotion() ? 'auto' : 'smooth' })
      await sleep(t(350))
    }
  }
  const pointAt = async (el: Element | null, click = false) => {
    if (!el) return
    await ensureVisible(el)
    const r = el.getBoundingClientRect()
    setPointer((p) => ({ ...p, x: r.left + r.width / 2, y: r.top + r.height / 2, on: true }))
    await sleep(t(450))
    if (click) setPointer((p) => ({ ...p, click: p.click + 1 }))
  }

  const targetOf = (a: Action): { from?: string; to?: string; click?: boolean } => {
    const male = (m: Male) => (lab.conn()[m] || m.startsWith('cordon') || m.startsWith('coax') ? `[data-demo="male-${m}"]` : `[data-demo="tray-${m}"]`)
    switch (a.type) {
      case 'connect':
        return { from: male(a.male), to: femaleSel(a.female), click: true }
      case 'disconnect':
        return { from: `[data-demo="male-${a.male}"]`, click: true }
      case 'setGenerator':
        return { from: '[data-demo="gen"]' }
      case 'setScope':
      case 'setChannel':
      case 'setTrigger':
        return { from: a.dom ? `[data-demo="${a.dom}"]` : '[data-demo="scope"]' }
      case 'pressButton':
        return { from: `[data-demo="key-${a.button === 'runStop' ? 'run' : a.button}"]`, click: true }
      case 'moveCursor':
      case 'overlayGrid':
        return { from: '[data-demo="screen"]' }
      case 'zoom':
        return { from: '[data-demo="knob-sdiv"]' }
      case 'fillAnswer':
        return { from: `[data-demo="ans-${a.part}-${a.field}"]`, click: true }
      case 'tab':
        return { from: `[data-demo="tab-${a.index}"]`, click: true }
      default:
        return {}
    }
  }

  const presenter: Presenter = {
    step: (step, i, text) => {
      setPhase(step.phase)
      setNarration(text)
      setIndex(i + 1)
      setCalc(null)
      setRings([])
      if (voiceRef.current && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const u = new SpeechSynthesisUtterance(text)
        u.lang = 'fr-FR'
        window.speechSynthesis.speak(u)
      }
    },
    narrate: (text) => {
      setNarration(text)
      if (voiceRef.current && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const u = new SpeechSynthesisUtterance(text)
        u.lang = 'fr-FR'
        window.speechSynthesis.speak(u)
      }
    },
    before: async (a) => {
      const tg = targetOf(a)
      if (tg.from) await pointAt(find(tg.from), tg.click && !tg.to)
      if (tg.to) await pointAt(find(tg.to), true)
    },
    turn: async (knob: KnobId, from, to, apply, ms = 700) => {
      await pointAt(find(`[data-demo="knob-${knob}"]`))
      const n = reduceMotion() ? 1 : 8
      setPointer((p) => ({ ...p, turning: true }))
      const list = knob === 'sdiv' ? SDIV_STEPS : knob === 'vdiv0' || knob === 'vdiv1' ? VDIV_STEPS.map((v) => v * lab.scope().ch[knob === 'vdiv0' ? 0 : 1].probe) : null
      const geometric = list !== null || knob === 'width' || knob === 'period' || knob === 'f' || knob === 'holdoff'
      for (let i = 1; i < n; i++) {
        const u = i / n
        let v = geometric && from > 0 && to > 0 ? from * (to / from) ** u : from + (to - from) * u
        if (list) v = list.reduce((b, x) => (Math.abs(Math.log(x / v)) < Math.abs(Math.log(b / v)) ? x : b), list[0]!)
        apply(v)
        await sleep(t(ms / n))
      }
      setPointer((p) => ({ ...p, turning: false }))
    },
    highlight: async (target, label) => {
      const el = 'dom' in target ? find(`[data-demo="${target.dom}"]`) : find('[data-demo="screen"]')
      if (!el) return
      await ensureVisible(el)
      const id = ++ringSeq.current
      const b = el.getBoundingClientRect()
      const shown = b.bottom > 0 && b.top < window.innerHeight && b.right > 0 && b.left < window.innerWidth
      setRings((rs) => [...rs.filter((r) => r.el !== el), { id, el, label, shown }])
      await sleep(t(1100))
    },
    calc: async (card) => {
      setCalc({ card, stage: 1 })
      await sleep(t(700))
      setCalc({ card, stage: 2 })
      await sleep(t(800))
      setCalc({ card, stage: 3 })
      await sleep(t(900))
    },
    wait: (ms) => sleep(t(ms)),
  }

  const runner = useRef<DemoRunner | null>(null)
  if (!runner.current) runner.current = new DemoRunner(script, lab, subject, presenter)
  // Le presenter suit les derniers setters (fermetures à jour)
  Object.assign(runner.current.presenter, presenter)

  // Une seule boucle de lecture et un seul pas à la fois ; rien après démontage (StrictMode remonte les effets)
  const loopActive = useRef(false)
  const stepping = useRef(false)
  const mounted = useRef(false)
  const runOne = async () => {
    const r = runner.current!
    if (r.done || stepping.current) return
    stepping.current = true
    setBusy(true)
    try {
      await r.next()
    } catch (e) {
      setNarration(`Démo interrompue : ${(e as Error).message}`)
      playingRef.current = false
      setPlaying(false)
    } finally {
      stepping.current = false
      setBusy(false)
    }
    if (r.done && mounted.current) {
      playingRef.current = false
      setPlaying(false)
      onEnd(script.recap(r.ctx))
    }
  }
  const play = async () => {
    playingRef.current = true
    setPlaying(true)
    setPaused(false)
    if (loopActive.current) return
    loopActive.current = true
    try {
      while (playingRef.current && mounted.current && !runner.current!.done) {
        await runOne()
        if (!autoRef.current) break
        if (!playingRef.current || runner.current!.done) break
        const text = narrationRef.current
        await sleep(Math.max(READ_MIN_MS, READ_MS_PER_CHAR * text.length) / speedRef.current)
      }
    } finally {
      loopActive.current = false
    }
    playingRef.current = false
    if (mounted.current) setPlaying(false)
  }
  const narrationRef = useRef(narration)
  narrationRef.current = narration
  const pause = () => {
    playingRef.current = false
    setPlaying(false)
  }
  const next = () => !stepping.current && void runOne()
  const prev = async () => {
    if (stepping.current) return
    pause()
    stepping.current = true
    setBusy(true)
    try {
      await runner.current!.prev()
    } finally {
      stepping.current = false
      setBusy(false)
    }
  }

  // Rings : suivent leur cible (défilement, mise en page) à chaque image
  const ringEls = useRef(new Map<number, HTMLDivElement>())
  useEffect(() => {
    if (!rings.length) return
    let raf = 0
    const loop = () => {
      for (const r of rings) {
        const d = ringEls.current.get(r.id)
        if (!d) continue
        const b = r.el.getBoundingClientRect()
        d.style.transform = `translate(${b.left - 6}px, ${b.top - 6}px)`
        d.style.width = `${b.width + 12}px`
        d.style.height = `${b.height + 12}px`
        d.dataset.visible = b.bottom > 0 && b.top < window.innerHeight && b.right > 0 && b.left < window.innerWidth ? '1' : '0'
      }
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [rings])

  // Toucher l'interface met la démo en pause ; clavier : Espace, ←, →, Échap
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (playingRef.current && root.current && !root.current.contains(e.target as Node)) {
        pause()
        setPaused(true)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (e.key === ' ') {
        e.preventDefault()
        if (playingRef.current) pause()
        else void play()
      } else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') void prev()
      else if (e.key === 'Escape') onQuit()
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  })

  // Lecture automatique au démarrage
  useEffect(() => {
    mounted.current = true
    void play()
    return () => {
      mounted.current = false
      playingRef.current = false
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const total = script.steps.length
  const speechOk = typeof window !== 'undefined' && 'speechSynthesis' in window

  return (
    <div ref={root} className="demo-root" data-demo-overlay>
      <style>{DEMO_CSS}</style>
      {/* Pointeur fantôme */}
      <div
        className={`demo-pointer ${pointer.on ? 'is-on' : ''} ${pointer.turning ? 'is-turning' : ''}`}
        style={{ transform: `translate(${pointer.x - 6}px, ${pointer.y - 4}px)` }}
        aria-hidden="true"
        data-click={pointer.click}
      >
        <svg width="34" height="38" viewBox="0 0 34 38">
          <path d="M8 2 L8 26 L13 21 L17 31 L21 29 L17 19 L24 19 Z" fill="#fff" stroke="#111" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        <span key={pointer.click} className="demo-click" />
      </div>
      {/* Entourages */}
      {rings.map((r) => (
        <div
          key={r.id}
          ref={(d) => {
            if (d) ringEls.current.set(r.id, d)
            else ringEls.current.delete(r.id)
          }}
          className="demo-ring"
          data-demo-ring={r.label}
          data-shown={r.shown ? '1' : '0'}
          aria-hidden="true"
        >
          <span className="demo-bubble">{r.label}</span>
        </div>
      ))}

      {paused && (
        <div className="demo-paused" role="status">
          Démo en pause —{' '}
          <button
            type="button"
            className="underline"
            onClick={() => {
              setPaused(false)
              void play()
            }}
          >
            Reprendre
          </button>
        </div>
      )}

      {/* Narration et commandes */}
      <div ref={sheet} className="demo-sheet" role="region" aria-label="Démonstration">
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-muted">
          <span>{script.title.toUpperCase()}</span>
          <span className="ml-auto tabular-nums">
            {index}/{total}
          </span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-card-2" aria-hidden="true">
          <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(index / total) * 100}%` }} />
        </div>
        <p className="mt-2 text-xs font-semibold text-accent">{phase}</p>
        <p className="mt-0.5 text-sm leading-relaxed" aria-live="polite" data-testid="demo-narration">
          {narration}
        </p>
        {calc && (
          <div className="demo-calc mt-2 rounded-xl p-3 font-mono text-[13px]" aria-live="polite">
            <p>{calc.card.formula}</p>
            {calc.stage >= 2 && <p className="mt-1 text-muted">= {calc.card.subst}</p>}
            {calc.stage >= 3 && (
              <p className="mt-1">
                = <span className="demo-result rounded-md px-1.5 py-0.5 font-semibold">{calc.card.result}</span>
              </p>
            )}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Commandes de la démonstration">
          <button type="button" onClick={() => void prev()} disabled={busy || index <= 1} className="demo-btn" aria-label="Étape précédente">
            ◀
          </button>
          {playing ? (
            <button type="button" onClick={pause} className="demo-btn is-primary" aria-label="Pause">
              ❚❚ Pause
            </button>
          ) : (
            <button type="button" onClick={() => void play()} disabled={runner.current?.done} className="demo-btn is-primary" aria-label="Lecture">
              ▶ Lecture
            </button>
          )}
          <button type="button" onClick={next} disabled={busy || runner.current?.done} className="demo-btn" aria-label="Étape suivante">
            ▶|
          </button>
          <div role="group" aria-label="Vitesse" className="ml-auto inline-flex overflow-hidden rounded-lg ring-1 ring-line">
            {SPEEDS.map((s) => (
              <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)} className={`min-h-11 px-2 text-xs ${speed === s ? 'bg-accent text-on-accent' : ''}`}>
                {String(s).replace('.', ',')}×
              </button>
            ))}
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <button type="button" onClick={() => setAuto(!auto)} aria-pressed={!auto} className="demo-btn">
            {auto ? 'Mode : automatique' : 'Mode : pas à pas'}
          </button>
          <button type="button" onClick={() => setVoice(!voice)} aria-pressed={voice} disabled={!speechOk} className="demo-btn">
            {voice ? 'Voix : oui' : 'Lire à voix haute'}
          </button>
          <button type="button" onClick={onQuit} className="demo-btn ml-auto">
            Quitter
          </button>
        </div>
      </div>
    </div>
  )
}


const DEMO_CSS = `
.demo-pointer { position: fixed; left: 0; top: 0; z-index: 80; pointer-events: none; opacity: 0; transition: transform 420ms cubic-bezier(.3,.7,.2,1), opacity 200ms; filter: drop-shadow(0 3px 4px rgba(0,0,0,.45)); }
.demo-pointer.is-on { opacity: 1; }
.demo-pointer.is-turning svg { animation: demo-turn 500ms ease-in-out infinite alternate; transform-origin: 8px 2px; }
@keyframes demo-turn { from { transform: rotate(-18deg); } to { transform: rotate(18deg); } }
.demo-click { position: absolute; left: 2px; top: -4px; width: 14px; height: 14px; border-radius: 9999px; border: 2px solid #f43f5e; animation: demo-click 420ms ease-out forwards; }
@keyframes demo-click { from { transform: scale(0.4); opacity: 1; } to { transform: scale(2.6); opacity: 0; } }
.demo-ring { position: fixed; left: 0; top: 0; z-index: 70; pointer-events: none; border-radius: 14px; box-shadow: 0 0 0 3px #f43f5e, 0 0 18px rgba(244,63,94,.55); animation: demo-pulse 1.2s ease-in-out infinite; }
@keyframes demo-pulse { 0%,100% { box-shadow: 0 0 0 3px #f43f5e, 0 0 10px rgba(244,63,94,.35); } 50% { box-shadow: 0 0 0 4px #f43f5e, 0 0 22px rgba(244,63,94,.7); } }
.demo-bubble { position: absolute; left: 0; top: -30px; white-space: nowrap; background: #f43f5e; color: #fff; font: 600 12px/1 system-ui, sans-serif; padding: 6px 8px; border-radius: 8px; }
.demo-bubble::after { content: ''; position: absolute; left: 14px; bottom: -5px; border: 5px solid transparent; border-top-color: #f43f5e; border-bottom: 0; }
.demo-sheet { position: fixed; z-index: 75; left: 12px; right: 12px; bottom: 12px; max-height: 46vh; overflow: auto; background: var(--color-card); border-radius: 20px; padding: 12px 14px; box-shadow: 0 0 0 1px var(--color-line), 0 20px 40px -18px rgba(0,0,0,.45); }
@media (min-width: 768px) { .demo-sheet { left: auto; width: 400px; right: 20px; bottom: 20px; max-height: 70vh; } }
.demo-calc { background: var(--color-card-2); box-shadow: inset 0 0 0 1px var(--color-line); }
.demo-result { background: color-mix(in srgb, #f43f5e 14%, transparent); box-shadow: 0 0 0 2px #f43f5e; }
.demo-btn { min-height: 44px; padding: 0 12px; border-radius: 10px; background: var(--color-card-2); box-shadow: 0 0 0 1px var(--color-line); font-size: 13px; }
.demo-btn.is-primary { background: var(--color-accent); color: var(--color-on-accent); }
.demo-btn:disabled { opacity: .4; }
.demo-btn:focus-visible { outline: 2px solid var(--color-link); outline-offset: 2px; }
.demo-paused { position: fixed; z-index: 76; top: 84px; left: 50%; transform: translateX(-50%); background: #1f2328; color: #f4f4f5; padding: 10px 16px; border-radius: 9999px; font-size: 14px; box-shadow: 0 10px 24px -12px rgba(0,0,0,.6); }
@media (prefers-reduced-motion: reduce) {
  .demo-pointer { transition: opacity 120ms; }
  .demo-pointer.is-turning svg, .demo-click { animation: none; }
  .demo-ring { animation: none; }
}
`
