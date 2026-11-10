/**
 * Interrupt Module de MCC Classic : sources d'interruption du projet, ordre de la table « Interrupt Vector »,
 * génération d'interrupt_manager.c/.h (cours p. 39 et 59). Les sources de premier niveau (IOC, PIE0)
 * sont testées d'abord, puis `else if(INTCONbits.PEIE == 1)` avec les périphériques dans l'ordre de la table (H30).
 * Format des commentaires et en-têtes reconstitué d'après MCC 1.81 (H34).
 */
import { INFO3 } from '../../data/reference'
import { iocOf, TIMER_IDS, type MccConfig, type TimerId } from './config'

export type InterruptLevel = 'first' | 'peripheral'

export interface InterruptSource {
  /** Identifiant stable dans la configuration (IOC, TMR2…) */
  id: string
  module: string
  interrupt: string
  level: InterruptLevel
  /** Condition et appel générés dans INTERRUPT_InterruptManager */
  ie: string
  flag: string
  call: string
}

const IOC_SOURCE: InterruptSource = { id: 'IOC', module: 'Pin Module', interrupt: 'IOCI', level: 'first', ie: 'PIE0bits.IOCIE', flag: 'PIR0bits.IOCIF', call: 'PIN_MANAGER_IOC();' }

/** Interruption de période d'un timer (Enable Timer Interrupt coché) : PIE4/PIR4, niveau périphérique */
const timerSource = (id: TimerId): InterruptSource => ({
  id,
  module: id,
  interrupt: 'TMRI',
  level: 'peripheral',
  ie: `${INFO3.timers.irq.enable}bits.${id}IE`,
  flag: `${INFO3.timers.irq.flag}bits.${id}IF`,
  call: `${id}_ISR();`,
})

/** EUSART avec « Enable EUSART Interrupts » : émission (TXI) et réception (RCI), PIE3/PIR3, niveau périphérique */
const eusartSources = (): InterruptSource[] =>
  (['tx', 'rx'] as const).map((k) => {
    const E = INFO3.eusart.irq
    const flag = E[k]
    const tx = k === 'tx'
    return { id: `EUSART-${tx ? 'TX' : 'RC'}`, module: 'EUSART', interrupt: tx ? 'TXI' : 'RCI', level: 'peripheral' as const, ie: `${E.enable}bits.${flag.replace(/IF$/, 'IE')}`, flag: `${E.flag}bits.${flag}`, call: `EUSART_${tx ? 'Tx' : 'Rx'}DefaultInterruptHandler();` }
  })

/** Sources configurées (activées ou non), avant tri */
export function configuredSources(cfg: MccConfig): InterruptSource[] {
  const out: InterruptSource[] = []
  if (cfg.pins.some((p) => iocOf(p) !== 'none')) out.push(IOC_SOURCE)
  for (const id of TIMER_IDS) if (cfg.timers?.[id]?.interrupt) out.push(timerSource(id))
  if (cfg.eusart?.interrupts) out.push(...eusartSources())
  return out
}

/** Interruption d'un timer réellement générée (cochée dans le timer et dans la table Interrupt Vector) */
export const timerIrqOn = (cfg: MccConfig, id: TimerId) => !!cfg.timers?.[id]?.interrupt && isEnabled(cfg, id)

/** Une source est activée sauf si elle a été décochée dans la table (colonne Enabled) */
export const isEnabled = (cfg: MccConfig, id: string) => !(cfg.interruptsDisabled ?? []).includes(id)

/** Lignes de la table Interrupt Vector, dans l'ordre choisi (les nouvelles sources à la fin) */
export function interruptTable(cfg: MccConfig): (InterruptSource & { order: number; enabled: boolean })[] {
  const src = configuredSources(cfg)
  const order = cfg.interruptOrder ?? []
  const rank = (id: string) => {
    const i = order.indexOf(id)
    return i < 0 ? order.length + src.findIndex((s) => s.id === id) : i
  }
  return [...src].sort((a, b) => rank(a.id) - rank(b.id)).map((s, i) => ({ ...s, order: i + 1, enabled: isEnabled(cfg, s.id) }))
}

/** Bouton Order Up / Order Down */
export function moveInterrupt(cfg: MccConfig, id: string, delta: -1 | 1): MccConfig {
  const ids = interruptTable(cfg).map((s) => s.id)
  const i = ids.indexOf(id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= ids.length) return cfg
  ;[ids[i], ids[j]] = [ids[j], ids[i]]
  return { ...cfg, interruptOrder: ids }
}

export function setInterruptEnabled(cfg: MccConfig, id: string, enabled: boolean): MccConfig {
  const off = new Set(cfg.interruptsDisabled ?? [])
  if (enabled) off.delete(id)
  else off.add(id)
  return { ...cfg, interruptsDisabled: [...off] }
}

/** Sources actives, dans l'ordre de génération (premier niveau d'abord, H30) */
export function activeSources(cfg: MccConfig): InterruptSource[] {
  const t = interruptTable(cfg).filter((s) => s.enabled)
  return [...t.filter((s) => s.level === 'first'), ...t.filter((s) => s.level === 'peripheral')]
}

const SP = ' '
const UNHANDLED = ['    else', '    {', '        //Unhandled Interrupt', '    }']

/** Corps d'INTERRUPT_InterruptManager */
export function interruptManagerBody(cfg: MccConfig): string {
  const src = activeSources(cfg)
  const first = src.filter((s) => s.level === 'first')
  const peri = src.filter((s) => s.level === 'peripheral')
  const lines: string[] = ['    // interrupt handler']
  first.forEach((s, i) => {
    lines.push(`    ${i === 0 ? 'if' : 'else if'}(${s.ie} == 1 && ${s.flag} == 1)`, '    {', `        ${s.call}`, '    }')
  })
  if (peri.length) {
    lines.push(`    ${first.length ? 'else if' : 'if'}(INTCONbits.PEIE == 1)`, '    {')
    peri.forEach((s, i) => {
      lines.push(`        ${i === 0 ? 'if' : 'else if'}(${s.ie} == 1 && ${s.flag} == 1)`, '        {', `            ${s.call}`, `        }${SP}`)
    })
    lines.push('        else', '        {', '            //Unhandled Interrupt', '        }', `    }${SP.repeat(6)}`)
  }
  lines.push(...UNHANDLED)
  return lines.join('\n')
}
