/** Configurations MCC de départ, construites comme dans MCC (Grid View puis Pin Module) depuis INFO3.pins */
import { INFO3 } from '../../data/reference'
import { defaultMccConfig, toggleGridPin, updatePin, type Direction, type MccConfig } from './config'

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
