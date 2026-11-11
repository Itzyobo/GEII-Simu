/**
 * Banc INFO3 : Curiosity HPC vue de dessus et carte fille GEII, en un seul SVG en ligne (apparence = H16).
 * - LED D2 à D5 : lueur = rapport cyclique (variable CSS --duty), animée en CSS ;
 * - S1, S2 : souris, toucher (maintien possible) ou touches 1 et 2 ;
 * - USB noir (PKOB : alimentation et programmation) et USB blanc (UART de la carte fille) : clic pour brancher ;
 * - LED RGB : couleur = mélange des trois rapports cycliques (H17) ; sans le cache, halo d'éblouissement ;
 * - MODULE 1 et 2 (mikroBUS) : glisser une carte Click, ou la sélectionner puis cliquer l'emplacement.
 * Le verrouillage sous tension est décidé par le modèle du projet (setCard), pas ici.
 */
import { useEffect, useState, type CSSProperties, type DragEvent, type PointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { INFO3 } from '../../data/reference'
import type { Bench, CardId, SlotId } from '../project/project'
import { cssColor, rgbDuty, rgbGlare, rgbIntensity, rgbMix } from '../models/rgbLed'

export interface BoardProps {
  duty: Record<string, number>
  bench: Bench
  onButton(name: string, action: 'press' | 'release'): void
  onUsbBlack(plugged: boolean): void
  onUsbWhite(plugged: boolean): void
  /** Cache en plastique sur la LED RGB (manipulable sous tension : pièce mécanique) */
  onCover?(on: boolean): void
  onCard(slot: SlotId, card: CardId | null): void
  /** Message du banc (verrouillage, programmation…) */
  message: string | null
  /** Potentiomètre (0 à 1) et joystick (x vers la droite, y vers le haut, -1 à 1) */
  analog?: { pot: number; joy: [number, number] }
  /** Matrice 8x8 R click : lueur des 64 LED (ligne 0 en haut) */
  matrix?: number[]
  onAnalog?(m: { pot?: number; joy?: [number, number]; joySw?: boolean }): void
}

/** Course du potentiomètre : 270°, de -135° (0) à +135° (1) */
const POT_SWEEP = 270
const POT_KEY_STEP = 0.05
const JOY = { cx: 490, cy: 190, r: 22 }

/** Coordonnées SVG d'un événement pointeur */
function svgPoint(e: PointerEvent<SVGGElement>): { x: number; y: number } {
  const svg = e.currentTarget.ownerSVGElement!
  const m = svg.getScreenCTM()!.inverse()
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m)
  return { x: p.x, y: p.y }
}
const clamp1 = (v: number) => Math.max(-1, Math.min(1, v))

const KEYS: Record<string, string> = { '1': INFO3.pins.buttons[0].name, '2': INFO3.pins.buttons[1].name }
const CARD_IDS = Object.keys(INFO3.clickBoards) as CardId[]
const SLOT_LABEL: Record<SlotId, string> = { mikrobus1: 'MODULE 1', mikrobus2: 'MODULE 2' }
const DRAG_TYPE = 'application/x-info3-card'

/** Lueur des LED : --duty (0 à 1) fixé à chaque image, transition courte pour une animation fluide */
const BOARD_CSS = `.info3-board [tabindex]:focus-visible{outline:2px solid #ffd600;outline-offset:2px}.info3-led-on{opacity:var(--duty);transition:opacity 40ms linear}.info3-led-glow{opacity:calc(var(--duty) * .85);transition:opacity 40ms linear}`

const isEditable = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || !!t.closest('.cm-editor'))

export default function Board({ duty, bench, onButton, onUsbBlack, onUsbWhite, onCover, onCard, message, analog, onAnalog, matrix = [] }: BoardProps) {
  const pot = analog?.pot ?? 0.5
  const [jx, jy] = analog?.joy ?? [0, 0]
  const potAngle = (pot - 0.5) * POT_SWEEP
  const potDrag = (e: PointerEvent<SVGGElement>) => {
    if (!onAnalog || (e.type === 'pointermove' && !e.buttons)) return
    const p = svgPoint(e)
    const deg = (Math.atan2(p.x - 395, 112 - p.y) * 180) / Math.PI
    onAnalog({ pot: Math.min(1, Math.max(0, deg / POT_SWEEP + 0.5)) })
  }
  const joyDrag = (e: PointerEvent<SVGGElement>) => {
    if (!onAnalog || (e.type === 'pointermove' && !e.buttons)) return
    const p = svgPoint(e)
    onAnalog({ joy: [clamp1((p.x - JOY.cx) / JOY.r), clamp1((JOY.cy - p.y) / JOY.r)] })
  }
  const JOY_KEYS: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }
  const joyKey = (e: ReactKeyboardEvent<SVGGElement>, down: boolean) => {
    if (!onAnalog) return
    if (JOY_KEYS[e.key]) {
      e.preventDefault()
      onAnalog({ joy: down ? JOY_KEYS[e.key] : [0, 0] })
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      onAnalog({ joySw: down })
    }
  }
  const rgb = rgbDuty(duty)
  const rgbOn = rgbIntensity(rgb) > 0
  const rgbColor = cssColor(rgbMix(rgb))
  const glare = rgbGlare(rgb, bench.cover)
  const [held, setHeld] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<CardId | null>(null)
  const [over, setOver] = useState<SlotId | null>(null)
  const powered = bench.usbBlack

  const press = (name: string) => {
    setHeld((h) => (h[name] ? h : { ...h, [name]: true }))
    onButton(name, 'press')
  }
  const release = (name: string) => {
    setHeld((h) => (h[name] ? { ...h, [name]: false } : h))
    onButton(name, 'release')
  }

  // Touches 1 et 2 : appui tant que la touche est enfoncée (hors éditeur et champs de saisie)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const name = KEYS[e.key]
      if (!name || e.repeat || isEditable(e.target) || e.ctrlKey || e.altKey || e.metaKey) return
      e.preventDefault()
      press(name)
    }
    const up = (e: KeyboardEvent) => {
      const name = KEYS[e.key]
      if (name && !isEditable(e.target)) release(name)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  })

  const slotClick = (slot: SlotId) => {
    if (bench.slots[slot]) onCard(slot, null)
    else if (selected) {
      onCard(slot, selected)
      setSelected(null)
    }
  }
  const drop = (slot: SlotId) => (e: DragEvent) => {
    e.preventDefault()
    setOver(null)
    const card = e.dataTransfer.getData(DRAG_TYPE) as CardId
    if (card) onCard(slot, card)
  }
  const dragOver = (slot: SlotId) => (e: DragEvent) => {
    if (e.dataTransfer.types.includes(DRAG_TYPE)) {
      e.preventDefault()
      setOver(slot)
    }
  }

  const ledStyle = (d: number): CSSProperties => ({ ['--duty' as string]: String(d) })
  const button = (name: string, x: number, y: number) => (
    <g
      key={name}
      role="button"
      tabIndex={0}
      aria-label={`Bouton ${name} (touche ${name === KEYS['1'] ? 1 : 2})`}
      aria-pressed={!!held[name]}
      className="cursor-pointer touch-none select-none outline-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        press(name)
      }}
      onPointerUp={() => release(name)}
      onPointerCancel={() => release(name)}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault()
          press(name)
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') release(name)
      }}
    >
      <rect x={x - 13} y={y - 13} width={26} height={26} rx={3} fill="#d9dde0" stroke="#7d868c" />
      <circle cx={x} cy={y} r={held[name] ? 7.5 : 9} fill={held[name] ? '#2b2f33' : '#3d4348'} stroke="#15181a" />
      <text x={x} y={y + 25} textAnchor="middle" className="fill-[#f2f2f2] text-[10px] font-semibold">
        {name}
      </text>
    </g>
  )

  const mikrobus = (slot: SlotId, x: number, y: number) => {
    const card = bench.slots[slot]
    return (
      <g
        key={slot}
        role="button"
        tabIndex={0}
        aria-label={`${SLOT_LABEL[slot]} : ${card ? `${INFO3.clickBoards[card].name} (cliquer pour retirer)` : selected ? `enficher ${INFO3.clickBoards[selected].name}` : 'vide'}`}
        className="cursor-pointer outline-none"
        onClick={() => slotClick(slot)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            slotClick(slot)
          }
        }}
        onDragOver={dragOver(slot)}
        onDragLeave={() => setOver(null)}
        onDrop={drop(slot)}
      >
        <rect x={x} y={y} width={92} height={84} rx={4} fill={over === slot ? 'rgba(255,214,0,.18)' : 'rgba(0,0,0,.18)'} stroke={over === slot || (selected && !card) ? '#ffd600' : '#b9c3bd'} strokeDasharray={card ? undefined : '4 3'} />
        {/* Deux rangées de 8 contacts femelles */}
        {[0, 1].map((side) =>
          Array.from({ length: 8 }, (_, i) => <rect key={`${side}-${i}`} x={x + 6 + side * 72} y={y + 8 + i * 9} width={8} height={6} fill="#111" stroke="#555" strokeWidth={0.5} />),
        )}
        <text x={x + 46} y={y + 98} textAnchor="middle" className="fill-[#f2f2f2] text-[9px] font-semibold tracking-wide">
          {SLOT_LABEL[slot]}
        </text>
        {card && <ClickCard card={card} x={x + 4} y={y - 6} matrix={matrix} />}
      </g>
    )
  }

  return (
    <div className="space-y-2">
      <style>{BOARD_CSS}</style>
      <svg viewBox="0 0 560 360" className="info3-board block w-full max-w-full rounded-card bg-[#0f1411] ring-1 ring-line" role="group" aria-label="Banc Curiosity HPC et carte fille GEII">
        <defs>
          <filter id="ledGlow" x="-1" y="-1" width="3" height="3">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        {/* Carte Curiosity HPC */}
        <rect x={40} y={14} width={380} height={300} rx={10} fill="#1d5c42" stroke="#0e2f22" strokeWidth={2} />
        <text x={56} y={34} className="fill-[#e9f5ee] text-[11px] font-semibold">Curiosity HPC</text>
        {/* USB noir (PKOB) */}
        <g role="button" tabIndex={0} aria-label={`USB noir (PKOB) : ${powered ? 'branché, cliquer pour débrancher' : 'débranché, cliquer pour brancher'}`} className="cursor-pointer outline-none" onClick={() => onUsbBlack(!powered)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onUsbBlack(!powered))}>
          <rect x={44} y={142} width={30} height={26} rx={2} fill="#c9ced1" stroke="#7d868c" />
          <rect x={50} y={149} width={18} height={12} fill="#2d3135" />
          {powered && (
            <g aria-hidden="true">
              <path d="M44 155 H4" stroke="#6b7278" strokeWidth={11} strokeLinecap="round" />
              <path d="M44 155 H4" stroke="#1c1f22" strokeWidth={8} strokeLinecap="round" />
            </g>
          )}
          <text x={59} y={182} textAnchor="middle" className="fill-[#f2f2f2] text-[8px]">USB PKOB</text>
        </g>
        {/* D1 : alimentation */}
        <circle cx={96} cy={44} r={4.5} fill={powered ? '#4cff7a' : '#18361f'} />
        {powered && <circle cx={96} cy={44} r={7} fill="#4cff7a" opacity={0.6} filter="url(#ledGlow)" />}
        <text x={106} y={47} className="fill-[#e9f5ee] text-[8px]">D1 POWER</text>
        {/* J12 */}
        <g>
          {[0, 1, 2].map((i) => <rect key={i} x={378 + i * 9} y={60} width={6} height={6} fill="#d4af37" />)}
          <rect x={378} y={58} width={15} height={10} fill="#222" opacity={0.85} rx={1} />
          <text x={378} y={80} className="fill-[#e9f5ee] text-[8px]">J12</text>
        </g>
        {/* Support PIC 40 broches */}
        <rect x={170} y={60} width={72} height={190} rx={4} fill="#262a2d" stroke="#0b0d0e" />
        {Array.from({ length: 20 }, (_, i) => (
          <g key={i}>
            <rect x={164} y={66 + i * 9} width={6} height={4} fill="#c0c6ca" />
            <rect x={242} y={66 + i * 9} width={6} height={4} fill="#c0c6ca" />
          </g>
        ))}
        <circle cx={206} cy={68} r={4} fill="#3a3f43" />
        <text x={206} y={160} textAnchor="middle" transform="rotate(-90 206 160)" className="fill-[#cfd6da] text-[11px] font-semibold tracking-wider">
          PIC16F18875
        </text>
        {/* POT R1 */}
        <g
          role="slider"
          tabIndex={0}
          aria-label="Potentiomètre R1 (RA0) : glisser en cercle ou flèches"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pot * 100)}
          className="cursor-grab outline-none"
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            potDrag(e)
          }}
          onPointerMove={potDrag}
          onKeyDown={(e) => {
            const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? POT_KEY_STEP : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -POT_KEY_STEP : 0
            if (!d || !onAnalog) return
            e.preventDefault()
            onAnalog({ pot: Math.min(1, Math.max(0, pot + d)) })
          }}
        >
          <circle cx={395} cy={112} r={14} fill="#1b67c4" stroke="#0d3567" />
          <circle cx={395} cy={112} r={5} fill="#e8eef3" />
          <path d="M395 112 L395 101" stroke="#0d3567" strokeWidth={2} transform={`rotate(${potAngle} 395 112)`} />
          <text x={395} y={138} textAnchor="middle" className="fill-[#e9f5ee] text-[9px]">POT R1</text>
        </g>
        {/* LED D2 à D5 */}
        {INFO3.pins.leds.map((l, i) => {
          const d = duty[l.name] ?? 0
          const x = 284 + i * 30
          return (
            <g key={l.name} style={ledStyle(d)} className="info3-led" data-on={d > 0.5 ? '1' : '0'} aria-label={`LED ${l.name} (${l.pin})`}>
              <rect x={x - 6} y={150} width={12} height={8} rx={1.5} fill="#5a1410" />
              <circle cx={x} cy={154} r={10} fill="#ff3b30" filter="url(#ledGlow)" className="info3-led-glow" />
              <rect x={x - 6} y={150} width={12} height={8} rx={1.5} fill="#ff5a4f" className="info3-led-on" />
              <text x={x} y={174} textAnchor="middle" className="fill-[#e9f5ee] text-[9px] font-semibold">{l.name}</text>
            </g>
          )
        })}
        {/* S1 et S2 */}
        {button(INFO3.pins.buttons[0].name, 300, 216)}
        {button(INFO3.pins.buttons[1].name, 360, 216)}
        {/* mikroBUS */}
        {mikrobus('mikrobus1', 60, 196)}
        {/* MODULE 2 en haut à droite du support */}
        {mikrobus('mikrobus2', 266, 24)}

        {/* Carte fille GEII */}
        <rect x={430} y={60} width={120} height={254} rx={8} fill="#2c3e64" stroke="#141d31" strokeWidth={2} />
        <text x={442} y={80} className="fill-[#e9eefc] text-[10px] font-semibold">Carte GEII</text>
        <g aria-label={`LED RGB (${rgbOn ? `R ${Math.round(rgb.r * 100)} %, G ${Math.round(rgb.g * 100)} %, B ${Math.round(rgb.b * 100)} %` : 'éteinte'})`} data-rgb={rgbColor}>
          {glare > 0 && <circle cx={490} cy={118} r={46} fill={rgbColor} opacity={0.55 * glare} style={{ filter: 'blur(10px)' }} />}
          <circle cx={490} cy={118} r={11} fill={rgbOn ? rgbColor : '#3b3f46'} stroke="#111" />
          {bench.cover && <circle cx={490} cy={118} r={15} fill="#eceff1" opacity={rgbOn ? 0.6 : 0.85} />}
          <text x={490} y={142} textAnchor="middle" className="fill-[#e9eefc] text-[8px]">LED RGB</text>
        </g>
        <g
          role="slider"
          tabIndex={0}
          aria-label={`Joystick (RD5, RD6) : x = ${jx.toFixed(2)}, y = ${jy.toFixed(2)} — glisser, flèches, Espace = bouton`}
          aria-valuenow={Math.round(jx * 100)}
          className="cursor-grab outline-none"
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            joyDrag(e)
          }}
          onPointerMove={joyDrag}
          onPointerUp={() => onAnalog?.({ joy: [0, 0] })}
          onPointerCancel={() => onAnalog?.({ joy: [0, 0] })}
          onKeyDown={(e) => joyKey(e, true)}
          onKeyUp={(e) => joyKey(e, false)}
        >
          <circle cx={490} cy={190} r={22} fill="#1a1d22" stroke="#555" />
          <circle cx={490 + jx * 12} cy={190 - jy * 12} r={10} fill="#3a3f46" />
          <text x={490} y={225} textAnchor="middle" className="fill-[#e9eefc] text-[8px]">JOYSTICK</text>
        </g>
        <g role="button" tabIndex={0} aria-label={`USB blanc (UART) : ${bench.usbWhite ? 'branché' : 'débranché'}`} className="cursor-pointer outline-none" onClick={() => onUsbWhite(!bench.usbWhite)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onUsbWhite(!bench.usbWhite))}>
          <rect x={474} y={268} width={32} height={22} rx={2} fill="#c9ced1" stroke="#7d868c" />
          <rect x={481} y={274} width={18} height={10} fill="#2d3135" />
          {bench.usbWhite && <path d="M490 290 V352" stroke="#f4f4f4" strokeWidth={9} strokeLinecap="round" />}
          <text x={520} y={300} className="fill-[#e9eefc] text-[8px]">USB</text>
        </g>
        <text x={14} y={352} className="fill-[#8fa195] text-[9px]">Apparence approchée (H16)</text>
      </svg>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs text-muted">Cartes Click :</span>
        {CARD_IDS.map((c) => {
          const placed = (Object.keys(bench.slots) as SlotId[]).find((s) => bench.slots[s] === c)
          return (
            <button
              key={c}
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_TYPE, c)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onClick={() => setSelected((s) => (s === c ? null : c))}
              aria-pressed={selected === c}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ${selected === c ? 'bg-accent text-on-accent ring-accent' : 'bg-card ring-line hover:bg-card-2'}`}
            >
              {INFO3.clickBoards[c].name}
              {placed ? ` · ${SLOT_LABEL[placed]}` : ''}
            </button>
          )
        })}
        <label className="ml-auto flex items-center gap-1.5 text-xs">
          <input type="checkbox" className="size-6" checked={bench.usbBlack} onChange={(e) => onUsbBlack(e.target.checked)} /> USB noir
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" className="size-6" checked={bench.usbWhite} onChange={(e) => onUsbWhite(e.target.checked)} /> USB blanc
        </label>
        {onCover && (
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" className="size-6" checked={bench.cover} onChange={(e) => onCover(e.target.checked)} /> Cache LED RGB
          </label>
        )}
      </div>
      {selected && <p className="text-xs text-muted">Glisser la carte ou cliquer sur MODULE 1 ou MODULE 2 pour l’enficher.</p>}
      {message && (
        <p role="status" className="rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn ring-1 ring-warn/30">
          {message}
        </p>
      )}
    </div>
  )
}

/** Carte Click dessinée sur son emplacement */
function ClickCard({ card, x, y, matrix = [] }: { card: CardId; x: number; y: number; matrix?: number[] }) {
  const name = INFO3.clickBoards[card].name
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={84} height={92} rx={5} fill={card === 'rotary' ? '#2e6db4' : '#b51f2e'} stroke="#111" />
      {card === 'rotary' ? (
        <>
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * 2 * Math.PI
            return <circle key={i} cx={x + 42 + 26 * Math.sin(a)} cy={y + 44 - 26 * Math.cos(a)} r={2.6} fill="#3a1010" />
          })}
          <circle cx={x + 42} cy={y + 44} r={14} fill="#c8ccd0" stroke="#555" />
        </>
      ) : (
        Array.from({ length: 64 }, (_, i) => {
          // Lueur : rapport cyclique de la LED rapporté au plus fort possible (1/8 : 8 digits balayés), plafonné à 1
          const g = Math.min(1, (matrix[i] ?? 0) * 8)
          return <circle key={i} className="info3-mx-led" data-on={g > 0 ? '1' : '0'} cx={x + 14 + (i % 8) * 8} cy={y + 16 + Math.floor(i / 8) * 8} r={2.6} fill={g > 0 ? `rgba(255, ${Math.round(60 + 140 * g)}, ${Math.round(60 * g)}, ${0.35 + 0.65 * g})` : '#3a1010'} />
        })
      )}
      <text x={x + 42} y={y + 88} textAnchor="middle" className="fill-white text-[7px] font-semibold">
        {name}
      </text>
    </g>
  )
}
