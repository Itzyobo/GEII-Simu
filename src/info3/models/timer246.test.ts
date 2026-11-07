import { describe, expect, it } from 'vitest'
import { INFO3 } from '../../data/reference'
import { Timer246, timerPeriodS } from './timer246'

/** Banc minimal : temps en ticks, file d'événements triée, horloge LFINTOSC */
function bench() {
  let now = 0
  const queue: { t: number; fn: () => void }[] = []
  const flags: number[] = []
  let onCleared = 0
  const tm = new Timer246({
    now: () => now,
    clockHz: () => INFO3.clock.lfintosc,
    schedule: (t, fn) => {
      queue.push({ t, fn })
      queue.sort((a, b) => a.t - b.t)
    },
    raiseFlag: () => flags.push(now),
    clearOn: () => onCleared++,
  })
  tm.reset()
  const runTo = (t: number) => {
    while (queue.length && queue[0].t <= t) {
      const e = queue.shift()!
      now = e.t
      e.fn()
    }
    now = t
  }
  const s = (sec: number) => Math.round(sec * INFO3.clock.timeBaseHz)
  return { tm, flags, runTo, s, cleared: () => onCleared, at: () => now }
}

describe('timer246', () => {
  it('Roll over : TMRxIF toutes les (PR + 1) × pre × post / Fclk', () => {
    const b = bench()
    b.tm.write('PR', 241)
    b.tm.write('CON', 0xf0) // ON, 1:128, 1:1
    b.runTo(b.s(3.5))
    expect(b.flags.length).toBe(3)
    const p = timerPeriodS(INFO3.clock.lfintosc, 128, 241)
    b.flags.forEach((t, i) => expect(Math.abs(t / INFO3.clock.timeBaseHz - (i + 1) * p)).toBeLessThan(1e-6))
  })
  it('lecture de TMRx : compteur courant', () => {
    const b = bench()
    b.tm.write('PR', 255)
    b.tm.write('CON', 0x80) // ON, 1:1
    b.runTo(b.s(10 / INFO3.clock.lfintosc))
    expect(b.tm.read('TMR')).toBe(10)
  })
  it('Monostable front descendant : un front pendant le comptage est ignoré (H33), arrêt à TMRx = 0', () => {
    const b = bench()
    b.tm.write('PR', 154)
    b.tm.write('HLT', 0x12)
    b.tm.write('CON', 0x90) // ON, 1:2, 1:1
    b.runTo(b.s(0.005))
    expect(b.flags.length).toBe(0)
    b.tm.ersEdge(true) // front montant : pas de démarrage
    b.runTo(b.s(0.02))
    expect(b.flags.length).toBe(0)
    b.tm.ersEdge(false)
    const t0 = b.at()
    b.runTo(t0 + b.s(0.003))
    b.tm.ersEdge(false) // rebond pendant le comptage
    b.runTo(t0 + b.s(0.05))
    expect(b.flags.length).toBe(1)
    expect((b.flags[0] - t0) / INFO3.clock.timeBaseHz).toBeCloseTo(0.01, 6)
    expect(b.tm.state).toMatchObject({ tmr: 0, counting: false, on: true })
    b.tm.ersEdge(false) // nouveau front après l'arrêt : redémarre
    b.runTo(b.at() + b.s(0.02))
    expect(b.flags.length).toBe(2)
  })
  it('One-shot logiciel : une période puis TMRxON repasse à 0', () => {
    const b = bench()
    b.tm.write('PR', 9)
    b.tm.write('HLT', 0x08)
    b.tm.write('CON', 0x80)
    b.runTo(b.s(0.01))
    expect(b.flags.length).toBe(1)
    expect(b.cleared()).toBe(1)
    expect(b.tm.on).toBe(false)
  })
})
