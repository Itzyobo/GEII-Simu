/**
 * « Faire vérifier » des TP2, TP3 et TP4 : broches et noms (comme au TP1), IOC, Timer2, MSSP1 et carte Rotary.
 * Exigences cumulées au fil des questions ; broches et réglages attendus tirés de INFO3 (jamais écrits ici).
 */
import { INFO3 } from '../../data/reference'
import { iocOf, type IocEdge } from '../mcc/config'
import { actualPeriod, effectivePostscaler, formatPeriod, label, periodRegister } from '../mcc/timers'
import type { PwmId } from '../mcc/config'
import type { Project, SlotId } from './project'
import { generateErrors, pinsErrors, type ExpectedPin } from './verify'

export const TP2_ORDER = ['tp2-1-1', 'tp2-1-2', 'tp2-2-1', 'tp2-2-2', 'tp2-2-3', 'tp2-2-4'] as const
export const TP3_ORDER = ['tp3-1', 'tp3-2', 'tp3-3'] as const
export type Tp2QuestionId = (typeof TP2_ORDER)[number]
export type Tp3QuestionId = (typeof TP3_ORDER)[number]
export const TP4_ORDER = ['tp4-1', 'tp4-2', 'tp4-3', 'tp4-4', 'tp4-5', 'tp4-6'] as const
export type Tp4QuestionId = (typeof TP4_ORDER)[number]
export const TP5_ORDER = ['tp5-1', 'tp5-2', 'tp5-3', 'tp5-4'] as const
export type Tp5QuestionId = (typeof TP5_ORDER)[number]
export const TP6_ORDER = ['tp6-1-1', 'tp6-1-2', 'tp6-1-3', 'tp6-2', 'tp6-3', 'tp6-4'] as const
export type Tp6QuestionId = (typeof TP6_ORDER)[number]
/** Questions des TP2 à TP6 (page commune TpPage) */
export type Tp23QuestionId = Tp2QuestionId | Tp3QuestionId | Tp4QuestionId | Tp5QuestionId | Tp6QuestionId

const P = INFO3.tp1.namePrefix
const R = INFO3.pins.rotary
const [S1, S2] = INFO3.pins.buttons
const BYTE = (1 << INFO3.c.bitsPerByte) - 1
const SLOT_NAME: Record<SlotId, string> = { mikrobus1: 'mikroBUS 1 (MODULE 1)', mikrobus2: 'mikroBUS 2 (MODULE 2)' }

const leds = (): ExpectedPin[] => INFO3.pins.leds.map((l) => ({ name: `${P.led}${l.name}`, pin: l.pin, direction: 'output' }))
const btn = (b: (typeof INFO3.pins.buttons)[number]): ExpectedPin => ({ name: `${P.button}${b.name}`, pin: b.pin, direction: 'input' })
const encoder = (): ExpectedPin[] => [
  { name: 'ENCA', pin: R.ENCA, direction: 'input' },
  { name: 'ENCB', pin: R.ENCB, direction: 'input' },
]

function iocErrors(p: Project, pin: string, name: string, edge: IocEdge): string[] {
  const x = p.mcc.pins.find((q) => q.pin === pin)
  if (!x) return []
  const got = iocOf(x)
  return got === edge ? [] : [`${name} (${pin}) : IOC « ${edge} » attendue dans Pin Module, « ${got} » configurée`]
}

/** Carte Rotary : sur le mikroBUS prévu (2), sinon ENCA / ENCB n'arrivent pas sur RD1 / RA2 */
export function rotaryErrors(p: Project): string[] {
  const card = INFO3.clickBoards.rotary
  const slot = (Object.keys(p.bench.slots) as SlotId[]).find((s) => p.bench.slots[s] === 'rotary')
  if (!slot) return [`Carte ${card.name} absente : l’enficher sur le ${SLOT_NAME[card.expectedSlot as SlotId]}`]
  if (slot !== card.expectedSlot) return [`Carte ${card.name} sur le ${SLOT_NAME[slot]} : ENCA et ENCB n’arrivent pas sur ${R.ENCA} et ${R.ENCB}, l’enficher sur le ${SLOT_NAME[card.expectedSlot as SlotId]}`]
  return []
}

export function verifyTp2(p: Project, q: Tp2QuestionId): string[] {
  const idx = TP2_ORDER.indexOf(q)
  const at = (id: Tp2QuestionId) => idx >= TP2_ORDER.indexOf(id)
  const expected = [...leds(), btn(S1), btn(S2), ...(at('tp2-2-1') ? encoder() : [])]
  const errors = pinsErrors(p, expected)
  errors.push(...iocErrors(p, S1.pin, `${P.button}${S1.name}`, 'negative'), ...iocErrors(p, S2.pin, `${P.button}${S2.name}`, 'negative'))
  if (at('tp2-2-3')) errors.push(...iocErrors(p, R.ENCB, 'ENCB', 'any'))
  if (at('tp2-2-1')) errors.push(...rotaryErrors(p))
  return [...errors, ...generateErrors(p)]
}

export function verifyTp3(p: Project, q: Tp3QuestionId): string[] {
  const two = TP3_ORDER.indexOf(q) >= TP3_ORDER.indexOf('tp3-2')
  const errors = pinsErrors(p, [...leds(), ...(two ? [btn(S1), btn(S2)] : [])])
  const t = p.mcc.timers?.TMR2
  if (!t) errors.push('TMR2 absent : l’ajouter depuis Device Resources (Timer › TMR2)')
  else {
    if (!t.enabled) errors.push('TMR2 : cocher « Enable Timer »')
    if (!t.interrupt) errors.push('TMR2 : cocher « Enable Timer Interrupt » (Software Settings)')
    if (two) {
      errors.push(...iocErrors(p, S1.pin, `${P.button}${S1.name}`, 'negative'))
      const start = 'Starts on falling edge on {ers}'
      if (t.controlMode !== 'Monostable') errors.push(`TMR2 : Control Mode « Monostable » attendu, « ${t.controlMode} » configuré`)
      else if (t.startOption !== start) errors.push(`TMR2 : Start/Reset Option « ${label(start, 'TMR2')} » attendue, « ${label(t.startOption, 'TMR2')} » configurée`)
      if (t.ersPin !== S2.pin) errors.push(`TMR2 T2IN : ${S2.pin} attendue dans le Grid View (ligne TMR2 T2IN), ${t.ersPin ?? 'aucune broche'} choisie`)
    }
  }
  return [...errors, ...generateErrors(p)]
}

/** TP4 : Rotary sur le mikroBUS 2, MSSP1 en SPI maître sur le bus SPI du mikroBUS, RST et LATCH en sortie (§2 et suite), codeur et IOC (§5) */
export function verifyTp4(p: Project, q: Tp4QuestionId): string[] {
  const idx = TP4_ORDER.indexOf(q)
  const at = (id: Tp4QuestionId) => idx >= TP4_ORDER.indexOf(id)
  const errors = rotaryErrors(p)
  const m = p.mcc.mssp
  const bus = INFO3.pins.mikrobus2
  if (!m) errors.push('MSSP1 absent : l’ajouter depuis Device Resources (MSSP › MSSP1), Serial Protocol SPI, Mode Master')
  else {
    const want = { SCK1: bus.SCK, SDO1: bus.MOSI, SDI1: bus.MISO } as const
    for (const [sig, pin] of Object.entries(want) as [keyof typeof want, string][]) {
      if (m.pins[sig] !== pin) errors.push(`MSSP1 ${sig} : ${pin} attendue dans le Grid View, ${m.pins[sig] ?? 'aucune broche'} choisie`)
    }
  }
  if (at('tp4-2')) {
    for (const [name, pin] of [['RST', R.RST], ['LATCH', R.LATCH]] as const) {
      const x = p.mcc.pins.find((c) => c.pin === pin)
      if (!x || x.direction !== 'output') errors.push(`${name} (${pin}) : sortie numérique attendue dans le Pin Module (${name === 'RST' ? 'MR des 74HC595, actif à 0' : 'verrouillage des sorties'})`)
    }
  }
  // Codeur et compteur : question 5 seulement (la question 6 n'en a pas besoin)
  if (q === 'tp4-5') {
    errors.push(...pinsErrors(p, [...leds(), ...encoder()]))
    errors.push(...iocErrors(p, R.ENCB, 'ENCB', 'any'))
  }
  return [...errors, ...generateErrors(p)]
}

/**
 * TP5 : USB blanc (terminal), TMR2 en FOSC/4 avec PR2 = 0xFF, PWM6 / PWM7 / CCP1 sur RD4 / RC0 / RC1 et TMR2,
 * EUSART avec la redirection STDIO (TX1 RC6) ; §3 : IOC sur S1 et S2, LED_D3 à LED_D5 ; §4 : carte Rotary
 * sur le mikroBUS 2, SPI, RST, LATCH, ENCA et ENCB. L'USB noir ne peut être branché qu'après la vérification
 * (verrouillage) : il fait l'objet d'un rappel, comme le cache (« Important » dans l'énoncé).
 */
export function verifyTp5(p: Project, q: Tp5QuestionId): string[] {
  const idx = TP5_ORDER.indexOf(q)
  const at = (id: Tp5QuestionId) => idx >= TP5_ORDER.indexOf(id)
  const errors: string[] = []
  if (!p.bench.usbWhite) errors.push('USB blanc débranché : le brancher (« Pensez à brancher les 2 cordons USB », port COM du terminal)')
  const t = p.mcc.timers?.TMR2
  if (!t) errors.push('TMR2 absent : l’ajouter depuis Device Resources (Timer › TMR2), base de temps des PWM')
  else {
    if (t.clockSource !== INFO3.pwm.requiredClock) errors.push(`TMR2 : Clock Source ${INFO3.pwm.requiredClock} attendue pour la PWM (cours p. 85), « ${t.clockSource} » choisie`)
    const pr = periodRegister(p.mcc, t)
    if (pr !== BYTE) errors.push(`TMR2 : PR2 = 0xFF attendu (10 bits de résolution), PR2 = 0x${pr.toString(16).toUpperCase().padStart(2, '0')} obtenu avec la Timer Period choisie`)
  }
  for (const [id, pin] of Object.entries(INFO3.pwm.defaultPins) as [PwmId, string][]) {
    const c = p.mcc.pwm?.[id]
    if (!c) errors.push(`${id} absent : l’ajouter depuis Device Resources (${id === 'CCP1' ? 'CCP › CCP1, mode PWM' : `PWM › ${id}`})`)
    else {
      if (c.pin !== pin) errors.push(`${id} : sortie sur ${pin} attendue (Grid View, LED RGB), ${c.pin ?? 'aucune broche'} choisie`)
      if (c.timer !== 'TMR2') errors.push(`${id} : Timer Select timer2 attendu, ${c.timer.toLowerCase()} choisi`)
      if (id !== 'CCP1' && !c.enabled) errors.push(`${id} : cocher « Enable PWM »`)
    }
  }
  const e = p.mcc.eusart
  if (!e) errors.push('EUSART absent : l’ajouter depuis Device Resources (EUSART), mode asynchrone')
  else {
    if (!e.enable || !e.transmit) errors.push('EUSART : cocher « Enable EUSART » et « Enable Transmit »')
    if (!e.redirectStdio) errors.push('EUSART : cocher « Redirect STDIO to USART » pour que printf écrive sur la liaison série')
    if (e.pins.TX1 !== INFO3.pins.uart.tx) errors.push(`EUSART TX1 : ${INFO3.pins.uart.tx} attendue (pont USB de la carte fille), ${e.pins.TX1 ?? 'aucune broche'} choisie`)
  }
  if (at('tp5-3')) {
    errors.push(...pinsErrors(p, [...INFO3.tp5.stateLeds.map((n): ExpectedPin => ({ name: `${P.led}${n}`, pin: INFO3.pins.leds.find((l) => l.name === n)!.pin, direction: 'output' })), btn(S1), btn(S2)]))
    errors.push(...iocErrors(p, S1.pin, `${P.button}${S1.name}`, 'negative'), ...iocErrors(p, S2.pin, `${P.button}${S2.name}`, 'negative'))
  }
  if (q === 'tp5-4') {
    errors.push(...rotaryErrors(p))
    const m = p.mcc.mssp
    const bus = INFO3.pins.mikrobus2
    if (!m) errors.push('MSSP1 absent : l’ajouter (SPI maître) pour l’anneau de LED')
    else for (const [sig, pin] of [['SCK1', bus.SCK], ['SDO1', bus.MOSI], ['SDI1', bus.MISO]] as const) if (m.pins[sig] !== pin) errors.push(`MSSP1 ${sig} : ${pin} attendue, ${m.pins[sig] ?? 'aucune broche'} choisie`)
    for (const [name, pin] of [['RST', R.RST], ['LATCH', R.LATCH]] as const) {
      const x = p.mcc.pins.find((c) => c.pin === pin)
      if (!x || x.direction !== 'output') errors.push(`${name} (${pin}) : sortie numérique attendue dans le Pin Module`)
    }
    errors.push(...pinsErrors(p, encoder()), ...iocErrors(p, R.ENCB, 'ENCB', 'any'))
  }
  return [...errors, ...generateErrors(p)]
}

/**
 * TP6 : USB blanc, ADCC sur POT, JOY_HORZ, JOY_VERT, EUSART redirigé ; §2 : TMR2 à 10 ms avec interruption,
 * interruption ADI, PEIE dans main.c ; §3 et §4 : 8x8 R click sur le mikroBUS 1, MSSP1 en SPI maître mode 0 ou 3,
 * LOAD (CS, RA3) en sortie à 1 au repos (Start High).
 */
export function verifyTp6(p: Project, q: Tp6QuestionId): string[] {
  const errors: string[] = []
  const adc = q !== 'tp6-3'
  const matrix = q === 'tp6-3' || q === 'tp6-4'
  if (!p.bench.usbWhite) errors.push('USB blanc débranché : le brancher (terminal du PC)')
  if (adc) {
    if (!p.mcc.adcc) errors.push('ADCC absent : l’ajouter depuis Device Resources (ADC › ADCC)')
    for (const ch of INFO3.adcc.tpChannels) {
      const x = p.mcc.pins.find((c) => c.pin === ch.pin)
      if (!x || !x.adc) errors.push(`${ch.name} (${ch.pin}) : voie de l’ADCC attendue (ligne ADCC ANx du Grid View)`)
      else if (x.customName !== ch.name) errors.push(`${ch.pin} : Custom Name « ${ch.name} » attendu, « ${x.customName} » saisi`)
    }
  }
  const e = p.mcc.eusart
  if (q !== 'tp6-3' && (!e || !e.redirectStdio || e.pins.TX1 !== INFO3.pins.uart.tx)) errors.push(`EUSART : TX1 sur ${INFO3.pins.uart.tx} avec « Redirect STDIO to USART » attendu (printf)`)
  if (q === 'tp6-2') {
    const t = p.mcc.timers?.TMR2
    if (!t || !t.interrupt) errors.push('TMR2 avec « Enable Timer Interrupt » attendu (une conversion toutes les 10 ms)')
    else {
      const per = actualPeriod(p.mcc, t) * effectivePostscaler(t)
      if (Math.abs(per - INFO3.tp6.acqPeriodS) / INFO3.tp6.acqPeriodS > INFO3.tp6.acqTolerance) errors.push(`TMR2 : interruption toutes les 10 ms attendue, ${formatPeriod(per)} obtenues`)
    }
    if (!p.mcc.adcc?.interrupt) errors.push('ADCC : cocher « Enable ADC Interrupt » (interruption ADI)')
    const main = (p.files['main.c'] ?? '').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ')
    if (!/INTERRUPT_PeripheralInterruptEnable\s*\(\s*\)\s*;/.test(main)) errors.push('main.c : INTERRUPT_PeripheralInterruptEnable() attendu (ADI et TMR2 sont des interruptions de second niveau, PEIE)')
  }
  if (matrix) {
    const card = INFO3.clickBoards.matrix8x8
    const slot = (Object.keys(p.bench.slots) as SlotId[]).find((s) => p.bench.slots[s] === 'matrix8x8')
    if (slot !== card.expectedSlot) errors.push(slot ? `Carte ${card.name} sur le ${SLOT_NAME[slot]} : CS arrive sur RD3 au lieu de RA3, l’enficher sur le ${SLOT_NAME[card.expectedSlot as SlotId]}` : `Carte ${card.name} absente : l’enficher sur le ${SLOT_NAME[card.expectedSlot as SlotId]}`)
    const m = p.mcc.mssp
    const bus = INFO3.pins.mikrobus1
    if (!m) errors.push('MSSP1 absent : l’ajouter (SPI maître) pour le MAX7219')
    else {
      if (!(INFO3.tp4.goodModes as readonly number[]).includes(m.mode)) errors.push(`MSSP1 : mode SPI 0 ou 3 attendu (DIN lu au front montant de CLK), mode ${m.mode} choisi`)
      for (const [sig, pin] of [['SCK1', bus.SCK], ['SDO1', bus.MOSI]] as const) if (m.pins[sig] !== pin) errors.push(`MSSP1 ${sig} : ${pin} attendue, ${m.pins[sig] ?? 'aucune broche'} choisie`)
    }
    const load = p.mcc.pins.find((c) => c.pin === bus.CS)
    if (!load || load.direction !== 'output' || !load.startHigh) errors.push(`LOAD (${bus.CS}, CS du mikroBUS 1) : sortie numérique avec « Start High » attendue (LOAD à 1 au repos)`)
  }
  return [...errors, ...generateErrors(p)]
}

/** Rappels du TP5 qui ne bloquent pas la vérification */
export function tp5Warnings(p: Project): string[] {
  return [
    ...(p.bench.cover ? [] : ['Important : ajouter le cache en plastique sur la LED RGB pour éviter de vous éblouir']),
    ...(p.bench.usbBlack ? [] : ['Brancher ensuite l’USB noir (alimentation et programmation) : les 2 cordons sont nécessaires']),
  ]
}

export const verifyTp23 = (p: Project, q: Tp23QuestionId): string[] =>
  q.startsWith('tp2') ? verifyTp2(p, q as Tp2QuestionId) : q.startsWith('tp3') ? verifyTp3(p, q as Tp3QuestionId) : q.startsWith('tp4') ? verifyTp4(p, q as Tp4QuestionId) : q.startsWith('tp5') ? verifyTp5(p, q as Tp5QuestionId) : verifyTp6(p, q as Tp6QuestionId)

export function runVerifyTp23(p: Project, q: Tp23QuestionId): { project: Project; errors: string[]; warnings: string[] } {
  const errors = verifyTp23(p, q)
  return { project: errors.length ? p : { ...p, verified: true }, errors, warnings: q.startsWith('tp5') ? tp5Warnings(p) : [] }
}
