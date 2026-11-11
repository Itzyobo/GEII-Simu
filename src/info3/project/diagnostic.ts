/**
 * Panneau Diagnostic du mode libre : incohérences lues dans les registres et pendant l'exécution.
 * Ne modifie jamais le code. Règles :
 * R1 broche lue (GetValue, PORTxbits) alors qu'elle est en analogique ;
 * R2 écriture sur une broche en entrée ;
 * R3 _XTAL_FREQ différent du Fosc configuré (System Module) ou mesuré dans OSCCON1/OSCFRQ ;
 * R4 carte Click présente mais inutilisée par le projet (ou sur le mauvais mikroBUS) ;
 * R5 IE d'un périphérique de second niveau à 1 avec PEIE à 0 ;
 * R6 IOC configurée avec GIE resté à 0 ;
 * R7 carte Click sur un mikroBUS dont les broches ne sont pas celles utilisées par le code (celles de l'autre mikroBUS le sont) ;
 * R8 PWM sur un timer qui n'est pas en FOSC/4 ;
 * R9 SPI en mode 1 ou 2 avec les 74HC595 de la carte Rotary ;
 * R10 printf sans USB blanc, ou baud du terminal différent du baud réel (plus de 5 %) ;
 * R11 variable de plus de 8 bits écrite sous interruption et lue dans main avec GIE = 1 ;
 * R12 TAD < 1 µs.
 */
import { INFO3 } from '../../data/reference'
import { adccTad } from '../mcc/adcc'
import { iocOf } from '../mcc/config'
import { pwmEntries } from '../mcc/pwm'
import { clockCheck, type Project, type SlotId } from './project'

export interface RuntimeDiag {
  analogReads: string[]
  inputWrites: string[]
  /** Fosc décrit par les registres pendant l'exécution — Hz */
  fosc: number | null
  /** État des interruptions (inspecteur) */
  irq?: { gie: number; peie: number; sources: { name: string; ie: number }[] } | null
  /** EUSART : octets émis, baud réel ; terminal : baud, USB blanc */
  uart?: { sent: number; baud: number; termBaud: number; usbWhite: boolean } | null
  /** Variables partagées lues sans protection (relève des accès de la VM) */
  shared?: string[]
}

export interface Finding {
  rule: 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8' | 'R9' | 'R10' | 'R11' | 'R12'
  text: string
}

const slotLabel = (s: SlotId) => (s === 'mikrobus1' ? 'mikroBUS 1' : 'mikroBUS 2')
const other = (s: SlotId): SlotId => (s === 'mikrobus1' ? 'mikrobus2' : 'mikrobus1')
/** Sources de premier niveau (PIE0) : INT, IOC, TMR0 — les autres demandent PEIE */
const FIRST_LEVEL = new Set((INFO3.sfr as Record<string, { bits: readonly (string | null)[] }>)[INFO3.interrupts.firstLevel[0][1]].bits.filter((b): b is string => !!b).map((b) => b.replace(/IF$/, '')))
/** Broches d'un mikroBUS utilisées par une carte (signaux de son câblage) */
function cardPins(card: string, slot: SlotId): string[] {
  const bus = INFO3.pins[slot] as Record<string, string>
  const w = card === 'rotary' ? { ...INFO3.rotary.wiring, ...INFO3.ring.wiring } : INFO3.max7219.wiring
  return [...new Set(Object.values(w).map((sig) => bus[sig]))]
}

export function diagnose(p: Project, rt: RuntimeDiag | null): Finding[] {
  const out: Finding[] = []
  if (rt) {
    for (const pin of rt.analogReads) out.push({ rule: 'R1', text: `${pin} lue en numérique alors que ANS${pin.slice(1)} = 1 (Analog) : la lecture renvoie toujours 0` })
    for (const pin of rt.inputWrites) out.push({ rule: 'R2', text: `Écriture sur ${pin} alors que la broche est en entrée (TRIS${pin.slice(1)} = 1) : le niveau n’est pas imposé` })
  }
  const { xtal, fosc } = clockCheck(p)
  if (xtal !== null && xtal !== fosc) out.push({ rule: 'R3', text: `_XTAL_FREQ = ${xtal} Hz mais Fosc configuré = ${fosc} Hz : les délais seront faux` })
  else if (xtal !== null && rt?.fosc && rt.fosc !== xtal) out.push({ rule: 'R3', text: `_XTAL_FREQ = ${xtal} Hz mais le PIC tourne à ${rt.fosc} Hz (OSCCON1/OSCFRQ) : les délais seront faux` })
  const configured = new Set(p.mcc.pins.map((x) => x.pin))
  for (const slot of Object.keys(p.bench.slots) as SlotId[]) {
    const card = p.bench.slots[slot]
    if (!card) continue
    const info = INFO3.clickBoards[card]
    const pins = INFO3.pins[slot] as Record<string, string>
    const used = Object.entries(pins).some(([k, pin]) => k !== 'source' && configured.has(pin))
    if (info.expectedSlot !== slot) out.push({ rule: 'R4', text: `Carte ${info.name} sur le ${slotLabel(slot)} : elle est prévue sur le ${slotLabel(info.expectedSlot as SlotId)}` })
    else if (!used) out.push({ rule: 'R4', text: `Carte ${info.name} sur le ${slotLabel(slot)} : aucune de ses broches n’est configurée dans MCC` })
    // Broches propres à la carte (hors bus SPI partagé) : configurées sur l'autre mikroBUS seulement
    const shared = new Set(['SCK', 'MISO', 'MOSI'].map((k) => pins[k]))
    const here = cardPins(card, slot).filter((x) => !shared.has(x))
    const there = cardPins(card, other(slot)).filter((x) => !shared.has(x))
    if (!here.some((x) => configured.has(x)) && there.some((x) => configured.has(x))) out.push({ rule: 'R7', text: `Carte ${info.name} sur le ${slotLabel(slot)}, mais le code utilise les broches du ${slotLabel(other(slot))} (${there.filter((x) => configured.has(x)).join(', ')})` })
  }
  const irq = rt?.irq
  if (irq && !irq.peie) {
    const second = irq.sources.filter((x) => x.ie && !FIRST_LEVEL.has(x.name)).map((x) => x.name)
    if (second.length) out.push({ rule: 'R5', text: `${second.join(', ')} : IE à 1 mais PEIE = 0 (interruption de second niveau, jamais servie) : INTERRUPT_PeripheralInterruptEnable()` })
  }
  if (irq && !irq.gie && p.mcc.pins.some((x) => iocOf(x) !== 'none')) out.push({ rule: 'R6', text: 'IOC configurée dans Pin Module mais GIE = 0 : décommenter INTERRUPT_GlobalInterruptEnable()' })
  for (const [id, c] of pwmEntries(p.mcc)) {
    const t = p.mcc.timers?.[c.timer]
    if (t && t.clockSource !== INFO3.pwm.requiredClock) out.push({ rule: 'R8', text: `${id} sur ${c.timer} cadencé par ${t.clockSource} : la PWM exige ${INFO3.pwm.requiredClock} (cours p. 85)` })
  }
  const rotary = (Object.keys(p.bench.slots) as SlotId[]).some((x) => p.bench.slots[x] === 'rotary')
  if (rotary && p.mcc.mssp && !(INFO3.tp4.goodModes as readonly number[]).includes(p.mcc.mssp.mode)) out.push({ rule: 'R9', text: `SPI en mode ${p.mcc.mssp.mode} avec les 74HC595 de la carte Rotary : motif décalé d’un rang (H14), utiliser le mode 0 ou 3` })
  const u = rt?.uart
  if (u && u.sent > 0) {
    if (!u.usbWhite) out.push({ rule: 'R10', text: 'printf / EUSART actif mais USB blanc débranché : rien n’arrive au terminal (H12)' })
    else if (u.baud && Math.abs(u.termBaud - u.baud) / u.baud > INFO3.eusart.maxErrorRatio) out.push({ rule: 'R10', text: `Terminal à ${u.termBaud} bauds, PIC à ${u.baud} bauds : caractères corrompus` })
  }
  for (const v of rt?.shared ?? []) out.push({ rule: 'R11', text: `${v} : variable de plus de 8 bits écrite sous interruption et lue dans main avec GIE = 1 (section critique à prévoir)` })
  if (p.mcc.adcc && adccTad(p.mcc, p.mcc.adcc) < INFO3.adcc.minTadS * (1 - INFO3.vm.tickEpsilon)) out.push({ rule: 'R12', text: `TAD inférieur à 1 µs (cours p. 98) : augmenter le diviseur de l’ADCC` })
  return out
}
