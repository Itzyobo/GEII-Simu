/**
 * Configuration MCC Classic (étape 2) : System Module et Pin Module.
 * Données pures, sérialisables (persistance JSON), sans React.
 */
import { INFO3 } from '../../data/reference'

export type Oscillator = 'HFINTOSC' | 'LFINTOSC'
export type PackageName = keyof typeof INFO3.mcc.packages
export type Direction = 'input' | 'output'

export interface SystemConfig {
  oscillator: Oscillator
  /** Fréquence HFINTOSC — MHz (1, 2, 4, 8, 12, 16, 32) */
  hfMHz: number
  /** Clock Divider : puissance de 2 de 1 à 512 */
  divider: number
  /** Low-voltage programming enable */
  lvp: boolean
}

export interface PinConfig {
  /** Broche : RA4, RB4… */
  pin: string
  direction: Direction
  customName: string
  startHigh: boolean
  analog: boolean
  wpu: boolean
  od: boolean
  /** Colonne IOC de Pin Module (none par défaut ; jamais sur le port D) */
  ioc?: IocEdge
}

export type IocEdge = 'none' | 'positive' | 'negative' | 'any'
export const IOC_EDGES: readonly IocEdge[] = ['none', 'positive', 'negative', 'any']

/** IOC disponible sur la broche (pas d'IOC sur le port D, RE3 seule sur le port E) */
export const iocAvailable = (pin: string) => (INFO3.interrupts.iocPorts as readonly string[]).includes(pin[1]) && (pin[1] !== 'E' || pin === INFO3.mcc.mclrPin)

/** Règle la colonne IOC ; refusé (configuration inchangée) sur le port D */
export function setIoc(cfg: MccConfig, pin: string, edge: IocEdge): MccConfig {
  if (!iocAvailable(pin)) return cfg
  return { ...cfg, pins: cfg.pins.map((p) => (p.pin === pin ? { ...p, ioc: edge } : p)) }
}

/** IOC effective d'une broche */
export const iocOf = (p: PinConfig): IocEdge => (iocAvailable(p.pin) ? (p.ioc ?? 'none') : 'none')

export interface MccConfig {
  version: 1
  system: SystemConfig
  /** Broches sélectionnées dans le Grid View, dans l'ordre d'ajout */
  pins: PinConfig[]
  /** Boîtier du Pin Manager : Grid View (UQFN40 par défaut, comme sur les captures du CR) */
  package?: PackageName
  /** Interrupt Module : ordre de la table Interrupt Vector (identifiants de source) */
  interruptOrder?: string[]
  /** Interrupt Module : sources décochées dans la colonne Enabled */
  interruptsDisabled?: string[]
  /** Interrupt Module : « Single ISR per interrupt » (coché par défaut) */
  singleIsr?: boolean
}

export const MCC_VERSION = 1 as const

export function defaultMccConfig(): MccConfig {
  const d = INFO3.mcc.defaultSystem
  return { version: MCC_VERSION, system: { oscillator: d.oscillator as Oscillator, hfMHz: d.hfMHz, divider: d.divider, lvp: d.lvp }, pins: [] }
}

/** Diviseurs proposés : 1, 2, 4… 512 */
export const DIVIDERS: number[] = Array.from({ length: Math.log2(INFO3.clock.maxDivider) + 1 }, (_, i) => 2 ** i)

/** Fosc résultant du System Module — Hz */
export function systemFosc(s: SystemConfig): number {
  const base = s.oscillator === 'LFINTOSC' ? INFO3.clock.lfintosc : s.hfMHz * INFO3.units.usPerS
  return base / s.divider
}

/** Boîtier effectif (UQFN40 si non précisé) */
export const packageOf = (cfg: MccConfig): PackageName => cfg.package ?? (INFO3.mcc.defaultPackage as PackageName)

/** Numéro de broche dans le boîtier sélectionné */
export const pinNumber = (cfg: MccConfig, pin: string): number | undefined => INFO3.mcc.packages[packageOf(cfg)][pin]

/** Ordre des broches : port puis numéro (RA0…RA7, RB0…, RE3) */
export const pinOrder = (a: string, b: string) => (a[1] === b[1] ? Number(a[2]) - Number(b[2]) : a[1] < b[1] ? -1 : 1)

/** Nom proposé par MCC pour une broche ajoutée : IO_RA4 */
export const defaultName = (pin: string) => `IO_${pin}`

/**
 * Clic sur un cadenas du Grid View : sélectionne la broche en entrée ou en sortie (une seule direction),
 * ou la désélectionne si on reclique sur le même cadenas. « Analog » par défaut selon H23.
 */
export function toggleGridPin(cfg: MccConfig, pin: string, direction: Direction): MccConfig {
  if (direction === 'output' && (INFO3.mcc.inputOnly as readonly string[]).includes(pin)) return cfg
  const existing = cfg.pins.find((p) => p.pin === pin)
  if (existing && existing.direction === direction) return { ...cfg, pins: cfg.pins.filter((p) => p.pin !== pin) }
  const analog = direction === 'input' ? INFO3.mcc.analogDefault.input : INFO3.mcc.analogDefault.output
  if (existing) return { ...cfg, pins: cfg.pins.map((p) => (p.pin === pin ? { ...p, direction, analog } : p)) }
  return { ...cfg, pins: [...cfg.pins, { pin, direction, customName: defaultName(pin), startHigh: false, analog, wpu: false, od: false }] }
}

export function updatePin(cfg: MccConfig, pin: string, patch: Partial<Omit<PinConfig, 'pin'>>): MccConfig {
  return { ...cfg, pins: cfg.pins.map((p) => (p.pin === pin ? { ...p, ...patch } : p)) }
}

const C_KEYWORDS = new Set(
  'auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while _Bool'.split(' '),
)

/** Erreur d'un Custom Name (null si valide) : identifiant C, pas un mot-clé, unique */
export function customNameError(cfg: MccConfig, pin: PinConfig): string | null {
  const n = pin.customName
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) return `« ${n} » n'est pas un identifiant C valide`
  if (C_KEYWORDS.has(n)) return `« ${n} » est un mot-clé du C`
  if (cfg.pins.some((p) => p !== pin && p.customName === n)) return `« ${n} » est utilisé par plusieurs broches`
  return null
}

/** Erreurs qui empêchent Generate */
export function configErrors(cfg: MccConfig): string[] {
  const errors: string[] = []
  for (const p of cfg.pins) {
    const e = customNameError(cfg, p)
    if (e) errors.push(`${p.pin} : ${e}`)
  }
  if (!DIVIDERS.includes(cfg.system.divider)) errors.push(`Clock Divider ${cfg.system.divider} invalide`)
  if (cfg.system.oscillator === 'HFINTOSC' && !(INFO3.clock.hfintoscMHz as readonly number[]).includes(cfg.system.hfMHz)) errors.push(`HF Internal Clock ${cfg.system.hfMHz} MHz invalide`)
  return errors
}

/** Validation d'un objet inconnu (persistance) : renvoie une configuration sûre ou null */
export function parseMccConfig(x: unknown): MccConfig | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  if (o.version !== MCC_VERSION || !o.system || !Array.isArray(o.pins)) return null
  const s = o.system as Record<string, unknown>
  if ((s.oscillator !== 'HFINTOSC' && s.oscillator !== 'LFINTOSC') || typeof s.hfMHz !== 'number' || typeof s.divider !== 'number' || typeof s.lvp !== 'boolean') return null
  const pins: PinConfig[] = []
  for (const p of o.pins as unknown[]) {
    if (!p || typeof p !== 'object') return null
    const q = p as Record<string, unknown>
    if (typeof q.pin !== 'string' || !/^R[A-E][0-7]$/.test(q.pin)) return null
    if (q.direction !== 'input' && q.direction !== 'output') return null
    if (typeof q.customName !== 'string') return null
    const ioc = IOC_EDGES.includes(q.ioc as IocEdge) && q.ioc !== 'none' ? { ioc: q.ioc as IocEdge } : {}
    pins.push({ pin: q.pin, direction: q.direction, customName: q.customName, startHigh: !!q.startHigh, analog: !!q.analog, wpu: !!q.wpu, od: !!q.od, ...ioc })
  }
  const pkg = typeof o.package === 'string' && o.package in INFO3.mcc.packages ? (o.package as PackageName) : undefined
  const strList = (v: unknown) => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : undefined)
  const order = strList(o.interruptOrder)
  const disabled = strList(o.interruptsDisabled)
  return {
    version: MCC_VERSION,
    system: { oscillator: s.oscillator, hfMHz: s.hfMHz, divider: s.divider, lvp: s.lvp },
    pins,
    ...(pkg ? { package: pkg } : {}),
    ...(order ? { interruptOrder: order } : {}),
    ...(disabled ? { interruptsDisabled: disabled } : {}),
    ...(typeof o.singleIsr === 'boolean' ? { singleIsr: o.singleIsr } : {}),
  }
}
