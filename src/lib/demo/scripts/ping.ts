/**
 * Démonstration, partie 3 : ping Ethernet 10Base2. Réglages de la consigne, Single répété jusqu'à la requête,
 * durée aux curseurs, bourrage et MAC destination décodés sur la trace (bits au milieu des demi-bits).
 */
import { BIT, BYTE_US, type TimedFrame } from '../../reseaux/ethernet'
import { salleTraffic } from '../../reseaux/traffic'
import type { PartielSubject } from '../../reseaux/partiel'
import { crossings, valueAt, type CaptureInfo, type Zone } from '../lab'
import type { Ctx, DemoScript, Step } from '../types'
import { fr, frTime, need } from './common'

/** Niveau de décision entre −0,25 V (haut) et −1,75 V (bas) */
const MID = -1
/** Le déclenchement à −0,1 V tombe ≈ 1,4 ns après le début du front de 25 ns */
const TRIG_LAG = 1.4e-9
const BYTE = 8 * BIT
const FIELD_COLORS: Record<string, string> = {
  Préambule: '#94a3b8',
  SFD: '#f472b6',
  'MAC dest': '#38bdf8',
  'MAC src': '#818cf8',
  Type: '#fbbf24',
  IP: '#34d399',
  ICMP: '#a3e635',
  Données: '#fb923c',
  Bourrage: '#f87171',
  FCS: '#e879f9',
}

const traffics = new WeakMap<PartielSubject, ReturnType<typeof salleTraffic>>()
const trafficOf = (s: PartielSubject) => {
  let t = traffics.get(s)
  if (!t) {
    t = salleTraffic(s.seed, { kind: 'ping', L: s.ping.L, from: s.ping.from, to: s.ping.to }, true)
    traffics.set(s, t)
  }
  return t
}
/** Trame qui a déclenché l'acquisition */
const frameAt = (ctx: Ctx, c: CaptureInfo): TimedFrame | undefined => trafficOf(ctx.subject).framesIn(c.tTrig - 1e-6, c.tTrig + 1e-6).find((f) => Math.abs(f.t0 + TRIG_LAG - c.tTrig) < 50e-9)

/** Single jusqu'à capturer la requête du ping (les ARP et broadcasts sont ignorés) */
async function singleUntilPing(ctx: Ctx, show: boolean): Promise<CaptureInfo> {
  for (let k = 0; k < 12; k++) {
    const c = await ctx.single()
    if (!c) continue
    const f = frameAt(ctx, c)
    if (f?.label === 'ping requête') return c
    if (show && f) await ctx.mark({ from: c.tTrig, to: c.tTrig + 4e-6 }, `${f.label} : on relance Single`)
  }
  return need(ctx.capture)
}

/** Octets lus sur la trace à partir du début de trame t0 (bit = niveau de la 2e moitié : haut ⇒ 1) */
export function decodeBytes(c: CaptureInfo, t0: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => {
    let b = 0
    for (let k = 0; k < 8; k++) if (valueAt(c, 0, t0 + (8 * i + k + 0.75) * BIT) > MID) b |= 1 << k
    return b
  })
}

const t0Of = (c: CaptureInfo) => c.tTrig - TRIG_LAG
const hex = (b: number) => b.toString(16).toUpperCase().padStart(2, '0')

export function pingScript(): DemoScript {
  const steps: Step[] = [
    {
      id: 'salle',
      phase: 'Montage',
      narration: 'L’oscilloscope est déjà sur un Té du coax, bouchonné à 50 Ω aux deux bouts : on observe le trafic de la salle et le ping.',
      actions: [
        { type: 'tab', index: 2 },
        { type: 'highlight', target: { dom: 'brief-ping' }, label: 'Té sur CH1, bouchons 50 Ω' },
      ],
    },
    {
      id: 'reglages',
      phase: 'Réglages',
      narration: 'Réglages de la consigne : DC, 0,5 V/div, 0 V au centre, 2 µs/div, front descendant sur CH1 à −0,1 V, mode Normal.',
      actions: [
        { type: 'pressButton', button: 'defaultSetup' },
        { type: 'setChannel', ch: 0, patch: { coupling: 'DC' } },
        { type: 'turnKnob', knob: 'vdiv0', value: 0.5 },
        { type: 'turnKnob', knob: 'offset0', value: 0 },
        { type: 'turnKnob', knob: 'sdiv', value: 2e-6 },
        { type: 'setTrigger', patch: { source: 0, slope: 'descendant', mode: 'normal' } },
        { type: 'turnKnob', knob: 'level', value: -0.1 },
      ],
    },
    {
      id: 'capture',
      phase: 'Capture',
      narration: 'On attend les trames : Single, plusieurs fois s’il le faut, jusqu’à tenir la requête du ping (les ARP et broadcasts ne nous intéressent pas). La réponse du TSX suit 0,5 à 2 ms plus tard.',
      actions: [{ type: 'run', run: async (ctx) => void (await singleUntilPing(ctx, true)) }],
    },
    {
      id: 'duree',
      phase: 'Durée',
      narration: 'Base de temps assez lente pour voir toute la trame, déclenchement à 1 division du bord : X1 au début du préambule, X2 sur le dernier front. Une trame dure 0,8 µs par octet.',
      actions: [
        {
          type: 'run',
          run: async (ctx) => {
            for (const sdiv of [10e-6, 20e-6, 50e-6, 100e-6, 200e-6]) {
              await ctx.turn('sdiv', sdiv)
              await ctx.turn('delay', 4 * sdiv)
              const c = await singleUntilPing(ctx, false)
              // Fin de trame : retour à 0 V (franchissement montant de −0,1 V) avant le dernier quart d'écran
              const end = crossings(c, 0, -0.1, c.tTrig + 2e-6, c.rec[1] - 2 * sdiv).find((x) => x.dir === 1)
              if (end) {
                ctx.memo.tEnd = end.t
                break
              }
            }
            const c = need(ctx.capture)
            const last = crossings(c, 0, MID, c.tTrig, ctx.memo.tEnd as number, 0.05).at(-1)
            ctx.memo.x2 = (last?.t ?? (ctx.memo.tEnd as number)) - c.tTrig
          },
        },
        { type: 'moveCursor', cursor: 'x1', value: 0 },
        { type: 'moveCursor', cursor: 'x2', value: (ctx) => ctx.memo.x2 as number },
        { type: 'highlight', target: { dom: 'readout-dx' }, label: 'ΔX = durée de la trame' },
        { type: 'read', run: (ctx) => (ctx.memo.durationUs = ctx.lab.cursorReadout().dx * 1e6) },
        {
          type: 'calc',
          key: 'octets',
          formula: 'octets = T / 0,8 µs',
          subst: (ctx) => `${fr(ctx.memo.durationUs as number, 4)} / 0,8`,
          result: (ctx) => Math.round((ctx.memo.durationUs as number) / BYTE_US),
          unit: 'octets',
          digits: 5,
        },
      ],
    },
    {
      id: 'longueur',
      phase: 'Longueur du ping',
      narration: (ctx) =>
        (ctx.memo.octets as number) > 72
          ? 'Plus de 72 octets : pas de bourrage. On retire 54 octets d’en-têtes (8 préambule/SFD, 14 Ethernet, 20 IP, 8 ICMP, 4 FCS).'
          : 'Trame minimale de 72 octets : la charge a été complétée par du bourrage, il faut le mesurer.',
      actions: [
        {
          type: 'run',
          run: async (ctx) => {
            const octets = ctx.memo.octets as number
            if (octets > 72) {
              ctx.memo.padding = 0
              ctx.memo.L = octets - 54
            }
          },
        },
        {
          type: 'calc',
          key: 'L',
          formula: 'L = octets − 54 (si T > 57,6 µs)',
          subst: (ctx) => ((ctx.memo.octets as number) > 72 ? `${ctx.memo.octets} − 54` : 'trame minimale : voir le bourrage'),
          result: (ctx) => ((ctx.memo.octets as number) > 72 ? (ctx.memo.octets as number) - 54 : NaN),
          unit: 'octets',
          digits: 5,
        },
      ],
    },
    {
      id: 'bourrage',
      phase: 'Bourrage',
      narration: (ctx) =>
        (ctx.memo.octets as number) > 72
          ? 'Pas de bourrage ici : la charge dépasse déjà 46 octets.'
          : 'Zoom à 1 µs/div sur la fin de trame : avant les 4 octets du FCS, une zone régulière à 10 MHz, ce sont les octets 00h du bourrage. X1 et X2 dessus.',
      actions: [
        {
          type: 'run',
          run: async (ctx) => {
            if ((ctx.memo.octets as number) > 72) return
            const c = need(ctx.capture)
            const n = ctx.memo.octets as number
            const bytes = decodeBytes(c, t0Of(c), n)
            // Octets nuls juste avant le FCS (4 derniers octets)
            let pad = 0
            for (let i = n - 5; i >= 0 && bytes[i] === 0; i--) pad++
            const from = t0Of(c) + (n - 4 - pad) * BYTE
            const to = t0Of(c) + (n - 4) * BYTE
            await ctx.turn('sdiv', 1e-6)
            await ctx.turn('delay', (from + to) / 2 - c.tTrig)
            await ctx.mark({ from, to }, 'bourrage : 00h, carré à 10 MHz')
            ctx.lab.setCur({ on: true, x1: from - c.tTrig, x2: to - c.tTrig })
            ctx.memo.padding = Math.round((ctx.lab.cursorReadout().dx * 1e6) / BYTE_US)
            ctx.memo.L = 18 - (ctx.memo.padding as number)
          },
        },
        { type: 'highlight', target: { dom: 'readout-dx' }, label: 'ΔX = bourrage' },
        {
          type: 'calc',
          key: 'padding',
          formula: 'bourrage = D / 0,8 µs ; L = 18 − bourrage',
          subst: (ctx) => ((ctx.memo.octets as number) > 72 ? 'aucun' : `${fr(ctx.lab.cursorReadout().dx * 1e6, 3)} / 0,8 ⇒ L = 18 − ${ctx.memo.padding} = ${ctx.memo.L}`),
          result: (ctx) => ctx.memo.padding as number,
          unit: 'octets',
        },
      ],
    },
    {
      id: 'mac',
      phase: 'MAC destination',
      narration: 'Zoom à 200 ns/div sur la fin du SFD : son « 11 » final donne la phase. On lit ensuite chaque bit au milieu (front montant = 1), poids faible en premier.',
      actions: [
        {
          type: 'run',
          run: async (ctx) => {
            const c = need(ctx.capture)
            const t0 = t0Of(c)
            await ctx.turn('sdiv', 200e-9)
            await ctx.turn('delay', t0 + 6.8e-6 - c.tTrig)
            await ctx.mark({ from: t0 + 6.2e-6, to: t0 + 6.4e-6 }, '« 11 » du SFD')
            const b = decodeBytes(c, t0, 9)[8]!
            ctx.memo.mac = b
            ctx.memo.macBits = Array.from({ length: 8 }, (_, k) => (b >> k) & 1).join('')
          },
        },
        {
          type: 'overlayGrid',
          cells: (ctx): Zone[] => Array.from({ length: 8 }, (_, k) => ({ from: t0Of(need(ctx.capture)) + (64 + k) * BIT, to: t0Of(need(ctx.capture)) + (65 + k) * BIT, label: `b${k}`, color: k % 2 ? '#a78bfa' : '#38bdf8' })),
        },
        ...Array.from({ length: 8 }, (_, k) => ({ type: 'writeBit' as const, index: k, value: (ctx: Ctx) => String((ctx.memo.macBits as string)[k]) })),
        {
          type: 'calc',
          key: 'mac',
          formula: 'bits reçus b0…b7 → on renverse → hexadécimal',
          subst: (ctx) => `${ctx.memo.macBits} → ${[...(ctx.memo.macBits as string)].reverse().join('')} = ${hex(ctx.memo.mac as number)}h`,
          result: (ctx) => ctx.memo.mac as number,
          unit: '',
        },
      ],
    },
    {
      id: 'champs',
      phase: 'Champs',
      narration: 'Toute la trame, champ par champ : préambule, SFD, MAC destination et source, type, IP, ICMP, données, bourrage éventuel, FCS.',
      actions: [
        { type: 'turnKnob', knob: 'sdiv', value: (ctx) => Math.max(10e-6, (ctx.memo.octets as number) * BYTE / 8) },
        { type: 'turnKnob', knob: 'delay', value: (ctx) => 4 * ctx.lab.scope().sdiv },
        {
          type: 'overlayGrid',
          cells: (ctx): Zone[] => {
            const f = frameAt(ctx, need(ctx.capture))
            const t0 = t0Of(need(ctx.capture))
            return (f?.frame.fields ?? []).map((fd) => ({ from: t0 + fd.start * BYTE, to: t0 + (fd.start + fd.len) * BYTE, label: fd.name, color: FIELD_COLORS[fd.name] ?? '#94a3b8' }))
          },
        },
      ],
    },
    {
      id: 'copie',
      phase: 'Copie',
      narration: 'On reporte L, le bourrage, la durée mesurée et le premier octet de la MAC destination.',
      actions: [
        { type: 'fillAnswer', part: 'ping', field: 'L', value: (ctx) => String(ctx.memo.L) },
        { type: 'highlight', target: { dom: 'ans-ping-L' }, label: 'L' },
        { type: 'fillAnswer', part: 'ping', field: 'padding', value: (ctx) => String(ctx.memo.padding) },
        { type: 'fillAnswer', part: 'ping', field: 'durationUs', value: (ctx) => fr(ctx.memo.durationUs as number, 4) },
        { type: 'fillAnswer', part: 'ping', field: 'macByte', value: (ctx) => hex(ctx.memo.mac as number) },
        { type: 'highlight', target: { dom: 'ans-ping-macByte' }, label: 'MAC' },
      ],
    },
  ]
  return {
    part: 'ping',
    title: 'Partie 3 · Ping Ethernet',
    steps,
    recap: (ctx) => [
      `Durée lue : ${fr(ctx.memo.durationUs as number, 4)} µs ⇒ ${ctx.memo.octets} octets sur le câble`,
      (ctx.memo.padding as number) > 0 ? `Bourrage : ${ctx.memo.padding} octets 00h ⇒ L = 18 − ${ctx.memo.padding} = ${ctx.memo.L}` : `Pas de bourrage ⇒ L = ${ctx.memo.octets} − 54 = ${ctx.memo.L}`,
      `Commande : ping -l ${ctx.memo.L} ${ctx.subject.ping.to.ip.join('.')}`,
      `MAC destination : 1er octet ${hex(ctx.memo.mac as number)}h (bits reçus ${ctx.memo.macBits})`,
      `ΔX lu : ${frTime((ctx.memo.durationUs as number) * 1e-6)}`,
    ],
  }
}
