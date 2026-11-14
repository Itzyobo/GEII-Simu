/**
 * Banc INFO3 : dessin du banc réel (curiosity-hpc.svg, tiré de curiosity_hpc_banc_info3.svg ; apparence = H16)
 * et, par-dessus, dans le même repère, tout ce qui bouge ou se manipule :
 * - LED D2 à D5 : lueur = rapport cyclique (variable CSS --duty) ; voyant d'alimentation de la carte fille ;
 * - S1, S2 : souris, toucher (maintien possible) ou touches 1 et 2 ;
 * - potentiomètre R1 (RA0) : glisser en cercle ou flèches ; joystick : glisser, flèches, clic ou Espace = bouton SW ;
 * - LED RGB : couleur = mélange des trois rapports cycliques (H17) ; clic = poser ou retirer le cache ;
 * - USB noir (PKOB) et USB blanc (USB UART click) : clic sur la prise pour brancher ou débrancher ;
 * - MODULE 1 et 2 (mikroBUS) : glisser une carte Click, ou la sélectionner puis cliquer l'emplacement ;
 * - ROTARY O click : anneau de 16 LED ; molette = glisser le bord, molette de la souris ou ← / → ; centre = bouton SW ;
 * - 8x8 R click : 64 LED.
 * Le verrouillage sous tension est décidé par le modèle du projet (setCard), pas ici.
 */
import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { INFO3 } from '../../data/reference'
import type { Bench, CardId, SlotId } from '../project/project'
import { cssColor, rgbDuty, rgbGlare, rgbIntensity, rgbMix } from '../models/rgbLed'
import art from './curiosity-hpc.svg?raw'
import artMatrix from './click-8x8.svg?raw'
import artRotary from './click-rotary.svg?raw'

/** Contenu d'un fichier SVG sans sa balise <svg> (tout est dessiné dans le repère de curiosity-hpc.svg) */
const inner = (svg: string) => svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'))
const ART = inner(art)
const CARD_ART: Record<CardId, string> = { matrix8x8: inner(artMatrix), rotary: inner(artRotary) }
const VIEWBOX = /viewBox="([^"]+)"/.exec(art)![1]

export type RotaryAction = { action: 'turn'; detents: number } | { action: 'sw'; pressed: boolean }

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
  /** ROTARY O click : fraction du temps allumée des LED 1 à 16 (LED 1 en haut, sens horaire, H10) */
  ring?: number[]
  onRotary?(m: RotaryAction): void
  /** Position (crans) et bouton SW, partagés avec le panneau ROTARY O click */
  knob?: number
  rotSw?: boolean
}

/** Repère du dessin (curiosity-hpc.svg) */
const POT = { cx: 713, cy: 1028, r: 24, hit: 36 }
const LED_X: Record<string, number> = { D2: 940, D3: 895, D4: 848, D5: 800 }
const LED_Y = 982
const BUTTON_XY: Record<string, [number, number]> = { S1: [872, 1064], S2: [1022, 1064] }
const BUTTON_HALF = 30
const RGB_LED = { cx: 522, cy: 565 }
const POWER_LED = { cx: 462, cy: 545 }
const JOY = { cx: 900, cy: 705, cap: 62, travel: 22, housing: 100, tap: 6 }
const USB_BLACK = { x: 1440, y: 560, w: 30, h: 40 }
const USB_WHITE = { x: 318, y: 715, w: 62, h: 52 }
const SLOT: Record<SlotId, { x: number; y: number }> = { mikrobus1: { x: 1141, y: 589 }, mikrobus2: { x: 1141, y: 814 } }
const SLOT_W = 250
const SLOT_H = 210
/** Étiquettes MODULE 1 / 2, à droite du bord de la carte (x = 1470) */
const SLOT_LABEL_X = 1500
const MATRIX = { x: 1169, y: 416, dx: 24.5, dy: 25.5 }
const RING = { cx: 1266, cy: 1166, r: 92, led: 16, knob: 52, cap: 34 }
const RING_LEDS = 16
const FULL_TURN = 360

/** Course du potentiomètre : 270°, de -135° (0) à +135° (1) */
const POT_SWEEP = 270
const POT_KEY_STEP = 0.05
const DEG_PER_DETENT = FULL_TURN / INFO3.rotary.detentsPerTurn
const RAD = Math.PI / 180

/** Coordonnées dans le repère du dessin d'un événement pointeur */
function svgPoint(e: PointerEvent<SVGGElement>): { x: number; y: number } {
  const svg = e.currentTarget.ownerSVGElement!
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse())
  return { x: p.x, y: p.y }
}
const clamp1 = (v: number) => Math.max(-1, Math.min(1, v))
const activate = (e: ReactKeyboardEvent, f: () => void) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    f()
  }
}

const KEYS: Record<string, string> = { '1': INFO3.pins.buttons[0].name, '2': INFO3.pins.buttons[1].name }
const CARD_IDS = Object.keys(INFO3.clickBoards) as CardId[]
const SLOT_LABEL: Record<SlotId, string> = { mikrobus1: 'MODULE 1', mikrobus2: 'MODULE 2' }
const DRAG_TYPE = 'application/x-info3-card'

/** Lueur des LED : --duty (0 à 1) fixé à chaque image ; contour des zones cliquables au survol et au clavier */
const BOARD_CSS = `.info3-board [tabindex]{outline:none}.info3-board [tabindex]:focus-visible .info3-hl,.info3-board .info3-hit:hover .info3-hl{opacity:1}.info3-hl{opacity:0;transition:opacity 120ms}.info3-led-on{opacity:var(--duty);transition:opacity 40ms linear}.info3-led-glow{opacity:calc(var(--duty) * .85);transition:opacity 40ms linear}`

const isEditable = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || !!t.closest('.cm-editor'))

/** Contour jaune d'une zone cliquable (survol, focus clavier, emplacement visé) */
const Hl = ({ x, y, w, h, rx = 6, on }: { x: number; y: number; w: number; h: number; rx?: number; on?: boolean }) => (
  <rect className="info3-hl" x={x} y={y} width={w} height={h} rx={rx} fill="none" stroke="#ffd600" strokeWidth={4} style={on ? { opacity: 1 } : undefined} />
)

export default function Board({ duty, bench, onButton, onUsbBlack, onUsbWhite, onCover, onCard, message, analog, onAnalog, matrix = [], ring = [], onRotary, knob = 0, rotSw = false }: BoardProps) {
  const pot = analog?.pot ?? 0.5
  const [jx, jy] = analog?.joy ?? [0, 0]
  const rgb = rgbDuty(duty)
  const rgbOn = rgbIntensity(rgb) > 0
  const rgbColor = cssColor(rgbMix(rgb))
  const glare = rgbGlare(rgb, bench.cover)
  const [held, setHeld] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<CardId | null>(null)
  const [over, setOver] = useState<SlotId | null>(null)
  const [joySw, setJoySw] = useState(false)
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

  /* ── Potentiomètre ── */
  const potDrag = (e: PointerEvent<SVGGElement>) => {
    if (!onAnalog || (e.type === 'pointermove' && !e.buttons)) return
    const p = svgPoint(e)
    const deg = Math.atan2(p.x - POT.cx, POT.cy - p.y) / RAD
    onAnalog({ pot: Math.min(1, Math.max(0, deg / POT_SWEEP + 0.5)) })
  }

  /* ── Joystick : glisser = déplacer ; appui sans déplacement = bouton SW ── */
  const joyStart = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const joySet = (sw: boolean) => {
    setJoySw(sw)
    onAnalog?.({ joySw: sw })
  }
  const joyDown = (e: PointerEvent<SVGGElement>) => {
    if (!onAnalog) return
    e.currentTarget.setPointerCapture(e.pointerId)
    joyStart.current = { ...svgPoint(e), moved: false }
    joySet(true)
  }
  const joyMove = (e: PointerEvent<SVGGElement>) => {
    const s = joyStart.current
    if (!s || !onAnalog) return
    const p = svgPoint(e)
    if (!s.moved && Math.hypot(p.x - s.x, p.y - s.y) < JOY.tap) return
    if (!s.moved) {
      s.moved = true
      joySet(false)
    }
    onAnalog({ joy: [clamp1((p.x - s.x) / JOY.travel / 2), clamp1((s.y - p.y) / JOY.travel / 2)] })
  }
  const joyUp = () => {
    const s = joyStart.current
    joyStart.current = null
    if (!s) return
    if (s.moved) onAnalog?.({ joy: [0, 0] })
    else joySet(false)
  }
  const JOY_KEYS: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }
  const joyKey = (e: ReactKeyboardEvent<SVGGElement>, down: boolean) => {
    if (!onAnalog) return
    if (JOY_KEYS[e.key]) {
      e.preventDefault()
      onAnalog({ joy: down ? JOY_KEYS[e.key] : [0, 0] })
    } else if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault()
      joySet(down)
    }
  }

  /* ── Cartes Click ── */
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

  /* ── ROTARY O click ── */
  const turn = (n: number) => {
    if (!n || !onRotary) return
    onRotary({ action: 'turn', detents: n })
  }
  const rotSet = (pressed: boolean) => {
    onRotary?.({ action: 'sw', pressed })
  }
  const knobRef = useRef<SVGGElement | null>(null)
  const turnRef = useRef(turn)
  useEffect(() => {
    turnRef.current = turn
  })
  const rotarySlot = (Object.keys(bench.slots) as SlotId[]).find((s) => bench.slots[s] === 'rotary')
  // Molette de la souris : écouteur non passif pour ne pas faire défiler la page
  useEffect(() => {
    const el = knobRef.current
    if (!el) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      turnRef.current(e.deltaY > 0 ? 1 : -1)
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [rotarySlot])
  const knobDrag = useRef<{ angle: number; acc: number } | null>(null)
  const knobAngle = (e: PointerEvent<SVGGElement>, cy: number) => {
    const p = svgPoint(e)
    return Math.atan2(p.x - RING.cx, cy - p.y) / RAD
  }

  const ledStyle = (d: number): CSSProperties => ({ ['--duty' as string]: String(d) })

  const button = (name: string) => {
    const [x, y] = BUTTON_XY[name]
    return (
      <g
        key={name}
        role="button"
        tabIndex={0}
        aria-label={`Bouton ${name} (touche ${name === KEYS['1'] ? 1 : 2})`}
        aria-pressed={!!held[name]}
        className="info3-hit cursor-pointer touch-none select-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          press(name)
        }}
        onPointerUp={() => release(name)}
        onPointerCancel={() => release(name)}
        onKeyDown={(e) => !e.repeat && activate(e, () => press(name))}
        onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && release(name)}
      >
        <rect x={x - BUTTON_HALF} y={y - BUTTON_HALF} width={BUTTON_HALF * 2} height={BUTTON_HALF * 2} rx={4} fill={held[name] ? '#bfc3c7' : 'transparent'} />
        <circle cx={x} cy={y} r={held[name] ? 14 : 17} fill={held[name] ? '#7f2424' : '#B23A3A'} />
        <Hl x={x - BUTTON_HALF} y={y - BUTTON_HALF} w={BUTTON_HALF * 2} h={BUTTON_HALF * 2} />
      </g>
    )
  }

  const card = (slot: SlotId, id: CardId): ReactNode => {
    const dy = SLOT[slot].y - SLOT[INFO3.clickBoards[id].expectedSlot as SlotId].y
    return (
      <g transform={`translate(0 ${dy})`}>
        <g pointerEvents="none" dangerouslySetInnerHTML={{ __html: CARD_ART[id] }} />
        {id === 'matrix8x8' ? (
          <g pointerEvents="none" aria-label="Matrice 8x8 R click">
            {Array.from({ length: 64 }, (_, i) => {
              // Lueur : rapport cyclique de la LED rapporté au plus fort possible (1/8 : 8 digits balayés), plafonné à 1
              const g = Math.min(1, (matrix[i] ?? 0) * 8)
              const x = MATRIX.x + (i % 8) * MATRIX.dx
              const y = MATRIX.y + Math.floor(i / 8) * MATRIX.dy
              return (
                <g key={i} className="info3-mx-led" data-on={g > 0 ? '1' : '0'}>
                  <rect x={x + 2} y={y + 2} width={15} height={19} rx={2} fill="#F1E9E2" stroke="#B8AFA6" />
                  {g > 0 && <rect x={x - 2} y={y + 1} width={23} height={21} rx={6} fill="#ff3b30" opacity={0.35 * g} />}
                  <rect x={x + 5} y={y + 7} width={9} height={9} fill={g > 0 ? '#ff3b30' : '#E7C9C0'} fillOpacity={g > 0 ? 0.4 + 0.6 * g : 1} />
                </g>
              )
            })}
          </g>
        ) : (
          rotary(dy)
        )}
      </g>
    )
  }

  const rotary = (dy: number) => {
    const cy = RING.cy
    return (
      <>
        {Array.from({ length: RING_LEDS }, (_, i) => {
          const a = (FULL_TURN / RING_LEDS) * i
          const d = Math.min(1, Math.max(0, ring[i] ?? 0))
          const x = RING.cx + RING.r * Math.sin(a * RAD)
          const y = cy - RING.r * Math.cos(a * RAD)
          return (
            <g key={i} className="info3-ring-led" data-on={d > 0.5 ? '1' : '0'} aria-label={`LED ${i + 1} de l’anneau`} pointerEvents="none">
              {d > 0 && <circle cx={x} cy={y} r={20} fill="#ffb020" opacity={0.45 * d} />}
              <rect x={x - 8} y={y - 8} width={16} height={16} rx={2} transform={`rotate(${a} ${x} ${y})`} fill={d > 0 ? '#ffb020' : '#EFE8E0'} fillOpacity={d > 0 ? 0.4 + 0.6 * d : 1} stroke="#B8AFA6" strokeWidth={1} />
            </g>
          )
        })}
        <g
          ref={knobRef}
          role="slider"
          tabIndex={0}
          aria-label={`Molette ROTARY O click : ${knob} crans — glisser le bord, molette ou ← / → ; centre, Entrée ou Espace = bouton SW${rotSw ? ' (appuyé)' : ''}`}
          aria-valuenow={knob}
          className="info3-hit cursor-grab touch-none"
          onPointerDown={(e) => {
            if (!onRotary) return
            e.currentTarget.setPointerCapture(e.pointerId)
            const p = svgPoint(e)
            if (Math.hypot(p.x - RING.cx, p.y - (cy + dy)) < RING.cap) rotSet(true)
            else knobDrag.current = { angle: knobAngle(e, cy + dy), acc: 0 }
          }}
          onPointerMove={(e) => {
            const k = knobDrag.current
            if (!k) return
            const a = knobAngle(e, cy + dy)
            k.acc += ((a - k.angle + FULL_TURN * 1.5) % FULL_TURN) - FULL_TURN / 2
            k.angle = a
            const n = Math.trunc(k.acc / DEG_PER_DETENT)
            if (n) {
              k.acc -= n * DEG_PER_DETENT
              turn(n)
            }
          }}
          onPointerUp={() => {
            knobDrag.current = null
            if (rotSw) rotSet(false)
          }}
          onPointerCancel={() => {
            knobDrag.current = null
            if (rotSw) rotSet(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') (e.preventDefault(), turn(1))
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') (e.preventDefault(), turn(-1))
            else if (!e.repeat) activate(e, () => rotSet(true))
          }}
          onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && rotSet(false)}
        >
          <circle cx={RING.cx} cy={cy} r={RING.knob} fill="#9DA3A8" stroke="#6E747A" strokeWidth={3} />
          <circle cx={RING.cx} cy={cy} r={rotSw ? RING.cap - 3 : RING.cap} fill={rotSw ? '#aeb2b6' : '#C8CCD0'} />
          <path d={`M${RING.cx - 14} ${cy} h28 M${RING.cx} ${cy - 14} v28 M${RING.cx} ${cy - RING.knob + 4} v12`} stroke="#6E747A" strokeWidth={5} transform={`rotate(${knob * DEG_PER_DETENT} ${RING.cx} ${cy})`} />
          <circle className="info3-hl" cx={RING.cx} cy={cy} r={RING.knob + 4} fill="none" stroke="#ffd600" strokeWidth={4} />
        </g>
      </>
    )
  }

  /** Câble USB branché : sous le dessin des cartes */
  const cable = (kind: 'black' | 'white') => {
    const c = kind === 'black' ? USB_BLACK : USB_WHITE
    if (!(kind === 'black' ? powered : bench.usbWhite)) return null
    return (
      <g pointerEvents="none">
        {kind === 'black' ? (
            <path d={`M${c.x + c.w} ${c.y + c.h / 2} C 1530 578 1580 560 1640 520`} fill="none" stroke="#1c1f22" strokeWidth={24} strokeLinecap="round" />
          ) : (
            <>
              <path d={`M${c.x} ${c.y + c.h / 2} C 280 741 230 728 150 745`} fill="none" stroke="#9aa0a6" strokeWidth={28} strokeLinecap="round" />
              <path d={`M${c.x} ${c.y + c.h / 2} C 280 741 230 728 150 745`} fill="none" stroke="#f4f4f4" strokeWidth={22} strokeLinecap="round" />
            </>
          )}
      </g>
    )
  }
  /** Prise USB : zone cliquable au-dessus du dessin */
  const usb = (kind: 'black' | 'white') => {
    const c = kind === 'black' ? USB_BLACK : USB_WHITE
    const plugged = kind === 'black' ? powered : bench.usbWhite
    const toggle = () => (kind === 'black' ? onUsbBlack : onUsbWhite)(!plugged)
    const label = kind === 'black' ? 'USB noir (PKOB)' : 'USB blanc (USB UART click)'
    return (
      <g role="button" tabIndex={0} aria-label={`${label} : ${plugged ? 'branché, cliquer pour débrancher' : 'débranché, cliquer pour brancher'}`} aria-pressed={plugged} className="info3-hit cursor-pointer" onClick={toggle} onKeyDown={(e) => activate(e, toggle)}>
        <rect x={c.x - 10} y={c.y - 10} width={c.w + 20} height={c.h + 20} fill="transparent" />
        <Hl x={c.x - 6} y={c.y - 6} w={c.w + 12} h={c.h + 12} rx={4} />
      </g>
    )
  }

  const mikrobus = (slot: SlotId) => {
    const placed = bench.slots[slot]
    const { x, y } = SLOT[slot]
    return (
      <g
        key={slot}
        role="button"
        tabIndex={0}
        aria-label={`${SLOT_LABEL[slot]} : ${placed ? `${INFO3.clickBoards[placed].name} (cliquer pour retirer)` : selected ? `enficher ${INFO3.clickBoards[selected].name}` : 'vide'}`}
        className="info3-hit cursor-pointer"
        onClick={() => slotClick(slot)}
        onKeyDown={(e) => activate(e, () => slotClick(slot))}
        onDragOver={dragOver(slot)}
        onDragLeave={() => setOver(null)}
        onDrop={drop(slot)}
      >
        <rect x={x} y={y} width={SLOT_W} height={SLOT_H} rx={18} fill={over === slot ? 'rgba(255,214,0,.18)' : 'transparent'} />
        <Hl x={x - 4} y={y - 4} w={SLOT_W + 8} h={SLOT_H + 8} rx={20} on={over === slot || (!!selected && !placed)} />
        {/* Nom de l'emplacement : hors de la carte, visible même carte enfichée */}
        <text x={SLOT_LABEL_X} y={y + SLOT_H / 2} textAnchor="middle" fontSize={26} fontWeight={700} letterSpacing={2} fill="var(--color-ink)" transform={`rotate(90 ${SLOT_LABEL_X} ${y + SLOT_H / 2})`}>
          {SLOT_LABEL[slot]}
        </text>
      </g>
    )
  }

  return (
    <div className="space-y-2">
      <style>{BOARD_CSS}</style>
      <svg viewBox={VIEWBOX} className="info3-board block w-full max-w-full rounded-card bg-card-2 ring-1 ring-line" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }} role="group" aria-label="Banc Curiosity HPC et carte fille GEII">
        <defs>
          <filter id="ledGlow" x="-1" y="-1" width="3" height="3">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>
        {cable('black')}
        {cable('white')}
        <g dangerouslySetInnerHTML={{ __html: ART }} />
        {usb('black')}
        {usb('white')}

        {/* Voyant d'alimentation de la carte fille */}
        <circle cx={POWER_LED.cx} cy={POWER_LED.cy} r={9} fill={powered ? '#ff5a4f' : '#5A1015'} aria-label={powered ? 'Carte alimentée' : 'Carte non alimentée'} />
        {powered && <circle cx={POWER_LED.cx} cy={POWER_LED.cy} r={16} fill="#ff3b30" opacity={0.6} filter="url(#ledGlow)" />}

        {/* LED D2 à D5 */}
        {INFO3.pins.leds.map((l) => {
          const d = duty[l.name] ?? 0
          const x = LED_X[l.name]
          return (
            <g key={l.name} style={ledStyle(d)} className="info3-led" data-on={d > 0.5 ? '1' : '0'} aria-label={`LED ${l.name} (${l.pin})`}>
              <circle cx={x} cy={LED_Y} r={13} fill="#6a1612" stroke="#3a0b09" strokeWidth={2} />
              <circle cx={x} cy={LED_Y} r={24} fill="#ff3b30" filter="url(#ledGlow)" className="info3-led-glow" />
              <circle cx={x} cy={LED_Y} r={13} fill="#ff5a4f" className="info3-led-on" />
            </g>
          )
        })}

        {/* Potentiomètre R1 */}
        <g
          role="slider"
          tabIndex={0}
          aria-label={`Potentiomètre R1 (${INFO3.pins.pot.pin}) : glisser en cercle ou flèches`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pot * 100)}
          className="info3-hit cursor-grab touch-none"
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
          <circle cx={POT.cx} cy={POT.cy} r={POT.hit} fill="transparent" />
          <path d={`M${POT.cx} ${POT.cy + POT.r - 6} V${POT.cy - POT.r + 6}`} stroke="#333" strokeWidth={5} strokeLinecap="round" transform={`rotate(${(pot - 0.5) * POT_SWEEP} ${POT.cx} ${POT.cy})`} />
          <circle className="info3-hl" cx={POT.cx} cy={POT.cy} r={POT.hit} fill="none" stroke="#ffd600" strokeWidth={4} />
        </g>

        {button(INFO3.pins.buttons[0].name)}
        {button(INFO3.pins.buttons[1].name)}

        {/* LED RGB (clic = cache) */}
        <g
          role={onCover ? 'button' : undefined}
          tabIndex={onCover ? 0 : undefined}
          aria-label={`LED RGB (${rgbOn ? `R ${Math.round(rgb.r * 100)} %, G ${Math.round(rgb.g * 100)} %, B ${Math.round(rgb.b * 100)} %` : 'éteinte'})${onCover ? ` : cache ${bench.cover ? 'posé, cliquer pour le retirer' : 'retiré, cliquer pour le poser'}` : ''}`}
          aria-pressed={onCover ? bench.cover : undefined}
          data-rgb={rgbColor}
          className={onCover ? 'info3-hit cursor-pointer' : undefined}
          onClick={() => onCover?.(!bench.cover)}
          onKeyDown={(e) => onCover && activate(e, () => onCover(!bench.cover))}
        >
          {glare > 0 && <circle cx={RGB_LED.cx} cy={RGB_LED.cy} r={90} fill={rgbColor} opacity={0.55 * glare} style={{ filter: 'blur(14px)' }} />}
          {rgbOn && <circle cx={RGB_LED.cx} cy={RGB_LED.cy} r={22} fill={rgbColor} opacity={0.7} filter="url(#ledGlow)" />}
          <circle cx={RGB_LED.cx} cy={RGB_LED.cy} r={9} fill={rgbOn ? rgbColor : '#E8E1F0'} />
          {bench.cover && <circle cx={RGB_LED.cx} cy={RGB_LED.cy} r={24} fill="#eceff1" stroke="#9aa0a6" strokeWidth={2} opacity={rgbOn ? 0.75 : 0.95} />}
          <Hl x={RGB_LED.cx - 28} y={RGB_LED.cy - 28} w={56} h={56} rx={8} />
        </g>

        {/* Joystick */}
        <g
          role="slider"
          tabIndex={0}
          aria-label={`Joystick (${INFO3.pins.joystick.horz}, ${INFO3.pins.joystick.vert}) : x = ${jx.toFixed(2)}, y = ${jy.toFixed(2)} — glisser, flèches ; clic, Entrée ou Espace = bouton (${INFO3.pins.joystick.sw})${joySw ? ' appuyé' : ''}`}
          aria-valuenow={Math.round(jx * 100)}
          className="info3-hit cursor-grab touch-none"
          onPointerDown={joyDown}
          onPointerMove={joyMove}
          onPointerUp={joyUp}
          onPointerCancel={joyUp}
          onKeyDown={(e) => joyKey(e, true)}
          onKeyUp={(e) => joyKey(e, false)}
        >
          <circle cx={JOY.cx} cy={JOY.cy} r={JOY.housing} fill="transparent" />
          <circle cx={JOY.cx + jx * JOY.travel} cy={JOY.cy - jy * JOY.travel} r={joySw ? JOY.cap - 4 : JOY.cap} fill={joySw ? '#141414' : '#1C1C1C'} stroke="#333" strokeWidth={2} />
          <circle cx={JOY.cx + jx * JOY.travel - 14} cy={JOY.cy - jy * JOY.travel - 16} r={20} fill="#ffffff" opacity={0.05} />
          <circle className="info3-hl" cx={JOY.cx} cy={JOY.cy} r={JOY.housing + 4} fill="none" stroke="#ffd600" strokeWidth={4} />
        </g>

        {/* mikroBUS et cartes Click */}
        {mikrobus('mikrobus1')}
        {mikrobus('mikrobus2')}
        {(Object.keys(SLOT) as SlotId[]).map((s) => {
          const id = bench.slots[s]
          return id ? <g key={s}>{card(s, id)}</g> : null
        })}

        <text x={180} y={1320} textAnchor="start" fontSize={20} fill="var(--color-muted)">
          Apparence approchée (H16)
        </text>
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
