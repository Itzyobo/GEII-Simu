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
  /** Timers ajoutés depuis Device Resources (TMR2, TMR4, TMR6) */
  timers?: Partial<Record<TimerId, TimerConfig>>
  /** MSSP1 en SPI maître (Device Resources › MSSP1) */
  mssp?: MsspConfig
  /** CCP1 en mode PWM, PWM6, PWM7 (Device Resources › CCP, PWM) */
  pwm?: Partial<Record<PwmId, PwmConfig>>
  /** EUSART asynchrone (Device Resources › EUSART) */
  eusart?: EusartConfig
}

/* ───────────── CCP1 (PWM), PWM6, PWM7 ───────────── */

export type PwmId = 'CCP1' | 'PWM6' | 'PWM7'
export const PWM_IDS: readonly PwmId[] = INFO3.pwm.modules.map((m) => m.id as PwmId)
export type PwmPolarity = 'active_hi' | 'active_lo'

export interface PwmConfig {
  /** Enable PWM (PWM6/7) ; CCP1 : toujours actif en mode PWM */
  enabled: boolean
  /** Timer Select (TMR2, TMR4, TMR6) */
  timer: TimerId
  /** Duty Cycle initial — % */
  dutyCycle: number
  /** Output Polarity (PWM6/7) */
  polarity: PwmPolarity
  /** CCPR Alignment (CCP1) : right_aligned (CCP1FMT = 0) ou left_aligned */
  alignment?: 'right_aligned' | 'left_aligned'
  /** Broche de sortie (PPS), Grid View */
  pin: string | null
}

export const defaultPwmConfig = (id: PwmId): PwmConfig => {
  const d = INFO3.pwm.mccDefault
  return { enabled: d.enabled, timer: d.timer as TimerId, dutyCycle: d.dutyCycle, polarity: d.polarity as PwmPolarity, ...(id === 'CCP1' ? { alignment: 'right_aligned' as const } : {}), pin: INFO3.pwm.defaultPins[id] ?? null }
}
export const addPwm = (cfg: MccConfig, id: PwmId): MccConfig => (cfg.pwm?.[id] ? cfg : { ...cfg, pwm: { ...cfg.pwm, [id]: defaultPwmConfig(id) } })
export function removePwm(cfg: MccConfig, id: PwmId): MccConfig {
  const pwm = { ...cfg.pwm }
  delete pwm[id]
  return { ...cfg, pwm }
}
export const updatePwm = (cfg: MccConfig, id: PwmId, patch: Partial<PwmConfig>): MccConfig => (cfg.pwm?.[id] ? { ...cfg, pwm: { ...cfg.pwm, [id]: { ...cfg.pwm[id]!, ...patch } } } : cfg)

function parsePwm(id: PwmId, x: unknown): PwmConfig | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  const d = defaultPwmConfig(id)
  return {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : d.enabled,
    timer: TIMER_IDS.includes(o.timer as TimerId) ? (o.timer as TimerId) : d.timer,
    dutyCycle: typeof o.dutyCycle === 'number' && o.dutyCycle >= 0 && o.dutyCycle <= 100 ? o.dutyCycle : d.dutyCycle,
    polarity: o.polarity === 'active_lo' ? 'active_lo' : 'active_hi',
    ...(id === 'CCP1' ? { alignment: o.alignment === 'left_aligned' ? ('left_aligned' as const) : ('right_aligned' as const) } : {}),
    pin: o.pin === null || (typeof o.pin === 'string' && /^R[A-E][0-7]$/.test(o.pin)) ? (o.pin as string | null) : d.pin,
  }
}

/* ───────────── EUSART ───────────── */

export interface EusartConfig {
  /** Enable EUSART (SPEN), Enable Transmit (TXEN), Enable Receive (CREN) */
  enable: boolean
  transmit: boolean
  receive: boolean
  /** Baud Rate demandé */
  baud: number
  /** « Redirect STDIO to USART » (cours p. 110) */
  redirectStdio: boolean
  /** Enable EUSART Interrupts */
  interrupts: boolean
  /** TX1 et RX1 (PPS), Grid View */
  pins: { TX1: string | null; RX1: string | null }
}

export const defaultEusartConfig = (): EusartConfig => ({ ...INFO3.eusart.mccDefault, pins: { ...INFO3.eusart.defaultPins } })
export const addEusart = (cfg: MccConfig): MccConfig => (cfg.eusart ? cfg : { ...cfg, eusart: defaultEusartConfig() })
export function removeEusart(cfg: MccConfig): MccConfig {
  const rest = { ...cfg }
  delete rest.eusart
  return rest
}
export const updateEusart = (cfg: MccConfig, patch: Partial<EusartConfig>): MccConfig => (cfg.eusart ? { ...cfg, eusart: { ...cfg.eusart, ...patch } } : cfg)

function parseEusart(x: unknown): EusartConfig | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  const d = defaultEusartConfig()
  const out = { ...d } as unknown as Record<string, unknown>
  for (const [k, v] of Object.entries(d)) if (k !== 'pins' && typeof o[k] === typeof v) out[k] = o[k]
  const op = (o.pins ?? {}) as Record<string, unknown>
  const pins = { ...d.pins }
  for (const k of ['TX1', 'RX1'] as const) if (op[k] === null || (typeof op[k] === 'string' && /^R[A-E][0-7]$/.test(op[k] as string))) pins[k] = op[k] as string | null
  out.pins = pins
  return out as unknown as EusartConfig
}

/* ───────────── MSSP1 (SPI) ───────────── */

export type SpiSignal = 'SCK1' | 'SDI1' | 'SDO1'
export const SPI_SIGNALS: readonly SpiSignal[] = ['SCK1', 'SDI1', 'SDO1']

export interface MsspConfig {
  /** SPI Mode 0 à 3 */
  mode: number
  /** Input Data Sampled at : Middle ou End */
  sample: string
  /** Clock Source (libellé MCC) */
  clockSource: string
  /** Clock Divider = SSP1ADD (Clock Source FOSC/4_SSPxADD) */
  divider: number
  /** Broches choisies dans le Grid View (PPS) */
  pins: Record<SpiSignal, string | null>
}

export const defaultMsspConfig = (): MsspConfig => ({ ...INFO3.spi.mccDefault, pins: { ...INFO3.spi.defaultPins } })
export const addMssp = (cfg: MccConfig): MccConfig => (cfg.mssp ? cfg : { ...cfg, mssp: defaultMsspConfig() })
export const removeMssp = (cfg: MccConfig): MccConfig => {
  const rest = { ...cfg }
  delete rest.mssp
  return rest
}
export const updateMssp = (cfg: MccConfig, patch: Partial<MsspConfig>): MccConfig => (cfg.mssp ? { ...cfg, mssp: { ...cfg.mssp, ...patch } } : cfg)

function parseMssp(x: unknown): MsspConfig | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  const d = defaultMsspConfig()
  const pins = { ...d.pins }
  const op = (o.pins ?? {}) as Record<string, unknown>
  for (const s of SPI_SIGNALS) if (op[s] === null || (typeof op[s] === 'string' && /^R[A-E][0-7]$/.test(op[s] as string))) pins[s] = op[s] as string | null
  return {
    mode: typeof o.mode === 'number' && INFO3.spi.modes.some((m) => m.mode === o.mode) ? o.mode : d.mode,
    sample: typeof o.sample === 'string' && (INFO3.spi.sampleOptions as readonly string[]).includes(o.sample) ? o.sample : d.sample,
    clockSource: typeof o.clockSource === 'string' && INFO3.spi.clockSources.some((c) => c.label === o.clockSource) ? o.clockSource : d.clockSource,
    divider: typeof o.divider === 'number' ? o.divider : d.divider,
    pins,
  }
}

/* ───────────── Timers 2, 4, 6 (Device Resources) ───────────── */

export type TimerId = 'TMR2' | 'TMR4' | 'TMR6'
export const TIMER_IDS: readonly TimerId[] = INFO3.timers.ids.map((n) => `TMR${n}` as TimerId)
export const timerNumber = (id: TimerId) => Number(id.slice(3))

export interface TimerConfig {
  /** Hardware Settings */
  enabled: boolean
  controlMode: string
  /** Libellé générique (« Starts on falling edge on {ers} ») */
  startOption: string
  /** Libellé générique (« T{n}CKIPPS pin ») */
  ersSource: string
  /** Timer Clock */
  clockSource: string
  clockSync: boolean
  polarity: string
  prescaler: number
  prescalerSync: boolean
  postscaler: number
  /** Timer Period demandée — s */
  periodS: number
  /** Software Settings : Enable Timer Interrupt */
  interrupt: boolean
  /** Entrée TxIN choisie dans le Grid View (écrit TxINPPS) */
  ersPin?: string
}

export const defaultTimerConfig = (): TimerConfig => ({ ...INFO3.timers.mccDefault })

export function addTimer(cfg: MccConfig, id: TimerId): MccConfig {
  if (cfg.timers?.[id]) return cfg
  return { ...cfg, timers: { ...cfg.timers, [id]: defaultTimerConfig() } }
}

export function removeTimer(cfg: MccConfig, id: TimerId): MccConfig {
  const timers = { ...cfg.timers }
  delete timers[id]
  return { ...cfg, timers }
}

export function updateTimer(cfg: MccConfig, id: TimerId, patch: Partial<TimerConfig>): MccConfig {
  const cur = cfg.timers?.[id]
  if (!cur) return cfg
  return { ...cfg, timers: { ...cfg.timers, [id]: { ...cur, ...patch } } }
}

function parseTimer(x: unknown): TimerConfig | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  const d = defaultTimerConfig()
  const out = { ...d } as unknown as Record<string, unknown>
  for (const [k, v] of Object.entries(d)) if (typeof o[k] === typeof v) out[k] = o[k]
  if (typeof o.ersPin === 'string' && /^R[A-E][0-7]$/.test(o.ersPin)) out.ersPin = o.ersPin
  return out as unknown as TimerConfig
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
  const timers: Partial<Record<TimerId, TimerConfig>> = {}
  if (o.timers && typeof o.timers === 'object') {
    for (const id of TIMER_IDS) {
      const t = parseTimer((o.timers as Record<string, unknown>)[id])
      if (t) timers[id] = t
    }
  }
  return {
    version: MCC_VERSION,
    system: { oscillator: s.oscillator, hfMHz: s.hfMHz, divider: s.divider, lvp: s.lvp },
    pins,
    ...(pkg ? { package: pkg } : {}),
    ...(order ? { interruptOrder: order } : {}),
    ...(disabled ? { interruptsDisabled: disabled } : {}),
    ...(typeof o.singleIsr === 'boolean' ? { singleIsr: o.singleIsr } : {}),
    ...(Object.keys(timers).length ? { timers } : {}),
    ...(o.mssp ? { mssp: parseMssp(o.mssp) ?? defaultMsspConfig() } : {}),
    ...(() => {
      const pwm: Partial<Record<PwmId, PwmConfig>> = {}
      const op = (o.pwm ?? {}) as Record<string, unknown>
      for (const id of PWM_IDS) {
        const v = parsePwm(id, op[id])
        if (v) pwm[id] = v
      }
      return Object.keys(pwm).length ? { pwm } : {}
    })(),
    ...(o.eusart ? { eusart: parseEusart(o.eusart) ?? defaultEusartConfig() } : {}),
  }
}
