/**
 * Banc : établi anthracite, PC à gauche, oscilloscope au centre, cartes et pupitre à droite (onglets sous 768 px).
 * L'étudiant ne fait que les gestes réels : sondes, commutateur, câble série, DB9 vers le pupitre (règle 6).
 */
import { useState } from 'react'
import { Link } from 'react-router'
import { REF } from '../data/reference'
import { signalAt } from '../lib/bench'
import { ACTIVITY_LABEL, dispatch, pointLabel, useStore, type CardId, type ChId, type TestPoint } from '../lib/store'
import type { CableSerie } from '../models/serie'
import ConsoleSerie from '../components/ConsoleSerie'
import RealTerm from '../components/RealTerm'
import type { ProbeInput, ScopeSettings } from '../models/scope'
import InterfaceCard from '../components/InterfaceCard'
import Oscilloscope from '../components/Oscilloscope'
import Pupitre from '../components/Pupitre'
import UnverifiedBadge from '../components/UnverifiedBadge'

/** Réglages de SERIE_1 (photos + H6) : la démo s'affiche telle que relevée au TP. */
const tdiv = REF.scopeSerie1TimeDiv.value
const INITIAL: ScopeSettings = {
  ch: [
    { on: true, vdiv: REF.scopeSerie1TtlVoltDiv.value, offset: 0, probe: REF.scopeSerie1Probe.value },
    { on: false, vdiv: REF.scopeSerie1TtlVoltDiv.value, offset: 0, probe: REF.scopeSerie1Probe.value },
  ],
  tdiv,
  position: REF.scopePositionInitiale.value * tdiv,
  trigger: { source: 0, slope: REF.scopeSerie1Slope.value, level: REF.scopeSerie1TtlLevel.value },
  mode: REF.scopeSerie1Mode.value,
  math: { on: false, src1: 0, src2: 1, vdiv: REF.captureMathVoltDiv.value, offset: 0 },
  cursors: { on: false, x1: REF.scopeCurseursInitiaux.value.x1 * tdiv, x2: REF.scopeCurseursInitiaux.value.x2 * tdiv, y1: REF.ttlLow.value, y2: REF.ttlHigh.value },
}

type Tool = { ch: ChId; part: 'pointe' | 'masse' }
const TOOLS: Tool[] = [
  { ch: 'ch1', part: 'pointe' },
  { ch: 'ch1', part: 'masse' },
  { ch: 'ch2', part: 'pointe' },
  { ch: 'ch2', part: 'masse' },
]
const ZONES = [
  ['pc', 'PC'],
  ['scope', 'Oscilloscope'],
  ['cartes', 'Cartes et pupitre'],
] as const
type Zone = (typeof ZONES)[number][0]

/** Clic sur le DB9 « vers autre carte » : aucun câble → croisé → droit → aucun */
const NEXT_CABLE: Record<'aucun' | CableSerie, CableSerie | null> = { aucun: 'croisé', croisé: 'droit', droit: null }

export default function Banc() {
  const s = useStore()
  const [tool, setTool] = useState<Tool>(TOOLS[0]!)
  const [zone, setZone] = useState<Zone>('scope')
  const w = s.wiring

  const inputs = (['ch1', 'ch2'] as const).map(
    (c): ProbeInput => ({
      signal: w.probes[c].tip ? signalAt(w.probes[c].tip, s) : null,
      probe: w.attenuation[c],
      ground: w.probes[c].tip === null || w.probes[c].ground !== null,
    }),
  ) as [ProbeInput, ProbeInput]

  const onPoint = (card: CardId) => (p: TestPoint) => {
    if (tool.part !== 'pointe') return
    const target = `${card}.${p}` as const
    dispatch({ type: 'probe', ch: tool.ch, tip: w.probes[tool.ch].tip === target ? null : target })
  }
  const onGround = (card: CardId) => () => {
    if (tool.part !== 'masse') return
    dispatch({ type: 'ground', ch: tool.ch, card: w.probes[tool.ch].ground === card ? null : card })
  }
  const hidden = (z: Zone) => (zone === z ? '' : 'max-md:hidden')

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#2b2e33] bg-[linear-gradient(#ffffff08_1px,transparent_1px),linear-gradient(90deg,#ffffff08_1px,transparent_1px)] bg-[size:24px_24px] px-3 py-4 text-neutral-100">
      <div className="mx-auto max-w-[1600px]">
        {/* Barre de manip */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-black/30 p-3 text-sm">
          <span className="text-neutral-400">En main :</span>
          {TOOLS.map((t) => {
            const on = t.ch === tool.ch && t.part === tool.part
            return (
              <button
                key={`${t.ch}${t.part}`}
                type="button"
                aria-pressed={on}
                onClick={() => setTool(t)}
                className={`min-h-10 rounded-lg px-3 ring-1 ${on ? 'bg-white text-black ring-white' : 'ring-white/20 hover:bg-white/10'}`}
              >
                <span className={`mr-1.5 inline-block size-2.5 rounded-full ${t.ch === 'ch1' ? 'bg-yellow-400' : 'bg-green-500'}`} />
                {t.ch === 'ch1' ? 'Ch1' : 'Ch2'} {t.part === 'pointe' ? 'pointe' : 'pince de masse'}
              </button>
            )
          })}
          <span className="ml-2 text-neutral-400">Sondes :</span>
          {(['ch1', 'ch2'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => dispatch({ type: 'attenuation', ch: c, value: w.attenuation[c] === 1 ? 10 : 1 })}
              className="min-h-10 rounded-lg px-3 ring-1 ring-white/20 hover:bg-white/10"
              title="Inverseur ×1 / ×10 sur le corps de la sonde"
            >
              {c === 'ch1' ? 'Ch1' : 'Ch2'} ×{w.attenuation[c]}
            </button>
          ))}
          <span className="flex-1" />
          <button type="button" onClick={() => dispatch({ type: 'verify' })} disabled={s.bus.active} className="min-h-10 rounded-lg bg-sky-600 px-4 font-semibold disabled:opacity-40">
            Faire vérifier ({ACTIVITY_LABEL[s.session.activity]})
          </button>
        </div>

        {/* Retour de vérification, refus, incidents */}
        <div className="mt-2 space-y-1 text-sm" aria-live="polite">
          {s.bus.active && <p className="text-emerald-300">● {ACTIVITY_LABEL[s.session.activity]} tourne sur le PC n°1. Ne débranchez rien.</p>}
          {s.notice && <p className="text-red-300">{s.notice}</p>}
          {s.check?.ok && !s.bus.active && <p className="text-emerald-300">Câblage vérifié : lancez le programme depuis la console du PC n°1.</p>}
          {s.check && !s.check.ok && (
            <ul className="list-inside list-disc text-amber-300">
              {s.check.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {s.check?.errors.some((e) => e.includes('H18')) && <UnverifiedBadge deps={['controleFluxRequis']} />}
          <p className="text-neutral-400">
            Ch1 : {w.probes.ch1.tip ? pointLabel(w.probes.ch1.tip) : 'en l’air'}
            {w.probes.ch1.ground ? ', masse reliée' : ''} · Ch2 : {w.probes.ch2.tip ? pointLabel(w.probes.ch2.tip) : 'en l’air'}
            {w.probes.ch2.ground ? ', masse reliée' : ''} · câble série : {w.serialCable ?? 'aucun'} · incidents : {s.incidents.length}
          </p>
        </div>

        {/* Onglets sous 768 px */}
        <div className="mt-3 flex gap-1 md:hidden" role="tablist">
          {ZONES.map(([z, label]) => (
            <button key={z} type="button" role="tab" aria-selected={zone === z} onClick={() => setZone(z)} className={`min-h-10 flex-1 rounded-lg text-sm ${zone === z ? 'bg-white text-black' : 'bg-white/10'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)_minmax(0,1.1fr)]">
          {/* PC n°1 (console SERIE) et PC n°2 (RealTerm, 2.4) */}
          <section className={`${hidden('pc')} space-y-3 md:col-span-2 xl:col-span-1`} aria-label="PC">
            <div className="rounded-xl bg-[#1b1d20] p-3 ring-1 ring-white/10">
              <p className="mb-2 text-xs font-semibold text-neutral-300">PC n°1 · COM1 → carte 1</p>
              <ConsoleSerie />
              <p className="mt-2 text-xs text-neutral-400">
                SERVEUR JBUS/MODBUS : rôle {s.software.role}, {s.software.memorized.length} trame(s) mémorisée(s) ·{' '}
                <Link to="/modbus/logiciel" className="underline">
                  ouvrir le logiciel
                </Link>
              </p>
            </div>
            <div className="rounded-xl bg-[#1b1d20] p-3 ring-1 ring-white/10">
              <p className="mb-2 text-xs font-semibold text-neutral-300">PC n°2 · COM1 → carte 2</p>
              <RealTerm />
            </div>
          </section>

          {/* Oscilloscope */}
          <section className={hidden('scope')} aria-label="Oscilloscope">
            <Oscilloscope inputs={inputs} initial={INITIAL} />
          </section>

          {/* Cartes et pupitre */}
          <section className={`${hidden('cartes')} space-y-3`} aria-label="Cartes et pupitre">
            {(['c1', 'c2'] as const).map((card) => (
              <div key={card} className="rounded-xl bg-[#1b1d20] p-2 ring-1 ring-white/10">
                <InterfaceCard
                  card={card}
                  wiring={w}
                  onPoint={onPoint(card)}
                  onGround={onGround(card)}
                  onFlow={() => dispatch({ type: 'flow', card, on: !w.flow[card] })}
                  onSerial={() => dispatch({ type: 'serialCable', cable: NEXT_CABLE[w.serialCable ?? 'aucun'] })}
                  onDb9={() => dispatch({ type: 'db9', card, on: !w.db9[card] })}
                />
              </div>
            ))}
            <div className="rounded-xl bg-[#1b1d20] p-2 ring-1 ring-white/10">
              <Pupitre wiring={w} />
            </div>
            <p className="text-xs text-neutral-400">Carte et pupitre reconstitués (pas de photo de face) : emplacement des points de test d’après le schéma TP-10.</p>
          </section>
        </div>
      </div>
    </main>
  )
}
