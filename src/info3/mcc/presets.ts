/** Configurations MCC de départ, construites comme dans MCC (Grid View puis Pin Module) depuis INFO3.pins */
import { INFO3 } from '../../data/reference'
import { defaultMccConfig, setIoc, toggleGridPin, updatePin, type Direction, type MccConfig } from './config'

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
