/** Configurations MCC de départ, construites comme dans MCC (Grid View puis Pin Module) depuis INFO3.pins */
import { INFO3 } from '../../data/reference'
import { addAdcc, addEusart, addMssp, addPwm, addTimer, defaultMccConfig, PWM_IDS, updateAdcc, updateEusart, setIoc, toggleGridPin, updateMssp, updatePin, updateTimer, type Direction, type MccConfig, type TimerConfig } from './config'
import { periodForRegister } from './timers'

export function namedPin(cfg: MccConfig, pin: string, dir: Direction, name: string, analog?: boolean): MccConfig {
  let c = toggleGridPin(cfg, pin, dir)
  c = updatePin(c, pin, { customName: name })
  if (analog !== undefined) c = updatePin(c, pin, { analog })
  return c
}

/** TP1 complet : LED_D2…LED_D5 en sortie, BP_S1 et BP_S2 en entrée numérique (Analog décoché) */
export function tp1Config(): MccConfig {
  const P = INFO3.tp1.namePrefix
  let c = defaultMccConfig()
  for (const l of INFO3.pins.leds) c = namedPin(c, l.pin, 'output', `${P.led}${l.name}`)
  for (const b of INFO3.pins.buttons) c = namedPin(c, b.pin, 'input', `${P.button}${b.name}`, false)
  return c
}

/** TP2 §1 : TP1 + IOC « negative » sur BP_S1 (RB4) et BP_S2 (RC5) */
export function tp21Config(): MccConfig {
  let c = tp1Config()
  for (const b of INFO3.pins.buttons) c = setIoc(c, b.pin, 'negative')
  return c
}

/** TP2 §2.2 : tp2-1 + ENCA (RD1) et ENCB (RA2) en entrée numérique (Rotary sur le mikroBUS 2) */
export function tp22Config(): MccConfig {
  const r = INFO3.pins.rotary
  let c = tp21Config()
  c = namedPin(c, r.ENCA, 'input', 'ENCA', false)
  c = namedPin(c, r.ENCB, 'input', 'ENCB', false)
  return c
}

/** TP2 §2.3 : tp2-2 + IOC « any » sur ENCB (pas d'IOC possible sur ENCA, port D) */
export function tp23Config(): MccConfig {
  return setIoc(tp22Config(), INFO3.pins.rotary.ENCB, 'any')
}

/** TP4 §1 : LED_D2…D5, BP_S1/S2 (TP1) + MSSP1 en SPI maître, Fosc/4, mode au choix (SCK1 RB1, SDI1 RB2, SDO1 RB3) */
export function tp41Config(mode = 3): MccConfig {
  return updateMssp(addMssp(tp1Config()), { mode, clockSource: 'FOSC/4' })
}

/** TP4 §2 et suite : tp4-1 + RST (RD2) et LATCH (RD3) en sortie numérique (carte Rotary sur le mikroBUS 2) */
export function tp42Config(mode = 0): MccConfig {
  const r = INFO3.pins.rotary
  let c = tp41Config(mode)
  c = namedPin(c, r.RST, 'output', 'RST')
  c = namedPin(c, r.LATCH, 'output', 'LATCH')
  return c
}

/** TP4 §5 : tp4-2 + ENCA, ENCB en entrée numérique et IOC « any » sur ENCB (comme au TP2) */
export function tp45Config(mode = 0): MccConfig {
  const r = INFO3.pins.rotary
  let c = tp42Config(mode)
  c = namedPin(c, r.ENCA, 'input', 'ENCA', false)
  c = namedPin(c, r.ENCB, 'input', 'ENCB', false)
  return setIoc(c, r.ENCB, 'any')
}

/**
 * TP5 §1 : TMR2 en FOSC/4, prescaler au choix (1:16 → 4,096 ms à 4 MHz), PR2 = 0xFF, sans interruption ;
 * PWM6 → RD4 (R), PWM7 → RC0 (G), CCP1 → RC1 (B) sur TMR2, rapport cyclique initial 0.
 */
export function tp51PwmConfig(prescaler = 16): MccConfig {
  let c = updateTimer(addTimer(defaultMccConfig(), 'TMR2'), 'TMR2', { clockSource: 'FOSC/4', prescaler, postscaler: 1, interrupt: false })
  c = updateTimer(c, 'TMR2', { periodS: periodForRegister(c, c.timers!.TMR2!, (1 << INFO3.c.bitsPerByte) - 1) })
  for (const id of PWM_IDS) c = addPwm(c, id)
  return c
}

/** TP5 §1 complet : PWM (tp51PwmConfig) + EUSART 9600 bauds, TX1 RC6, RX1 RC7, « Redirect STDIO to USART » */
export function tp51Config(prescaler = 16, interrupts = false): MccConfig {
  return updateEusart(addEusart(tp51PwmConfig(prescaler)), { redirectStdio: true, interrupts })
}

/** TP5 §3 : tp5-1 + BP_S1, BP_S2 en entrée numérique avec IOC « negative », LED_D3, LED_D4, LED_D5 en sortie */
export function tp53Config(): MccConfig {
  const P = INFO3.tp1.namePrefix
  let c = tp51Config()
  for (const name of INFO3.tp5.stateLeds) c = namedPin(c, INFO3.pins.leds.find((l) => l.name === name)!.pin, 'output', `${P.led}${name}`)
  for (const b of INFO3.pins.buttons) c = setIoc(namedPin(c, b.pin, 'input', `${P.button}${b.name}`, false), b.pin, 'negative')
  return c
}

/** TP5 §4 : tp5-3 + carte Rotary (mikroBUS 2) : MSSP1 en SPI mode 0, RST et LATCH en sortie, ENCA, ENCB, IOC « any » sur ENCB */
export function tp54Config(): MccConfig {
  const r = INFO3.pins.rotary
  let c = updateMssp(addMssp(tp53Config()), { mode: 0, clockSource: 'FOSC/4' })
  c = namedPin(c, r.RST, 'output', 'RST')
  c = namedPin(c, r.LATCH, 'output', 'LATCH')
  c = namedPin(c, r.ENCA, 'input', 'ENCA', false)
  c = namedPin(c, r.ENCB, 'input', 'ENCB', false)
  return setIoc(c, r.ENCB, 'any')
}

/** TP6 §1 : ADCC (FOSC/4, à droite) sur POT (RA0), JOY_HORZ (RD5), JOY_VERT (RD6) + EUSART 9600 bauds redirigé */
export function tp61Config(): MccConfig {
  let c = addAdcc(defaultMccConfig())
  for (const ch of INFO3.adcc.tpChannels) {
    c = { ...c, pins: [...c.pins, { pin: ch.pin, direction: 'input', customName: ch.name, startHigh: false, analog: true, wpu: false, od: false, adc: true }] }
  }
  return updateEusart(addEusart(c), { redirectStdio: true })
}

/** TP6 §2 : tp6-1 + interruption ADI, TMR2 à 10 ms (FOSC/4, Roll over) avec interruption */
export function tp62Config(): MccConfig {
  let c = updateAdcc(tp61Config(), { interrupt: true })
  c = updateTimer(addTimer(c, 'TMR2'), 'TMR2', { clockSource: 'FOSC/4', prescaler: 64, postscaler: 1, interrupt: true, periodS: INFO3.tp6.acqPeriodS })
  return c
}

/** TP6 §3 : MSSP1 en SPI maître mode 0 (FOSC/4) sur le bus du mikroBUS, LOAD (CS du mikroBUS 1, RA3) en sortie, Start High */
export function tp63Config(base: MccConfig = defaultMccConfig()): MccConfig {
  const cs = INFO3.pins.mikrobus1.CS
  const c = namedPin(updateMssp(addMssp(base), { mode: 0, clockSource: 'FOSC/4' }), cs, 'output', 'LOAD')
  return updatePin(c, cs, { startHigh: true })
}

/** TP6 §4 : ADCC et EUSART (tp6-1) + SPI et LOAD (tp6-3) */
export const tp64Config = (): MccConfig => tp63Config(tp61Config())

/** Timer2 en Roll over pulse, interruption activée, Timer Period saisie pour obtenir PR2 = pr */
function withTmr2(cfg: MccConfig, patch: Partial<TimerConfig>, pr: number): MccConfig {
  let c = updateTimer(addTimer(cfg, 'TMR2'), 'TMR2', { interrupt: true, ...patch })
  c = updateTimer(c, 'TMR2', { periodS: periodForRegister(c, c.timers!.TMR2!, pr) })
  return c
}
const atMHz = (cfg: MccConfig, hfMHz: number): MccConfig => ({ ...cfg, system: { ...cfg.system, oscillator: 'HFINTOSC', hfMHz, divider: 1 } })

/** TP3 §1A : Fosc 1 MHz, FOSC/4, 1:128, 1:16, PR2 = 122 */
export function tp31AConfig(pr = 122): MccConfig {
  return withTmr2(atMHz(tp1Config(), 1), { clockSource: 'FOSC/4', prescaler: 128, postscaler: 16 }, pr)
}

/** TP3 §1B : Fosc 4 MHz, FOSC/4, T2PR = 0x1E, prescaler et postscaler au choix */
export function tp31BConfig(prescaler = 128, postscaler = 16): MccConfig {
  return withTmr2(atMHz(tp1Config(), 4), { clockSource: 'FOSC/4', prescaler, postscaler }, 0x1e)
}

/** TP3 §1C : Fosc 4 MHz, LFINTOSC, 1:128, 1:1, PR2 = 241 */
export function tp31CConfig(): MccConfig {
  return withTmr2(atMHz(tp1Config(), 4), { clockSource: 'LFINTOSC', prescaler: 128, postscaler: 1 }, 241)
}

/**
 * TP3 §2 : LED, BP_S1 (IOC negative), BP_S2 (RC5, GPIO input) + TMR2 T2IN sur RC5 ; Monostable,
 * « T2CKIPPS pin », « Starts on falling edge on TMR2_ers », LFINTOSC, 1:2, 1:1, Timer Period 10 ms,
 * interruption activée ; Interrupt Module : TMR2 ordre 1, IOCI ordre 2.
 */
export function tp32Config(): MccConfig {
  const [s1, s2] = INFO3.pins.buttons
  let c = setIoc(tp1Config(), s1.pin, 'negative')
  c = updateTimer(addTimer(c, 'TMR2'), 'TMR2', {
    controlMode: 'Monostable',
    ersSource: 'T{n}CKIPPS pin',
    startOption: 'Starts on falling edge on {ers}',
    clockSource: 'LFINTOSC',
    prescaler: 2,
    postscaler: 1,
    periodS: INFO3.tp3.debounceS,
    interrupt: true,
    ersPin: s2.pin,
  })
  return { ...c, interruptOrder: ['TMR2', 'IOC'] }
}
