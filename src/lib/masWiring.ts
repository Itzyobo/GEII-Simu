/**
 * Câblage du banc machine asynchrone — logique pure, sans React.
 * Les fils de puissance forment des équipotentielles ; les appareils de mesure (analyseur, pince, voltmètre)
 * ne font que relever l'endroit où ils sont posés et ne relient rien.
 */
import { MAS } from '../data/reference'
import type { Barrettes } from '../models/asyncMotor'
import type { Pair } from './wiring'

export type Objectif = 'reseau' | 'variateur'

const PH = [1, 2, 3] as const
type Ph = 1 | 2 | 3

/** Libellés des bornes câblables (identifiant → texte affiché). */
export const MAS_LABELS: Record<string, string> = {
  L1: 'L1',
  L2: 'L2',
  L3: 'L3',
  N: 'N',
  ...Object.fromEntries(PH.flatMap((k) => [[`c${k}i`, `E${k}`], [`c${k}o`, `S${k}`]])),
  ...Object.fromEntries(PH.flatMap((k) => [[`v${k}i`, MAS.bornesVariateur.entree[k - 1]], [`v${k}o`, MAS.bornesVariateur.sortie[k - 1]]])),
  U1: 'U1',
  V1: 'V1',
  W1: 'W1',
  anV: 'Analyseur V',
  anC: 'Analyseur COM',
  pince: 'Pince',
  mV: 'Voltmètre V',
  mC: 'Voltmètre COM',
  cplR: 'Couple +',
  cplB: 'Couple −',
}

const MOTOR = ['U1', 'V1', 'W1'] as const
const PROBES = new Set(['anV', 'anC', 'pince', 'mV', 'mC'])
const TORQUE = new Set(['cplR', 'cplB'])
const name = (id: string) => MAS_LABELS[id] ?? id
const idOfLabel = (label: string) => Object.keys(MAS_LABELS).find((id) => MAS_LABELS[id] === label)!

export interface MasWiring {
  /** Montage refusé à la vérification */
  errors: string[]
  /** Montage accepté (mise sous tension possible) mais non conforme : l'essai compte faux */
  faults: string[]
  /** Appareil qui alimente la MAS d'après le câblage */
  supply: 'commutateur' | 'variateur' | null
  /** Sens de rotation : 1 = normal, −1 = inversé (2 phases permutées), 0 = ne démarre pas (phase manquante) */
  rotation: 1 | -1 | 0
}

/** Analyse le câblage du banc pour l'objectif choisi (montage 1 réseau, montage 2 variateur). */
export function analyzeMasWiring(wires: readonly Pair[], objectif: Objectif, barrettes: Barrettes): MasWiring {
  const errors: string[] = []
  const faults: string[] = []

  // Appareils de mesure : chaque borne d'appareil va à un seul point, jamais sur un autre appareil
  const probeAt = new Map<string, string>()
  const power: Pair[] = []
  for (const [a, b] of wires) {
    const pa = PROBES.has(a)
    const pb = PROBES.has(b)
    if (pa && pb) errors.push(`Fil entre deux bornes d’appareils de mesure (${name(a)} – ${name(b)}).`)
    else if (pa || pb) {
      const [p, at] = pa ? [a, b] : [b, a]
      if (probeAt.has(p)) errors.push(`${name(p)} est relié à plusieurs points : un seul fil par borne d’appareil.`)
      probeAt.set(p, at)
    } else if (TORQUE.has(a) || TORQUE.has(b)) {
      errors.push(`Les bornes « couple » du pilote ne se relient qu’au voltmètre (${name(a)} – ${name(b)}).`)
    } else power.push([a, b])
  }

  // Équipotentielles de puissance : fils + liaison interne entrée k → sortie k du commutateur (bobine courant)
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    const p = parent.get(x) ?? x
    if (p === x) return x
    const r = find(p)
    parent.set(x, r)
    return r
  }
  const join = (a: string, b: string) => parent.set(find(a), find(b))
  for (const [a, b] of power) join(a, b)
  for (const k of PH) join(`c${k}i`, `c${k}o`)
  const net = (id: string) => find(id)
  const members = (id: string) => [...new Set([...parent.keys(), ...parent.values(), id])].filter((x) => net(x) === net(id))

  // Sources sur une même équipotentielle : court-circuit
  const nets = new Map<string, string[]>()
  for (const id of new Set(power.flat())) nets.set(net(id), members(id))
  for (const m of nets.values()) {
    const src = m.filter((x) => ['L1', 'L2', 'L3', 'N'].includes(x) || /^v\do$/.test(x))
    if (src.length > 1) errors.push(`Court-circuit : ${src.map(name).join(' et ')} sont reliés.`)
  }

  const reseauPhase = (id: string): Ph | null => {
    const m = nets.get(net(id)) ?? [id]
    const l = PH.find((k) => m.includes(`L${k}`))
    return l ?? null
  }
  const touches = (prefix: RegExp) => [...nets.values()].some((m) => m.some((x) => /^L\d$/.test(x)) && m.some((x) => prefix.test(x)))
  const viaCommutateur = touches(/^c\di$/)
  const viaVariateur = touches(/^v\di$/)
  if (viaCommutateur && viaVariateur) errors.push('Commutateur et variateur câblés en même temps : double alimentation refusée.')

  // Le variateur ne délivre ses 3 sorties (ordre U, V, W) que s'il reçoit les 3 phases du réseau
  const varIn = PH.map((k) => reseauPhase(`v${k}i`))
  const varOn = new Set(varIn.filter((p) => p !== null)).size === 3

  // Phase vue par chaque borne de la MAS, et chemin emprunté
  const fed = MOTOR.map((t) => {
    const m = nets.get(net(t)) ?? [t]
    const out = PH.find((k) => m.includes(`v${k}o`))
    if (out) return { phase: varOn ? out : null, via: 'variateur' as const }
    const p = reseauPhase(t)
    return { phase: p, via: m.some((x) => /^c\do$/.test(x)) ? ('commutateur' as const) : p ? ('direct' as const) : null }
  })
  const supply = viaVariateur && !viaCommutateur ? 'variateur' : viaCommutateur && !viaVariateur ? 'commutateur' : null

  const wanted = objectif === 'reseau' ? 'commutateur' : 'variateur'
  if (fed.every((f) => f.via === null)) errors.push('La MAS n’est pas raccordée : reliez U1, V1, W1.')
  if (supply && supply !== wanted)
    errors.push(objectif === 'reseau' ? 'Objectif montage 1 : alimentez la MAS par le commutateur, pas par le variateur.' : 'Objectif montage 2 : alimentez la MAS par le variateur, pas par le commutateur.')
  MOTOR.forEach((t, i) => {
    if (fed[i].via === 'direct') errors.push(`${t} est relié au réseau sans passer par le ${wanted} : le courant n’est pas mesuré.`)
  })

  // Phase manquante ou ordre des phases (fautes non bloquantes : on les observe sous tension)
  const phases = fed.map((f) => f.phase)
  let rotation: 1 | -1 | 0 = 1
  if (phases.some((p) => p === null) || new Set(phases).size < 3) {
    rotation = 0
    faults.push('Une phase manque aux bornes de la MAS.')
  } else {
    const [a, b] = phases as Ph[]
    rotation = (b - a + 3) % 3 === 1 ? 1 : -1
    if (rotation === -1) faults.push('Deux phases sont permutées.')
  }

  // Barrettes (contrôles déjà présents avant le banc)
  if (barrettes === 'aucune') errors.push('Boîte à bornes : barrettes absentes, le moteur n’est pas couplé.')
  if (supply === 'variateur' && barrettes === 'etoile') errors.push('Variateur : le moteur doit être couplé en triangle, l’étoile est refusée.')

  // Analyseur : pince et fils de tension
  const pince = probeAt.get('pince')
  const accepted = (objectif === 'reseau' ? MAS.pinceMontage1 : MAS.pinceMontage2).map(idOfLabel)
  const where = objectif === 'reseau' ? 'une sortie du commutateur' : 'une sortie du variateur'
  if (!pince || !accepted.includes(pince)) errors.push(`Pince de l’analyseur : à placer sur ${where}.`)
  const anV = probeAt.get('anV')
  const anC = probeAt.get('anC')
  if (MAS.tensionAnalyseur[objectif === 'reseau' ? 'montage1' : 'montage2'] === 'simple') {
    const pPince = pince ? reseauPhase(pince) : null
    if (!anV || anV === 'N' || reseauPhase(anV) === null || reseauPhase(anV) !== pPince) errors.push('Fil rouge de l’analyseur : sur la même phase que la pince.')
    if (anC !== 'N') errors.push('Fil noir de l’analyseur : sur le neutre N.')
  } else {
    const outs = PH.map((k) => `v${k}o`)
    if (!anV || !anC || !outs.includes(anV) || !outs.includes(anC) || anV === anC) errors.push('Fils de tension de l’analyseur : entre deux sorties du variateur.')
  }

  // Voltmètre de couple : rouge sur la borne rouge, noir sur la borne bleue
  if (probeAt.get('mV') !== 'cplR' || probeAt.get('mC') !== 'cplB') errors.push('Voltmètre : rouge sur la borne couple rouge, noir sur la borne couple bleue du pilote.')

  return { errors: [...new Set(errors)], faults, supply, rotation }
}
