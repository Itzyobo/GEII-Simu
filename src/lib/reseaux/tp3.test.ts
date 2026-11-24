import { describe, expect, it } from 'vitest'
import { defaultSetup } from '../scope/engine'
import { bonusExercise, checkScope31, CONSIGNE_31, halvesOf, tp3Attendus } from './tp3'

describe('TP3 : attendus calculés par le moteur', () => {
  it('valeurs du fascicule', () => {
    const a = tp3Attendus()
    expect(a.z).toBe(25)
    expect(a.vMin).toBeCloseTo(0.25, 12)
    expect(a.vMax).toBeCloseTo(1.75, 12)
    expect(a.fPre).toBeCloseTo(5e6, 3)
    expect(a.fFF).toBeCloseTo(10e6, 3)
    expect(a.preSfdUs).toBeCloseTo(6.4, 9)
    expect(a.macUs).toBeCloseTo(4.8, 9)
    expect(a.ping50).toEqual({ octets: 104, us: expect.closeTo(83.2, 9) })
    expect(a.ping5).toEqual({ bourrage: 13, octets: 72, us: expect.closeTo(57.6, 9), trameMin: 64 })
    expect(a.ping5000.n).toBe(4)
    expect(a.ping5000.dernier).toBe(614)
    expect(a.ping5000.ifgUs).toBeCloseTo(9.6, 6)
    expect(a.ping5000.totalUs).toBeCloseTo(4182.4, 6)
  })
  it('chronogrammes : préambule = carré à 5 MHz, FFh = bas/haut à chaque bit', () => {
    expect(Array.from(halvesOf([0x55])).join('')).toBe('0110011001100110')
    expect(Array.from(halvesOf([0xff])).join('')).toBe('0101010101010101')
  })
})

describe('3.1 : vérification des réglages de l’oscilloscope', () => {
  it('Default Setup : tout ce qui diffère est listé', () => {
    const ko = checkScope31(defaultSetup())
    expect(ko.some((k) => k.includes('0,5 V/div'))).toBe(true)
    expect(ko.some((k) => k.includes('descendant'))).toBe(true)
    expect(ko.some((k) => k.includes('Normal'))).toBe(true)
    expect(ko.some((k) => k.includes('−0,1 V'))).toBe(true)
  })
  it('consigne respectée ⇒ aucune remarque', () => {
    const s = defaultSetup()
    s.ch[0].vdiv = CONSIGNE_31.vdiv
    s.sdiv = CONSIGNE_31.sdiv
    s.trig = { ...s.trig, slope: 'descendant', mode: 'normal', level: -0.1 }
    expect(checkScope31(s)).toEqual([])
    s.ch[0].probe = 10
    expect(checkScope31(s)).toHaveLength(1)
  })
})

describe('bonus', () => {
  it('le décodage depuis le « 11 » du SFD retrouve l’octet', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { halves, macByte, skipHalves } = bonusExercise(seed)
      // Le relevé démarre au hasard dans le préambule : on se recale sur les débuts de bit
      const h = halves.subarray(skipHalves % 2)
      const bits = Array.from({ length: Math.floor(h.length / 2) }, (_, i) => h[2 * i + 1])
      // Lecture en partant de la fin : 6 octets de MAC = 48 bits, précédés du « 11 » du SFD
      const mac = bits.slice(bits.length - 48)
      expect(bits.slice(bits.length - 50, bits.length - 48)).toEqual([1, 1])
      expect(mac.slice(0, 8).reduce((v, b, k) => v | (b << k), 0)).toBe(macByte)
    }
  })
})
