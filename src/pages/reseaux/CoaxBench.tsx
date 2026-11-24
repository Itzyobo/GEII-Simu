/**
 * Banc du TP1 câble coaxial (réutilisé par le partiel) : générateur d'impulsions ou sinus (Zg = 50 Ω),
 * Té vers CH1, câble enroulé, extrémité au choix (ouverte, court-circuit, potentiomètre + ohmmètre, bouchons,
 * Té vers CH2), mode « générateur à vide », et l'oscilloscope en Default Setup.
 */
import { useMemo, useState, type ReactNode } from 'react'
import Knob from '../../components/Knob'
import ScopeInstrument from '../../components/ScopeInstrument'
import { OSCILLO, RES3 } from '../../data/reference'
import { mulberry32 } from '../../au3/sim/prng'
import { alphaAt, coaxSources, termsSource, type Cable, type Waveform } from '../../lib/reseaux/coax'
import type { SignalSource } from '../../lib/scope/types'
import { Btn, Card } from './ui'

type Extremite = 'ouverte' | 'cc' | 'pot' | 'b50' | 'b75' | 'ch2'
const EXTREMITES: [Extremite, string][] = [
  ['ouverte', 'Ouverte'],
  ['cc', 'Court-circuit'],
  ['pot', 'Potentiomètre 0–200 Ω'],
  ['b50', 'Bouchon 50 Ω'],
  ['b75', 'Bouchon 75 Ω'],
  ['ch2', 'Té vers CH2 + bouchon'],
]
const par = (a: number, b: number) => (a * b) / (a + b)
const n3 = (v: number) => String(Number(v.toPrecision(3))).replace('.', ',')

/** `top` : carte affichée au-dessus du générateur (câble mystère, consignes du partiel…) */
export default function CoaxBench({ cable, seed, top }: { cable: Cable; seed: number; top?: ReactNode }) {
  const [gen, setGen] = useState<{ on: boolean; mode: 'pulse' | 'sine'; eg: number; width: number; period: number; f: number }>({
    on: true,
    mode: 'pulse',
    eg: RES3.genInitial.eg,
    width: RES3.genInitial.largeur,
    period: RES3.genInitial.periode,
    f: RES3.genInitial.f,
  })
  const [ext, setExt] = useState<Extremite>('ouverte')
  const [bouchonCh2, setBouchonCh2] = useState<50 | 75>(50)
  const [pot, setPot] = useState({ R: 120, connecte: true })
  const [aVide, setAVide] = useState(false)

  const ZL = { ouverte: Infinity, cc: 0, pot: pot.connecte ? pot.R : Infinity, b50: 50, b75: 75, ch2: par(bouchonCh2, OSCILLO.rEntree) }[ext]
  const sources = useMemo((): [SignalSource | null, SignalSource | null] => {
    const wave: Waveform = gen.mode === 'pulse' ? { kind: 'pulse', width: Math.min(gen.width, gen.period / 2), period: gen.period } : { kind: 'sine', f: gen.f }
    if (!gen.on) return [termsSource([], wave), ext === 'ch2' && !aVide ? termsSource([], wave) : null]
    if (aVide) return [coaxSources({ Eg: gen.eg, Zc: RES3.cables.RG58.zc, l: RES3.lCordon, ZL: OSCILLO.rEntree, alpha: 0, wave }).ch1, null]
    const c = RES3.cables[cable.type]
    const alpha = gen.mode === 'pulse' ? c.alpha10M : alphaAt(c, gen.f)
    const s = coaxSources({ Eg: gen.eg, Zc: cable.Zc, l: cable.l, ZL, alpha, wave })
    return [s.ch1, ext === 'ch2' ? s.end : null]
  }, [gen, aVide, cable, ZL, ext])

  // Ohmmètre : lisible seulement potentiomètre débranché, ±0,5 % (écart propre à la valeur réglée)
  const ohm = pot.connecte ? null : pot.R * (1 + (2 * mulberry32(seed + Math.round(pot.R * 10))() - 1) * RES3.ohmmetreTol)

  return (
        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="grid content-start gap-4">
            {top}
            <Card title="Générateur d’impulsions (Zg = 50 Ω)">
              <div className="flex flex-wrap items-center gap-2">
                <Btn onClick={() => setGen({ ...gen, on: !gen.on })} pressed={gen.on}>
                  Sortie {gen.on ? 'ON' : 'OFF'}
                </Btn>
                <Btn onClick={() => setGen({ ...gen, mode: 'pulse' })} pressed={gen.mode === 'pulse'}>
                  Impulsions
                </Btn>
                <Btn onClick={() => setGen({ ...gen, mode: 'sine' })} pressed={gen.mode === 'sine'}>
                  Sinus
                </Btn>
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                <Knob label="Amplitude à vide" value={gen.eg} onChange={(eg) => setGen({ ...gen, eg })} unit="V" min={0} max={10} step={0.05} />
                {gen.mode === 'pulse' ? (
                  <>
                    <Knob label="Largeur" value={gen.width} onChange={(width) => setGen({ ...gen, width })} unit="s" min={10e-9} max={1e-3} step={1e-9} log />
                    <Knob label="Période" value={gen.period} onChange={(period) => setGen({ ...gen, period })} unit="s" min={1e-6} max={1} step={1e-7} log />
                  </>
                ) : (
                  <Knob label="Fréquence" value={gen.f} onChange={(f) => setGen({ ...gen, f })} unit="Hz" min={1e3} max={20e6} step={1e3} log />
                )}
              </div>
            </Card>

            <Card title="Montage">
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={aVide} onChange={(e) => setAVide(e.target.checked)} className="h-4 w-4" />
                Générateur à vide (cordon court de 1 m direct sur CH1, sans le câble)
              </label>
              <Schema cable={cable} ext={ext} aVide={aVide} />
              <fieldset disabled={aVide} className="mt-2 grid gap-1 disabled:opacity-40">
                <legend className="text-xs text-muted">Extrémité du câble</legend>
                {EXTREMITES.map(([k, label]) => (
                  <label key={k} className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="radio" name="ext" checked={ext === k} onChange={() => setExt(k)} className="h-4 w-4" />
                    {label}
                  </label>
                ))}
              </fieldset>
              {ext === 'ch2' && !aVide && (
                <div className="mt-1 flex gap-2">
                  {([50, 75] as const).map((b) => (
                    <Btn key={b} onClick={() => setBouchonCh2(b)} pressed={bouchonCh2 === b}>
                      Bouchon {b} Ω
                    </Btn>
                  ))}
                </div>
              )}
              {ext === 'pot' && !aVide && (
                <div className="mt-2 flex flex-wrap items-end gap-3 rounded-lg bg-card-2 p-2">
                  <Knob label="Potentiomètre" value={pot.R} onChange={(R) => setPot({ ...pot, R })} unit="Ω" min={0} max={RES3.potMax} step={0.5} />
                  <Btn onClick={() => setPot({ ...pot, connecte: !pot.connecte })} pressed={pot.connecte}>
                    {pot.connecte ? 'Branché sur le câble' : 'Débranché'}
                  </Btn>
                  <div className="font-mono text-sm">
                    Ohmmètre : {ohm === null ? <span className="text-muted">débranchez le potentiomètre</span> : `${ohm.toFixed(1).replace('.', ',')} Ω`}
                  </div>
                </div>
              )}
            </Card>
          </div>
          <ScopeInstrument sources={sources} />
        </section>
  )
}

/** Schéma du banc : générateur → Té CH1 → câble enroulé → extrémité */
function Schema({ cable, ext, aVide }: { cable: { N: number; D: number }; ext: Extremite; aVide: boolean }) {
  const label = aVide ? 'cordon 1 m' : `${cable.N} spires · D = ${n3(cable.D)} m`
  const end = aVide ? '' : (EXTREMITES.find(([k]) => k === ext)?.[1] ?? '')
  return (
    <svg viewBox="0 0 340 110" className="mt-2 w-full" role="img" aria-label={`Schéma : générateur, Té vers CH1, ${label}, extrémité ${end}`}>
      <g fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink">
        <rect x="4" y="30" width="56" height="40" rx="4" />
        <circle cx="24" cy="50" r="9" />
        <path d="M18 50 h4 v-5 h4 v10 h4" />
        <path d="M60 50 h30" />
        <path d="M90 42 v16 M90 50 h14" />
        <path d="M90 42 v-22 h-10" />
        {aVide ? (
          <path d="M104 50 h40" />
        ) : (
          <>
            <path d="M104 50 h20" />
            {Array.from({ length: 6 }, (_, i) => (
              <ellipse key={i} cx={140 + i * 16} cy="50" rx="10" ry="22" />
            ))}
            <path d="M230 50 h40" />
          </>
        )}
      </g>
      <text x="4" y="86" className="fill-current text-[10px]">
        Gén. Zg = 50 Ω
      </text>
      <text x="62" y="16" className="fill-current text-[10px]">
        CH1 (1 MΩ)
      </text>
      <text x="110" y="100" className="fill-current text-[10px]">
        {label}
      </text>
      {!aVide && (
        <text x="272" y="54" className="fill-current text-[10px]">
          {end.replace('Potentiomètre 0–200 Ω', 'Pot.').replace('Té vers CH2 + bouchon', 'Té CH2')}
        </text>
      )}
    </svg>
  )
}
