/** Configurations MCC de départ, construites comme dans MCC (Grid View puis Pin Module) depuis INFO3.pins */
import { INFO3 } from '../../data/reference'
import { addTimer, defaultMccConfig, setIoc, toggleGridPin, updatePin, updateTimer, type Direction, type MccConfig, type TimerConfig } from './config'
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
