/**
 * Démonstration, partie 1 : câble coaxial. Tout passe par le banc branchable et l'oscilloscope ; les valeurs
 * des calculs sont celles lues sur les curseurs (ΔX, ΔY) ou le multimètre, bruit compris.
 */
import { RES3 } from '../../../data/reference'
import type { Plug } from '../../reseaux/benchTopology'
import { crossings, extremes, meanLevel } from '../lab'
import type { Ctx, DemoScript, Step } from '../types'
import { fr, frTime, need } from './common'

const W = RES3.largeur
/** Temps de propagation aller-retour pris pour v = 2·10⁸ m/s */
const HALF_V = RES3.v / 2

/** Instant du front à mi-hauteur d'une impulsion qui monte à partir de t (après la ligne de base) */
function midRise(ctx: Ctx, from: number, base: number, top: number) {
  const c = need(ctx.capture)
  return crossings(c, 0, base + (top - base) / 2, from, from + W + 200e-9)[0]?.t ?? NaN
}

/** Instant de l'écho dans l'acquisition courante (retard mémorisé relatif au déclenchement) */
const tEcho = (ctx: Ctx) => need(ctx.capture).tTrig + (ctx.memo.dEcho as number)

/** Amplitude signée moyenne d'un écho (sur son palier) par rapport à la ligne de base */
function echoLevel(ctx: Ctx) {
  const c = need(ctx.capture)
  const tE = tEcho(ctx)
  const base = meanLevel(c, 0, c.tTrig - 300e-9, c.tTrig - 20e-9)
  return meanLevel(c, 0, tE + 0.3 * W, tE + 0.9 * W) - base
}

export function cableScript(): DemoScript {
  const steps: Step[] = [
    {
      id: 'default',
      phase: 'Préparation',
      narration: 'On part d’un oscilloscope dans son état d’usine et d’une paillasse rangée. Touche Default Setup.',
      actions: [{ type: 'tab', index: 0 }, { type: 'range' }, { type: 'pressButton', button: 'defaultSetup' }],
    },
    {
      id: 'vide-branchement',
      phase: 'Générateur à vide',
      narration: 'D’abord le générateur seul : le cordon de 1 m relie sa sortie directement à CH1.',
      actions: [
        { type: 'connect', male: 'cordon.A', female: 'gen' },
        { type: 'connect', male: 'cordon.B', female: 'ch1' },
      ],
    },
    {
      id: 'generateur',
      phase: 'Générateur à vide',
      narration: 'Impulsions de 40 ns toutes les 1 ms, amplitude 8 V à vide.',
      actions: [
        { type: 'setGenerator', patch: { on: true, mode: 'pulse' } },
        { type: 'turnKnob', knob: 'width', value: W },
        { type: 'turnKnob', knob: 'period', value: RES3.periode },
        { type: 'turnKnob', knob: 'eg', value: RES3.eg },
      ],
    },
    {
      id: 'reglages-vide',
      phase: 'Générateur à vide',
      narration: 'CH1 à 2 V/div en DC, trace descendue de 2 divisions (+4 V au centre) pour que le plateau tienne à l’écran ; déclenchement CH1 front montant à 2 V en Normal, 20 ns/div, à 1 division du bord gauche.',
      actions: [
        { type: 'setChannel', ch: 0, patch: { coupling: 'DC' } },
        { type: 'turnKnob', knob: 'vdiv0', value: 2 },
        { type: 'turnKnob', knob: 'offset0', value: 4 },
        { type: 'setTrigger', patch: { source: 0, slope: 'montant', mode: 'normal' } },
        { type: 'turnKnob', knob: 'level', value: 2 },
        { type: 'turnKnob', knob: 'sdiv', value: 20e-9 },
        { type: 'turnKnob', knob: 'delay', value: 80e-9 },
      ],
    },
    {
      id: 'eg',
      phase: 'Générateur à vide',
      narration: 'Single, puis Y1 sur la ligne de base et Y2 sur le plateau : ΔY donne Eg, car l’entrée 1 MΩ ≫ 50 Ω ne fait chuter presque rien dans Zg.',
      actions: [
        { type: 'pressButton', button: 'single' },
        {
          type: 'read',
          run: (ctx) => {
            const c = need(ctx.capture)
            ctx.memo.base0 = meanLevel(c, 0, c.tTrig - 18e-9, c.tTrig - 4e-9)
            ctx.memo.plat0 = meanLevel(c, 0, c.tTrig + 10e-9, c.tTrig + W - 6e-9)
          },
        },
        { type: 'moveCursor', cursor: 'y1', value: (ctx) => ctx.memo.base0 as number, ych: 0 },
        { type: 'moveCursor', cursor: 'y2', value: (ctx) => ctx.memo.plat0 as number },
        { type: 'highlight', target: { dom: 'readout-dy' }, label: 'ΔY = Eg' },
        { type: 'calc', key: 'Eg', formula: 'Eg = ΔY (1 MΩ ≫ Zg = 50 Ω)', subst: (ctx) => `ΔY lu = ${fr(ctx.lab.cursorReadout().dy)} V`, result: (ctx) => ctx.lab.cursorReadout().dy, unit: 'V' },
      ],
    },
    {
      id: 'te',
      phase: 'Extrémité ouverte',
      narration: 'On débranche CH1, on y monte un Té : le cordon du générateur sur un bras, le câble long sur l’autre. Le bout du câble reste libre.',
      actions: [
        { type: 'disconnect', male: 'cordon.B' },
        { type: 'connect', male: 'tee1', female: 'ch1' },
        { type: 'connect', male: 'cordon.B', female: 'tee1.a' },
        { type: 'connect', male: 'coax.A', female: 'tee1.b' },
      ],
    },
    {
      id: 'reglages-ligne',
      phase: 'Extrémité ouverte',
      narration: 'CH1 à 1 V/div (+1 V au centre : de −3 à +5 V à l’écran) et 200 ns/div pour voir l’écho ; le déclenchement reste à 1 division du bord gauche.',
      actions: [
        { type: 'turnKnob', knob: 'vdiv0', value: 1 },
        { type: 'turnKnob', knob: 'offset0', value: 1 },
        { type: 'turnKnob', knob: 'sdiv', value: 200e-9 },
        { type: 'turnKnob', knob: 'delay', value: 800e-9 },
        { type: 'pressButton', button: 'single' },
      ],
    },
    {
      id: 'incident-echo',
      phase: 'Extrémité ouverte',
      narration: (ctx) =>
        `À gauche l’impulsion incidente, plus loin l’écho, de même signe : en bout ouvert Γ = +1.${ctx.subject.coax.cable.Zc !== RES3.zg ? ' Les petits échos alternés viennent du générateur (Γg ≠ 0).' : ''}`,
      actions: [
        {
          type: 'read',
          run: (ctx) => {
            const c = need(ctx.capture)
            ctx.memo.base1 = meanLevel(c, 0, c.tTrig - 180e-9, c.tTrig - 20e-9)
            // L'écho : premier front montant franc après l'incidente
            const e = crossings(c, 0, (ctx.memo.base1 as number) + 1, c.tTrig + W + 40e-9, c.rec[1]).find((x) => x.dir === 1)
            ctx.memo.dEcho = e ? e.t - 3e-9 - c.tTrig : NaN
          },
        },
        { type: 'highlight', target: { zone: (ctx) => ({ from: ctx.capture!.tTrig - 10e-9, to: ctx.capture!.tTrig + W + 15e-9 }) }, label: 'incidente' },
        { type: 'highlight', target: { zone: (ctx) => ({ from: tEcho(ctx) - 10e-9, to: tEcho(ctx) + W + 70e-9 }) }, label: 'écho : même signe, Γ = +1' },
        {
          type: 'run',
          run: async (ctx) => {
            if (ctx.subject.coax.cable.Zc === RES3.zg) return
            const t2 = 2 * tEcho(ctx) - ctx.capture!.tTrig
            await ctx.mark({ from: t2 - 10e-9, to: t2 + W + 90e-9 }, 'petit écho inversé (Γg = −0,2)')
          },
        },
      ],
    },
    {
      id: 'zc1',
      phase: 'Zc, méthode 1',
      narration: 'Y1 sur la ligne de base, Y2 sur le plateau de l’incidente : ΔY = Ei. Le pont diviseur Zg / Zc à t = 0⁺ donne Zc.',
      actions: [
        { type: 'read', run: (ctx) => (ctx.memo.plat1 = meanLevel(need(ctx.capture), 0, ctx.capture!.tTrig + 10e-9, ctx.capture!.tTrig + W - 6e-9)) },
        { type: 'moveCursor', cursor: 'y1', value: (ctx) => ctx.memo.base1 as number, ych: 0 },
        { type: 'moveCursor', cursor: 'y2', value: (ctx) => ctx.memo.plat1 as number },
        { type: 'highlight', target: { dom: 'readout-dy' }, label: 'ΔY = Ei' },
        { type: 'read', run: (ctx) => (ctx.memo.Ei = ctx.lab.cursorReadout().dy) },
        {
          type: 'calc',
          key: 'Zc1',
          formula: 'Zc = Zg·Ei / (Eg − Ei)',
          subst: (ctx) => `50 × ${fr(ctx.memo.Ei as number)} / (${fr(ctx.memo.Eg as number)} − ${fr(ctx.memo.Ei as number)})`,
          result: (ctx) => (RES3.zg * (ctx.memo.Ei as number)) / ((ctx.memo.Eg as number) - (ctx.memo.Ei as number)),
          unit: 'Ω',
        },
        {
          type: 'calc',
          key: 'ratio',
          formula: 'Ei / Eg (0,5 ⇒ 50 Ω ; 0,6 ⇒ 75 Ω)',
          subst: (ctx) => `${fr(ctx.memo.Ei as number)} / ${fr(ctx.memo.Eg as number)}`,
          result: (ctx) => (ctx.memo.Ei as number) / (ctx.memo.Eg as number),
          unit: '',
        },
      ],
    },
    {
      id: 'longueur',
      phase: 'Longueur',
      narration: 'X1 sur le front de l’incidente à mi-hauteur, X2 sur celui de l’écho : ΔX est l’aller-retour 2l/v.',
      actions: [
        {
          type: 'read',
          run: (ctx) => {
            const c = need(ctx.capture)
            const base = ctx.memo.base1 as number
            ctx.memo.t1 = midRise(ctx, c.tTrig - 20e-9, base, ctx.memo.plat1 as number)
            const tE = tEcho(ctx)
            const top = extremes(c, 0, tE, tE + W + 120e-9).max
            ctx.memo.t2 = midRise(ctx, tE - 20e-9, base, top)
          },
        },
        { type: 'moveCursor', cursor: 'x1', value: (ctx) => (ctx.memo.t1 as number) - ctx.capture!.tTrig },
        { type: 'moveCursor', cursor: 'x2', value: (ctx) => (ctx.memo.t2 as number) - ctx.capture!.tTrig },
        { type: 'highlight', target: { dom: 'readout-dx' }, label: 'ΔX = 2l/v' },
        {
          type: 'calc',
          key: 'l',
          formula: 'l = v·Δt / 2 = 10⁸ × Δt',
          subst: (ctx) => `10⁸ × ${frTime(ctx.lab.cursorReadout().dx)}`,
          result: (ctx) => HALF_V * ctx.lab.cursorReadout().dx,
          unit: 'm',
        },
      ],
    },
    {
      id: 'spires',
      phase: 'Longueur',
      narration: 'Contrôle avec l’enroulement : N spires de diamètre D font N·π·D mètres, à quelques pour cent près.',
      actions: [
        { type: 'highlight', target: { dom: 'touret' }, label: 'N et D' },
        {
          type: 'calc',
          key: 'lSpires',
          formula: 'l ≈ N·π·D',
          subst: (ctx) => `${ctx.subject.coax.cable.N} × π × ${fr(ctx.subject.coax.cable.D)}`,
          result: (ctx) => ctx.subject.coax.cable.N * Math.PI * ctx.subject.coax.cable.D,
          unit: 'm',
        },
        {
          type: 'calc',
          key: 'ecartSpires',
          formula: 'écart = |N·π·D − l| / l',
          subst: (ctx) => `|${fr(ctx.memo.lSpires as number)} − ${fr(ctx.memo.l as number)}| / ${fr(ctx.memo.l as number)}`,
          result: (ctx) => (100 * Math.abs((ctx.memo.lSpires as number) - (ctx.memo.l as number))) / (ctx.memo.l as number),
          unit: '%',
          digits: 2,
        },
      ],
    },
    {
      id: 'cc',
      phase: 'Court-circuit',
      narration: 'Le bout du câble sur le potentiomètre réglé à 0 Ω : l’écho s’inverse, Γ = −1.',
      actions: [
        { type: 'connect', male: 'coax.B', female: 'pot' },
        { type: 'turnKnob', knob: 'pot', value: 0 },
        { type: 'pressButton', button: 'single' },
        { type: 'highlight', target: { zone: (ctx) => ({ from: tEcho(ctx) - 10e-9, to: tEcho(ctx) + W + 70e-9 }) }, label: 'écho inversé : Γ = −1' },
      ],
    },
    {
      id: 'adaptation',
      phase: 'Zc, méthode 2',
      narration: 'On passe CH1 à 100 mV/div pour voir le moindre écho, puis on tourne le potentiomètre jusqu’à ce que l’écho s’annule.',
      actions: [
        { type: 'turnKnob', knob: 'vdiv0', value: 0.1 },
        { type: 'turnKnob', knob: 'offset0', value: 0 },
        {
          type: 'run',
          run: async (ctx) => {
            // Dichotomie sur le signe de l'écho : positif ⇒ R > Zc, négatif ⇒ R < Zc
            let [lo, hi]: [number, number] = [0, RES3.potMax]
            for (let k = 0; k < 9; k++) {
              const r = Math.round(((lo + hi) / 2) * 2) / 2
              await ctx.turn('pot', r)
              await ctx.single()
              const e = echoLevel(ctx)
              await ctx.mark({ from: tEcho(ctx) - 10e-9, to: tEcho(ctx) + W + 70e-9 }, `écho ${fr(e * 1000, 2)} mV`)
              if (e > 0) hi = r
              else lo = r
              if (hi - lo <= 0.5) break
            }
            await ctx.turn('pot', Math.round(((lo + hi) / 2) * 2) / 2)
          },
        },
      ],
    },
    {
      id: 'ohmmetre',
      phase: 'Zc, méthode 2',
      narration: 'On débranche le potentiomètre et on le mesure à l’ohmmètre (pointes sur l’âme et la masse) : c’est Zc.',
      actions: [
        { type: 'disconnect', male: 'coax.B' },
        { type: 'highlight', target: { dom: 'ohmmetre' }, label: 'R = Zc' },
        { type: 'calc', key: 'Zc2', formula: 'Zc = R lu à l’ohmmètre', subst: (ctx) => `R = ${fr(ctx.lab.ohmmeter() ?? NaN, 4)} Ω`, result: (ctx) => ctx.lab.ohmmeter() ?? NaN, unit: 'Ω' },
        {
          type: 'calc',
          key: 'ecartZc',
          formula: 'écart = |Zc₂ − Zc₁| / Zc₁ (< 10 %)',
          subst: (ctx) => `|${fr(ctx.memo.Zc2 as number)} − ${fr(ctx.memo.Zc1 as number)}| / ${fr(ctx.memo.Zc1 as number)}`,
          result: (ctx) => (100 * Math.abs((ctx.memo.Zc2 as number) - (ctx.memo.Zc1 as number))) / (ctx.memo.Zc1 as number),
          unit: '%',
          digits: 2,
        },
      ],
    },
    {
      id: 'bouchon',
      phase: 'Ligne adaptée',
      narration: 'Un Té posé au bout du câble avec le bouchon de la bonne valeur : plus aucun écho.',
      actions: [
        { type: 'turnKnob', knob: 'vdiv0', value: 1 },
        { type: 'turnKnob', knob: 'offset0', value: 1 },
        { type: 'connect', male: 'tee2', female: 'park1' },
        { type: 'connect', male: 'coax.B', female: 'tee2.a' },
        { type: 'read', run: (ctx) => (ctx.memo.bouchon = Math.abs((ctx.memo.Zc2 as number) - RES3.bouchons[0]) < Math.abs((ctx.memo.Zc2 as number) - RES3.bouchons[1]) ? 'b50' : 'b75') },
        { type: 'run', run: async (ctx) => ctx.lab.plug(ctx.memo.bouchon as Plug, 'tee2.b') },
        { type: 'pressButton', button: 'single' },
        { type: 'highlight', target: { zone: (ctx) => ({ from: tEcho(ctx) - 10e-9, to: tEcho(ctx) + W + 70e-9 }) }, label: 'plus d’écho : Γ = 0' },
      ],
    },
    {
      id: 'copie',
      phase: 'Copie',
      narration: 'On reporte les résultats : Zc mesurée à l’ohmmètre, longueur par le retard, Γ = +1 en ouvert et −1 en court-circuit.',
      actions: [
        { type: 'fillAnswer', part: 'cable', field: 'zc', value: (ctx) => fr(ctx.memo.Zc2 as number, 3) },
        { type: 'highlight', target: { dom: 'ans-cable-zc' }, label: 'Zc' },
        { type: 'fillAnswer', part: 'cable', field: 'l', value: (ctx) => String(Math.round(ctx.memo.l as number)) },
        { type: 'highlight', target: { dom: 'ans-cable-l' }, label: 'l' },
        { type: 'fillAnswer', part: 'cable', field: 'gammaOpen', value: '1' },
        { type: 'fillAnswer', part: 'cable', field: 'gammaShort', value: '-1' },
        { type: 'fillAnswer', part: 'cable', field: 'methode', value: 'les-deux' },
        { type: 'highlight', target: { dom: 'ans-cable-methode' }, label: 'les deux méthodes' },
      ],
    },
  ]
  return {
    part: 'cable',
    title: 'Partie 1 · Câble coaxial',
    steps,
    recap: (ctx) => [
      `Eg = ${fr(ctx.memo.Eg as number)} V lu à vide (1 MΩ ≫ 50 Ω)`,
      `Ei = ${fr(ctx.memo.Ei as number)} V ⇒ Zc ≈ ${fr(ctx.memo.Zc1 as number)} Ω (méthode 1)`,
      `Potentiomètre à l’adaptation : ${fr(ctx.memo.Zc2 as number)} Ω à l’ohmmètre (écart ${fr(ctx.memo.ecartZc as number, 2)} %)`,
      `Δt aller-retour ⇒ l = ${fr(ctx.memo.l as number)} m (spires : ${fr(ctx.memo.lSpires as number)} m)`,
      'Γ = +1 en bout ouvert (écho de même signe), −1 en court-circuit (écho inversé), 0 adapté',
    ],
  }
}
