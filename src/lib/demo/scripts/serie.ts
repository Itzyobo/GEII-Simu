/**
 * Démonstration, partie 2 : trame série. Tout est lu sur l'oscilloscope : niveaux (norme), créneau le plus court,
 * durée d'un bit aux curseurs, grille des bits, parité déduite des caractères, message.
 */
import { RES3_SERIE } from '../../../data/reference'
import { crossings, samplesIn, valueAt, type CaptureInfo, type Zone } from '../lab'
import type { Ctx, DemoScript, Step } from '../types'
import { fr, frTime, need, sdivAtLeast } from './common'

const CELL_COLORS = ['#38bdf8', '#a78bfa'] as const
const PAR_FR = { none: 'aucune', even: 'paire', odd: 'impaire' } as const

export interface DecodedChar {
  t0: number
  data: number[]
  /** Bit lu juste après les données (parité ou stop) */
  after: number
  code: number
}

/** Bit logique lu au milieu d'une case (TTL : haut = 1 ; RS-232 : négatif = 1) */
export function bitAt(c: CaptureInfo, t: number, mid: number, ttl: boolean): number {
  const v = valueAt(c, 0, t)
  return (ttl ? v > mid : v < mid) ? 1 : 0
}

const n = (ctx: Ctx) => ctx.subject.serie.enonce.dataBits
const s = (ctx: Ctx) => ctx.subject.serie.enonce.stopBits
const tb = (ctx: Ctx) => 1 / (ctx.memo.baud as number)
const ttl = (ctx: Ctx) => ctx.memo.level === 'TTL'
const mid = (ctx: Ctx) => ctx.memo.mid as number

/** Grille des cases d'un caractère commençant à t0 : S, b0…b(n−1), bit suivant, stop */
function grid(ctx: Ctx, t0: number, after: string): Zone[] {
  const T = tb(ctx)
  const labels = ['S', ...Array.from({ length: n(ctx) }, (_, i) => `b${i}`), after, ...Array.from({ length: s(ctx) }, () => 'stop')]
  return labels.map((label, i) => ({ from: t0 + i * T, to: t0 + (i + 1) * T, label, color: CELL_COLORS[i % 2]! }))
}

/**
 * Lit tous les caractères du message, sous l'hypothèse « parité » (p = 1) ou non (p = 0).
 * null si l'hypothèse est contredite (bit de stop lu à 0).
 */
export function readMessage(c: CaptureInfo, t0: number, T: number, nBits: number, sBits: number, p: 0 | 1, m: number, isTtl: boolean): DecodedChar[] | null {
  const chars: DecodedChar[] = []
  const toActive = isTtl ? -1 : 1
  let start = t0
  for (let guard = 0; guard < 8; guard++) {
    const bit = (k: number) => bitAt(c, start + (k + 0.5) * T, m, isTtl)
    if (bit(0) !== 0) return null
    const data = Array.from({ length: nBits }, (_, i) => bit(1 + i))
    const after = bit(1 + nBits)
    for (let k = 0; k < sBits; k++) if (bit(1 + nBits + p + k) !== 1) return null
    chars.push({ t0: start, data, after, code: data.reduce((v, b, i) => v | (b << i), 0) })
    // Prochain start : premier passage au niveau actif après les stops, calé sur la grille
    const after0 = start + (1 + nBits + p + sBits - 0.5) * T
    // Repos entre caractères (0 à 3 bits) et éventuel bit de parité : on cherche jusqu'à 16 bits plus loin
    const next = crossings(c, 0, m, after0, Math.min(c.rec[1], after0 + 16 * T)).find((x) => x.dir === toActive)
    if (!next) break
    start = next.t
  }
  return chars
}

/** Type de parité cohérent avec tous les caractères (null : contradiction) */
export function parityOf(chars: DecodedChar[]): 'even' | 'odd' | null {
  const even = chars.every((ch) => (ch.data.reduce((a, b) => a + b, 0) + ch.after) % 2 === 0)
  const odd = chars.every((ch) => (ch.data.reduce((a, b) => a + b, 0) + ch.after) % 2 === 1)
  return even ? 'even' : odd ? 'odd' : null
}

const ascii = (code: number) => (code >= 0x20 && code < 0x7f ? String.fromCharCode(code) : '·')
const hex = (code: number) => code.toString(16).toUpperCase().padStart(2, '0')

export function serieScript(nChars: number): DemoScript {
  const charSteps: Step[] = []
  for (let i = 1; i < nChars; i++)
    charSteps.push({
      id: `car-${i + 1}`,
      phase: 'Message',
      fast: true,
      narration: `Caractère ${i + 1} : même méthode, on déplace le retard jusqu’à son start.`,
      actions: [
        { type: 'zoom', sdiv: (ctx) => ctx.memo.sdivChar as number, delay: (ctx) => (ctx.memo[`t0_${i}`] as number) - need(ctx.capture).tTrig + 4 * (ctx.memo.sdivChar as number) },
        { type: 'overlayGrid', cells: (ctx) => grid(ctx, ctx.memo[`t0_${i}`] as number, ctx.memo.p ? 'P' : 'stop') },
        ...Array.from({ length: 12 }, (_, k) => ({
          type: 'writeBit' as const,
          index: k,
          value: (ctx: Ctx) => {
            const t = (ctx.memo[`t0_${i}`] as number) + (k + 0.5) * tb(ctx)
            return k < 2 + n(ctx) + s(ctx) ? String(bitAt(need(ctx.capture), t, mid(ctx), ttl(ctx))) : ''
          },
        })),
        {
          type: 'calc',
          key: `code_${i}`,
          formula: 'b(n−1)…b0 → hexadécimal → ASCII',
          subst: (ctx) => {
            const code = ctx.memo[`code_${i}`] as number
            return `${code.toString(2).padStart(n(ctx), '0')} = ${hex(code)}h = « ${ascii(code)} »`
          },
          result: (ctx) => ctx.memo[`code_${i}`] as number,
          unit: '',
        },
      ],
    })

  const steps: Step[] = [
    {
      id: 'enonce',
      phase: 'Énoncé',
      narration: (ctx) => `L’énoncé donne ${n(ctx)} bits de données et ${s(ctx)} bit${s(ctx) > 1 ? 's' : ''} de stop : sans eux, 8N1 et 7E1 seraient indiscernables.`,
      actions: [
        { type: 'tab', index: 1 },
        { type: 'highlight', target: { dom: 'brief-serie' }, label: 'n et s' },
      ],
    },
    {
      id: 'vue',
      phase: 'Norme',
      narration: 'Default Setup, CH1 à 5 V/div et 1 ms/div, niveau de déclenchement à 1 V (à 0 V, une ligne TTL qui descend pile à 0 V ne le franchirait jamais) : on regarde la ligne.',
      actions: [
        { type: 'pressButton', button: 'defaultSetup' },
        { type: 'turnKnob', knob: 'vdiv0', value: 5 },
        { type: 'turnKnob', knob: 'sdiv', value: 1e-3 },
        { type: 'turnKnob', knob: 'level', value: 1 },
        { type: 'pressButton', button: 'single' },
      ],
    },
    {
      id: 'niveaux',
      phase: 'Norme',
      narration: (ctx) =>
        ctx.memo.level === 'TTL'
          ? `Repos à ${fr(ctx.memo.idle as number, 2)} V, l’autre niveau vers ${fr(ctx.memo.other as number, 2)} V : c’est du TTL (0/5 V, repos haut).`
          : `Repos à ${fr(ctx.memo.idle as number, 3)} V, l’autre niveau vers +${fr(ctx.memo.other as number, 3)} V : c’est du RS-232, logique inversée (1 = négatif).`,
      actions: [
        {
          type: 'read',
          run: (ctx) => {
            const c = need(ctx.capture)
            const { v } = samplesIn(c, 0, c.rec[0], c.rec[1])
            const sorted = [...v].sort((a, b) => a - b)
            const idle = sorted[Math.floor(sorted.length / 2)]!
            const other = Math.abs(sorted[0]! - idle) > Math.abs(sorted[sorted.length - 1]! - idle) ? sorted[0]! : sorted[sorted.length - 1]!
            ctx.memo.idle = idle
            ctx.memo.other = other
            ctx.memo.mid = (idle + other) / 2
            ctx.memo.level = idle > 0 && Math.abs(other) < 1 ? 'TTL' : 'RS232'
          },
        },
        { type: 'highlight', target: { zone: (ctx) => ({ from: need(ctx.capture).rec[0], to: need(ctx.capture).rec[0] + 1e-3 }) }, label: (ctx) => `repos : ${fr(ctx.memo.idle as number, 2)} V` },
        { type: 'highlight', target: { zone: (ctx) => ({ from: need(ctx.capture).tTrig - 0.2e-3, to: need(ctx.capture).tTrig + 0.6e-3 }) }, label: (ctx) => `autre niveau : ${fr(ctx.memo.other as number, 2)} V` },
      ],
    },
    {
      id: 'declenchement',
      phase: 'Débit',
      narration: (ctx) =>
        `Normal, déclenchement sur le front qui quitte le repos (${ttl(ctx) ? 'descendant en TTL' : 'montant en RS-232'}), au milieu des deux niveaux. Holdoff 100 ms : le message revient toutes les 200 ms ; en laissant tourner puis Stop, on déclenche toujours sur son premier start.`,
      actions: [
        { type: 'setTrigger', patch: (ctx) => ({ mode: 'normal', source: 0, slope: ttl(ctx) ? 'descendant' : 'montant' }) },
        { type: 'turnKnob', knob: 'level', value: (ctx) => mid(ctx) },
        { type: 'turnKnob', knob: 'holdoff', value: 0.1 },
        { type: 'turnKnob', knob: 'delay', value: 4e-3 },
        { type: 'pressButton', button: 'runStop' },
      ],
    },
    {
      id: 'court',
      phase: 'Débit',
      narration: 'On repère le créneau le plus court du message, puis on règle la base de temps pour qu’un caractère occupe 6 à 8 divisions.',
      actions: [
        {
          type: 'read',
          run: (ctx) => {
            const c = need(ctx.capture)
            const cr = crossings(c, 0, mid(ctx), c.tTrig - 1e-6, c.rec[1], 0.5)
            let best = Infinity
            let at = c.tTrig
            for (let i = 1; i < cr.length; i++) {
              const d = cr[i]!.t - cr[i - 1]!.t
              if (d > 1e-6 && d < best) [best, at] = [d, cr[i - 1]!.t]
            }
            ctx.memo.Tmin = best
            ctx.memo.tMin = at
            ctx.memo.sdivChar = sdivAtLeast(((2 + n(ctx) + s(ctx)) * best) / 8)
          },
        },
        { type: 'highlight', target: { zone: (ctx) => ({ from: ctx.memo.tMin as number, to: (ctx.memo.tMin as number) + (ctx.memo.Tmin as number) }) }, label: (ctx) => `plus court : ${frTime(ctx.memo.Tmin as number)}` },
        { type: 'turnKnob', knob: 'sdiv', value: (ctx) => ctx.memo.sdivChar as number },
        { type: 'turnKnob', knob: 'delay', value: (ctx) => 4 * (ctx.memo.sdivChar as number) },
        { type: 'pressButton', button: 'runStop' },
      ],
    },
    {
      id: 'debit',
      phase: 'Débit',
      narration: 'X1 sur le début du start, X2 sur un front plusieurs bits plus loin : ΔX / k donne la durée d’un bit, et tous les fronts doivent tomber sur cette grille.',
      actions: [
        {
          type: 'read',
          run: (ctx) => {
            const c = need(ctx.capture)
            const Tmin = ctx.memo.Tmin as number
            const cr = crossings(c, 0, mid(ctx), c.tTrig + 0.3 * Tmin, c.tTrig + (1.5 + n(ctx)) * Tmin, 0.5).map((x) => x.t - c.tTrig)
            // Débit normalisé le plus lent dont la grille passe par tous les fronts lus
            const fits = RES3_SERIE.debits.filter((b) => 1 / b <= 1.1 * Tmin && cr.every((t) => Math.abs(t * b - Math.round(t * b)) < 0.2))
            const b0 = fits[0] ?? 1 / Tmin
            const far = cr.filter((t) => t * b0 < n(ctx) + 1.2).at(-1) ?? Tmin
            ctx.memo.k = Math.max(1, Math.round(far * b0))
            ctx.memo.x2 = far
          },
        },
        { type: 'moveCursor', cursor: 'x1', value: 0 },
        { type: 'moveCursor', cursor: 'x2', value: (ctx) => ctx.memo.x2 as number },
        { type: 'highlight', target: { dom: 'readout-dx' }, label: (ctx) => `ΔX = ${ctx.memo.k} bits` },
        { type: 'calc', key: 'Tbit', formula: 'Tbit = ΔX / k', subst: (ctx) => `${frTime(ctx.lab.cursorReadout().dx)} / ${ctx.memo.k}`, result: (ctx) => ctx.lab.cursorReadout().dx / (ctx.memo.k as number), unit: 's', digits: 4 },
        { type: 'calc', key: 'debitMesure', formula: 'D = 1 / Tbit', subst: (ctx) => `1 / ${frTime(ctx.memo.Tbit as number)}`, result: (ctx) => 1 / (ctx.memo.Tbit as number), unit: 'bauds', digits: 4 },
        {
          type: 'calc',
          key: 'baud',
          formula: 'Débit normalisé le plus proche',
          subst: (ctx) => `${fr(ctx.memo.debitMesure as number, 4)} ≈`,
          result: (ctx) => RES3_SERIE.debits.reduce((b, d) => (Math.abs(d - (ctx.memo.debitMesure as number)) < Math.abs(b - (ctx.memo.debitMesure as number)) ? d : b), RES3_SERIE.debits[0]),
          unit: 'bauds',
          digits: 6,
        },
      ],
    },
    {
      id: 'bits-1',
      phase: 'Caractère 1',
      narration: 'On pose la grille d’un caractère : start, b0 à b(n−1), bit suivant, stop, et on lit chaque bit au milieu de sa case. Le start vaut 0, le stop 1.',
      actions: [
        { type: 'overlayGrid', cells: (ctx) => grid(ctx, need(ctx.capture).tTrig, 'P?') },
        ...Array.from({ length: 12 }, (_, k) => ({
          type: 'writeBit' as const,
          index: k,
          value: (ctx: Ctx) => (k < 2 + n(ctx) + s(ctx) ? String(bitAt(need(ctx.capture), need(ctx.capture).tTrig + (k + 0.5) * tb(ctx), mid(ctx), ttl(ctx))) : ''),
        })),
        {
          type: 'read',
          run: (ctx) => {
            const c = need(ctx.capture)
            const data = Array.from({ length: n(ctx) }, (_, i) => bitAt(c, c.tTrig + (1.5 + i) * tb(ctx), mid(ctx), ttl(ctx)))
            ctx.memo.code_0 = data.reduce((v, b, i) => v | (b << i), 0)
          },
        },
        {
          type: 'calc',
          key: 'code_0',
          formula: 'On renverse (poids faible émis en premier) → hexadécimal → ASCII',
          subst: (ctx) => {
            const code = ctx.memo.code_0 as number
            return `${code.toString(2).padStart(n(ctx), '0')} = ${hex(code)}h = « ${ascii(code)} »`
          },
          result: (ctx) => ctx.memo.code_0 as number,
          unit: '',
        },
      ],
    },
    {
      id: 'parite',
      phase: 'Parité',
      narration: (ctx) =>
        ctx.memo.p
          ? `Le bit qui suit les données respecte une parité ${PAR_FR[ctx.memo.parity as 'even' | 'odd']} sur tous les caractères${ctx.memo.p0 !== undefined ? ', et il vaut 0 sur l’un d’eux : ce n’est pas un stop' : ''}.`
          : `Le bit qui suit les données est un stop sur tous les caractères : il n’y a pas de parité${ctx.memo.ambigu ? ' (le message seul ne permet pas de trancher)' : ''}.`,
      actions: [
        { type: 'turnKnob', knob: 'sdiv', value: (ctx) => sdivAtLeast((ctx.subject.serie.expected.message.length * (n(ctx) + 6) * tb(ctx)) / 8) },
        { type: 'turnKnob', knob: 'delay', value: (ctx) => 4 * ctx.lab.scope().sdiv },
        { type: 'pressButton', button: 'runStop' },
        {
          type: 'read',
          run: (ctx) => {
            const c = need(ctx.capture)
            const args = [c, c.tTrig, tb(ctx), n(ctx), s(ctx)] as const
            const h0 = readMessage(...args, 0, mid(ctx), ttl(ctx))
            const h1 = readMessage(...args, 1, mid(ctx), ttl(ctx))
            const p1 = h1 ? parityOf(h1) : null
            const useParity = !!h1 && !!p1 && !h0
            const chars = (useParity ? h1 : (h0 ?? h1))!
            ctx.memo.p = useParity ? 1 : 0
            ctx.memo.parity = useParity ? p1! : 'none'
            ctx.memo.ambigu = !!h0 && !!h1 && !!p1 ? 1 : 0
            chars.forEach((ch, i) => {
              ctx.memo[`t0_${i}`] = ch.t0
              ctx.memo[`code_${i}`] = ch.code
            })
            const zero = useParity ? chars.findIndex((ch) => ch.after === 0) : -1
            if (zero >= 0) ctx.memo.p0 = zero
            ctx.memo.message = chars.map((ch) => ascii(ch.code)).join('')
          },
        },
        {
          type: 'run',
          run: async (ctx) => {
            if (ctx.memo.p0 === undefined) return
            const t0 = ctx.memo[`t0_${ctx.memo.p0}`] as number
            const T = tb(ctx)
            await ctx.mark({ from: t0 + (1 + n(ctx)) * T, to: t0 + (2 + n(ctx)) * T }, 'P = 0')
          },
        },
      ],
    },
    ...charSteps,
    {
      id: 'copie',
      phase: 'Copie',
      narration: (ctx) => `Message complet : « ${ctx.memo.message} ». On reporte débit, parité, norme et message.`,
      actions: [
        { type: 'fillAnswer', part: 'serie', field: 'baud', value: (ctx) => String(ctx.memo.baud) },
        { type: 'highlight', target: { dom: 'ans-serie-baud' }, label: 'débit' },
        { type: 'fillAnswer', part: 'serie', field: 'parity', value: (ctx) => ctx.memo.parity as string },
        { type: 'fillAnswer', part: 'serie', field: 'level', value: (ctx) => ctx.memo.level as string },
        { type: 'fillAnswer', part: 'serie', field: 'message', value: (ctx) => ctx.memo.message as string },
        { type: 'highlight', target: { dom: 'ans-serie-message' }, label: 'message' },
      ],
    },
  ]
  return {
    part: 'serie',
    title: 'Partie 2 · Trame série',
    steps,
    recap: (ctx) => [
      `Norme ${ctx.memo.level === 'TTL' ? 'TTL (repos haut, 0/5 V)' : 'RS-232 (repos négatif, logique inversée)'}`,
      `Bit : ${frTime(ctx.memo.Tbit as number)} ⇒ ${fr(ctx.memo.debitMesure as number, 4)} bauds ⇒ ${ctx.memo.baud} bauds normalisés`,
      `Parité ${PAR_FR[ctx.memo.parity as keyof typeof PAR_FR]}`,
      `Message « ${ctx.memo.message} »`,
    ],
  }
}
