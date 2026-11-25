/**
 * Banc TP1 branchable : graphe des connexions BNC → modèle physique de coax.ts.
 *
 * Embases femelles : sortie du générateur, CH1, CH2, potentiomètre, bras des Té. Fiches mâles : bouts du cordon
 * et du câble long, pied des Té, bouchons 50 Ω / 75 Ω / court-circuit. Tout montage pris en charge se ramène à
 *   source (Eg, Zg) → nœud A → une ligne (Zc, l) → nœud B.
 * - Un cordon entre le générateur et le nœud A est transparent : adapté à Zg = 50 Ω, il ne fait que retarder.
 * - Les charges au nœud A (entrée 1 MΩ, bouchon sur le Té…) entrent dans l'équivalent de Thévenin de la source.
 * - Sans ligne, le nœud A est chargé directement (ligne de longueur nulle).
 * Les erreurs de montage ont leur conséquence physique ; les topologies hors modèle sont refusées avec une raison.
 */
import { OSCILLO, RES3 } from '../../data/reference'
import { mulberry32 } from '../../au3/sim/prng'
import type { SignalSource } from '../scope/types'
import { alphaAt, coaxSources, termsSource, type Cable, type Waveform } from './coax'

export const TEES = ['tee1', 'tee2'] as const
export type TeeId = (typeof TEES)[number]
/** park1/park2 : supports du plateau où poser un Té au bout du câble (aucun contact électrique) */
export type Female = 'gen' | 'ch1' | 'ch2' | 'pot' | 'park1' | 'park2' | `${TeeId}.a` | `${TeeId}.b`
export type CableEnd = 'cordon.A' | 'cordon.B' | 'coax.A' | 'coax.B'
export type Plug = 'b50' | 'b75' | 'cc'
export type Male = CableEnd | TeeId | Plug
/** Montage : chaque fiche mâle branchée → l'embase femelle qui la reçoit */
export type Connections = Partial<Record<Male, Female>>

export const MALES: readonly Male[] = ['cordon.A', 'cordon.B', 'coax.A', 'coax.B', 'tee1', 'tee2', 'b50', 'b75', 'cc']
export const BASE_FEMALES: readonly Female[] = ['gen', 'ch1', 'ch2', 'pot', 'park1', 'park2']
export const femalesOf = (m: Male): Female[] => (m === 'tee1' || m === 'tee2' ? [`${m}.a`, `${m}.b`] : [])
export const ALL_FEMALES: readonly Female[] = [...BASE_FEMALES, ...TEES.flatMap((t) => femalesOf(t))]

export const NAMES: Record<Male | Female, string> = {
  'cordon.A': 'cordon 1 m (bout A)',
  'cordon.B': 'cordon 1 m (bout B)',
  'coax.A': 'câble long (bout A)',
  'coax.B': 'câble long (bout B)',
  tee1: 'Té n° 1',
  tee2: 'Té n° 2',
  b50: 'bouchon 50 Ω',
  b75: 'bouchon 75 Ω',
  cc: 'bouchon court-circuit',
  gen: 'sortie du générateur',
  ch1: 'entrée CH1',
  ch2: 'entrée CH2',
  pot: 'potentiomètre',
  park1: 'support n° 1 du plateau',
  park2: 'support n° 2 du plateau',
  'tee1.a': 'Té n° 1 (bras gauche)',
  'tee1.b': 'Té n° 1 (bras droit)',
  'tee2.a': 'Té n° 2 (bras gauche)',
  'tee2.b': 'Té n° 2 (bras droit)',
}

/** Une fiche peut-elle aller sur cette embase ? (libre, pas un Té dans lui-même ni en boucle de Té) */
export function canPlug(c: Connections, male: Male, female: Female): boolean {
  if (Object.entries(c).some(([m, f]) => f === female && m !== male)) return false
  // Un support ne reçoit qu'un Té posé
  if (female.startsWith('park') && male !== 'tee1' && male !== 'tee2') return false
  if (male === 'tee1' || male === 'tee2') {
    // Remonter la chaîne des Té depuis l'embase visée : on ne doit pas retomber sur ce Té
    let f: Female | undefined = female
    for (let guard = 0; f && guard < 4; guard++) {
      const owner: TeeId | null = f.startsWith('tee') ? (f.slice(0, 4) as TeeId) : null
      if (!owner) return true
      if (owner === male) return false
      f = c[owner]
    }
  }
  return true
}

/** Débranche une fiche ; un Té retiré emporte ce qui était branché sur ses bras */
export function unplugDeep(c: Connections, m: Male): Connections {
  const next = { ...c }
  delete next[m]
  if (m === 'tee1' || m === 'tee2') for (const arm of femalesOf(m)) for (const [k, f] of Object.entries(next)) if (f === arm) delete next[k as Male]
  return next
}

/** Branche une fiche sur une embase (la retire d'abord de là où elle était) ; inchangé si impossible */
export const plugInto = (c: Connections, m: Male, f: Female): Connections => (canPlug(c, m, f) ? { ...unplugDeep(c, m), [m]: f } : c)

/* ─────────────── Graphe électrique ─────────────── */

export type LoadKind = Plug | 'pot' | 'scope'
export interface NodeInfo {
  loads: LoadKind[]
  /** Voies d'oscilloscope branchées sur ce nœud */
  channels: (0 | 1)[]
}

export interface Topology {
  ok: boolean
  /** Raison d'un montage non pris en charge */
  error?: string
  /** Générateur relié à au moins une ligne ou une voie */
  genConnected: boolean
  /** Ligne entre A et B : câble long, cordon, ou aucune */
  line: 'coax' | 'cordon' | null
  /** Le cordon entre le générateur et A est transparent (adapté) */
  cordToA: boolean
  A: NodeInfo
  B: NodeInfo | null
  /** Ce que voit chaque voie : nœud A, nœud B, une ligne sans signal, ou rien sur la BNC */
  observe: [Obs, Obs]
  /** Potentiomètre relié à quelque chose (l'ohmmètre ne peut pas le lire) */
  potConnected: boolean
}
export type Obs = 'A' | 'B' | 'flat' | 'none'

const empty = (): NodeInfo => ({ loads: [], channels: [] })

/** Montage → topologie réduite. Ne lève jamais d'exception. */
export function topology(c: Connections): Topology {
  // Points : embases femelles + fiches mâles ; union-find
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    let r = x
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!
    if (!parent.has(x)) parent.set(x, x)
    return r
  }
  const union = (a: string, b: string) => {
    const [ra, rb] = [find(a), find(b)]
    if (ra !== rb) parent.set(ra, rb)
  }
  for (const p of [...ALL_FEMALES, ...MALES]) find(p)
  for (const [m, f] of Object.entries(c) as [Male, Female][]) if (f) union(m, f)
  // Un Té relie son pied et ses deux bras
  for (const t of TEES) for (const arm of femalesOf(t)) union(t, arm)

  // Lignes : chaque câble relie les nœuds de ses deux bouts (un bout libre est son propre nœud, ouvert)
  const lines = (['cordon', 'coax'] as const).map((k) => ({ kind: k, a: find(`${k}.A`), b: find(`${k}.B`) }))
  const isWired = (k: 'cordon' | 'coax') => !!c[`${k}.A`] || !!c[`${k}.B`]
  const loadsAt = (node: string): NodeInfo => {
    const n = empty()
    for (const p of ['b50', 'b75', 'cc'] as const) if (c[p] && find(p) === node) n.loads.push(p)
    if (find('pot') === node && Object.values(c).includes('pot')) n.loads.push('pot')
    ;(['ch1', 'ch2'] as const).forEach((ch, i) => {
      if (find(ch) === node && Object.values(c).includes(ch)) {
        n.loads.push('scope')
        n.channels.push(i as 0 | 1)
      }
    })
    return n
  }
  const potConnected = Object.values(c).includes('pot')
  const chPlugged = (['ch1', 'ch2'] as const).map((ch) => Object.values(c).includes(ch))
  const flatObs = (): [Obs, Obs] => [chPlugged[0] ? 'flat' : 'none', chPlugged[1] ? 'flat' : 'none']
  const fail = (error: string, genConnected = true): Topology => ({ ok: false, error, genConnected, line: null, cordToA: false, A: empty(), B: null, observe: flatObs(), potConnected })

  for (const l of lines) if (isWired(l.kind) && l.a === l.b) return fail(`Les deux bouts du ${l.kind === 'coax' ? 'câble long' : 'cordon'} sont reliés au même point : boucle non prise en charge.`)

  const G = find('gen')
  const genPlugged = Object.values(c).includes('gen')
  const linesAt = (node: string, except?: string) => lines.filter((l) => l.kind !== except && (l.a === node || l.b === node))
  const other = (l: (typeof lines)[number], node: string) => (l.a === node ? l.b : l.a)

  if (!genPlugged) return { ok: true, genConnected: false, line: null, cordToA: false, A: empty(), B: null, observe: flatObs(), potConnected }

  // Cordon transparent : seul élément au contact du générateur
  const fromG = linesAt(G)
  const gLoads = loadsAt(G)
  let A = G
  let cordToA = false
  if (fromG.length === 1 && fromG[0]!.kind === 'cordon' && gLoads.loads.length === 0) {
    A = other(fromG[0]!, G)
    cordToA = true
  }
  const fromA = linesAt(A, cordToA ? 'cordon' : undefined)
  if (fromA.length > 1) return fail('Deux câbles partent du même point : montage en étoile non pris en charge (un seul câble après le Té).')
  const L = fromA[0]
  const B = L ? other(L, A) : null
  if (B !== null && linesAt(B, L!.kind).length > 0) return fail('Deux câbles en série : montage non pris en charge (le banc n’a qu’une ligne entre le Té et l’extrémité).')

  const obs = (i: 0 | 1): Obs => {
    const ch = i === 0 ? 'ch1' : 'ch2'
    if (!chPlugged[i]) return 'none'
    if (find(ch) === A) return 'A'
    if (B !== null && find(ch) === B) return 'B'
    return 'flat'
  }
  return {
    ok: true,
    genConnected: A !== G || fromG.length > 0 || gLoads.channels.length > 0,
    line: L ? L.kind : null,
    cordToA,
    A: loadsAt(A),
    B: B !== null ? loadsAt(B) : null,
    observe: [obs(0), obs(1)],
    potConnected,
  }
}

/* ─────────────── Topologie → sources de l'oscilloscope ─────────────── */

export interface GenSettings {
  on: boolean
  /** Fém réglée à vide — V */
  eg: number
  wave: Waveform
}

const par = (zs: number[]) => (zs.length === 0 ? Infinity : 1 / zs.reduce((s, z) => s + (z === Infinity ? 0 : 1 / z), 0))
const impedanceOf = (k: LoadKind, potR: number): number =>
  k === 'b50' ? RES3.bouchons[0] : k === 'b75' ? RES3.bouchons[1] : k === 'cc' ? 0 : k === 'pot' ? potR : OSCILLO.rEntree
/** Impédance d'un nœud : charges en parallèle (∞ si aucune) */
export const nodeImpedance = (n: NodeInfo, potR: number) => par(n.loads.map((k) => impedanceOf(k, potR)))

/** Sources vues par CH1 et CH2 (null = rien sur la BNC, signal nul si la voie n'est pas reliée au générateur). */
export function benchSources(t: Topology, gen: GenSettings, cable: Cable, potR: number): [SignalSource | null, SignalSource | null] {
  const flat = termsSource([], gen.wave)
  const pick = (o: Obs, s: { ch1: SignalSource; end: SignalSource } | null) => (o === 'none' ? null : !s || o === 'flat' ? flat : o === 'A' ? s.ch1 : s.end)
  if (!t.ok || !gen.on || !t.genConnected) return [pick(t.observe[0], null), pick(t.observe[1], null)]
  const zA = nodeImpedance(t.A, potR)
  let s: { ch1: SignalSource; end: SignalSource }
  if (!t.line) {
    // Pas de ligne : nœud A chargé directement (ligne de longueur nulle)
    s = coaxSources({ Eg: gen.eg, Zg: RES3.zg, Zc: RES3.zg, l: 0, ZL: zA, alpha: 0, wave: gen.wave })
  } else {
    // Charges au nœud A : équivalent de Thévenin de la source
    const eg = zA === Infinity ? gen.eg : (gen.eg * zA) / (RES3.zg + zA)
    const zg = zA === Infinity ? RES3.zg : (RES3.zg * zA) / (RES3.zg + zA)
    const coax = t.line === 'coax'
    const type = RES3.cables[cable.type]
    const alpha = !coax ? 0 : gen.wave.kind === 'pulse' ? type.alpha10M : alphaAt(type, gen.wave.f)
    const ZL = t.B ? nodeImpedance(t.B, potR) : Infinity
    s = coaxSources({ Eg: eg, Zg: zg, Zc: coax ? cable.Zc : RES3.cables.RG58.zc, l: coax ? cable.l : RES3.lCordon, ZL, alpha, wave: gen.wave })
  }
  return [pick(t.observe[0], s), pick(t.observe[1], s)]
}

/** Lecture de l'ohmmètre sur le potentiomètre : null s'il est relié à quelque chose ; ±0,5 % propre à la valeur */
export function ohmmeterReading(seed: number, potR: number, potConnected: boolean): number | null {
  return potConnected ? null : potR * (1 + (2 * mulberry32(seed + Math.round(potR * 10))() - 1) * RES3.ohmmetreTol)
}

/* ─────────────── Montages attendus du fascicule ─────────────── */

export type Extremity = 'ouverte' | 'cc' | 'pot' | 'zc' | 'zc+ch2'

/** Montage attendu d'une étape ; `vide` = générateur à vide sur CH1, sans câble long */
export type ExpectedMontage = { kind: 'vide' } | { kind: 'ligne'; end: Extremity }

const LOAD_FR: Record<LoadKind, string> = { b50: 'bouchon 50 Ω', b75: 'bouchon 75 Ω', cc: 'court-circuit', pot: 'potentiomètre', scope: 'entrée d’oscilloscope' }

/** Phrase décrivant un montage (affichée sous le banc) */
export function describe(t: Topology): string {
  if (!t.ok) return `Montage non pris en charge : ${t.error}`
  if (!t.genConnected) return 'Le générateur n’est relié à rien : trace plate.'
  const node = (n: NodeInfo) => [...n.channels.map((c) => `CH${c + 1}`), ...n.loads.filter((k) => k !== 'scope').map((k) => LOAD_FR[k])].join(' + ')
  const a = `générateur${t.cordToA ? ' → cordon' : ''} → ${node(t.A) || 'rien'}`
  if (!t.line) return a
  return `${a} → ${t.line === 'coax' ? 'câble long' : 'cordon'} → ${(t.B && node(t.B)) || 'extrémité ouverte'}`
}

/** Écarts entre le montage et celui attendu (vide = conforme) */
export function checkMontage(t: Topology, e: ExpectedMontage, cableZc: number): string[] {
  const ko: string[] = []
  if (!t.ok) return [t.error ?? 'montage non pris en charge']
  if (!t.genConnected) return ['le générateur n’est relié à rien']
  if (t.observe[0] !== 'A') ko.push(t.observe[0] === 'B' ? 'CH1 est au bout du câble : mettez un Té sur CH1, côté générateur' : 'CH1 ne voit pas la sortie du générateur (Té sur CH1 relié au générateur)')
  if (e.kind === 'vide') {
    if (t.line === 'coax') ko.push('débranchez le câble long : le générateur doit être à vide')
    const extra = t.A.loads.filter((k) => k !== 'scope')
    if (extra.length) ko.push(`rien d’autre que CH1 sur la sortie (retirez : ${extra.map((k) => LOAD_FR[k]).join(', ')})`)
    return ko
  }
  if (t.line !== 'coax') ko.push('le câble long doit partir du Té de CH1')
  const aExtra = t.A.loads.filter((k) => k !== 'scope')
  if (aExtra.length) ko.push(`côté générateur, retirez : ${aExtra.map((k) => LOAD_FR[k]).join(', ')}`)
  const b = t.B ?? empty()
  const bLoads = b.loads.filter((k) => k !== 'scope')
  const zcPlug: Plug = cableZc === RES3.bouchons[0] ? 'b50' : 'b75'
  const want: Record<Extremity, { loads: LoadKind[]; ch2: boolean; text: string }> = {
    ouverte: { loads: [], ch2: false, text: 'extrémité ouverte (rien au bout du câble)' },
    cc: { loads: ['cc'], ch2: false, text: 'court-circuit au bout du câble (bouchon CC ou potentiomètre à 0 Ω)' },
    pot: { loads: ['pot'], ch2: false, text: 'potentiomètre au bout du câble' },
    zc: { loads: [zcPlug], ch2: false, text: `bouchon de ${cableZc} Ω au bout du câble` },
    'zc+ch2': { loads: [zcPlug], ch2: true, text: `Té au bout du câble avec bouchon de ${cableZc} Ω et CH2` },
  }
  const w = want[e.end]
  const loadsOk = (e.end === 'cc' && bLoads.length === 1 && (bLoads[0] === 'cc' || bLoads[0] === 'pot')) || (bLoads.length === w.loads.length && w.loads.every((k) => bLoads.includes(k as Plug | 'pot')))
  if (!loadsOk) ko.push(`attendu : ${w.text}${bLoads.length ? ` (actuellement : ${bLoads.map((k) => LOAD_FR[k]).join(', ')})` : ''}`)
  if (w.ch2 && t.observe[1] !== 'B') ko.push('CH2 doit être au bout du câble (sur le Té du bout)')
  if (!w.ch2 && t.observe[1] === 'B' && e.end !== 'ouverte') ko.push('CH2 au bout du câble : retirez-le pour cette étape')
  return ko
}

/** Montage du fascicule 3.2.2 b, pour « tout brancher » et les tests */
export const MONTAGE_322B: Connections = { 'cordon.A': 'gen', tee1: 'ch1', 'cordon.B': 'tee1.a', 'coax.A': 'tee1.b' }
