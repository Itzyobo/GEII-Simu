import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { AU3_INSTRUMENTS } from '../../data/reference'
import {
  acquerir,
  exporterCsv,
  HAUTEUR_PX,
  LARGEUR_PX,
  lireCurseurs,
  mesurer,
  moyenner,
  NB_VOIES,
  planAcquisition,
  tempsVersPx,
  tensionVersPx,
  type Curseurs,
  type Enregistrement,
  type PlanAcquisition,
  type ReglagesOscillo,
  type Signaux,
  type Voie,
} from '../instruments/oscillo'
import { mulberry32 } from '../sim/prng'
import type { Borne as IdBorne } from '../sim/cablage'
import { Borne } from './Borne'
import { formatSi } from './format'
import type { PropsBornes } from './types'

const O = AU3_INSTRUMENTS.oscillo
const PX = O.pxParDiv
type CurseurId = 'x1' | 'x2' | 'y1' | 'y2'
const SONDES: IdBorne[] = ['osc.v1', 'osc.v2', 'osc.v3', 'osc.v4']

export interface PropsOscillo {
  osc: ReglagesOscillo
  curseurs: Curseurs
  onOsc: (p: Partial<ReglagesOscillo>) => void
  onCurseurs: (p: Partial<Curseurs>) => void
  onAutoscale: () => void
  /** Une simulation du banc pour une graine et un plan d'acquisition */
  simuler: (graine: number, plan: PlanAcquisition) => Signaux
  periode: number | null
  pasEuler: number
  bornes: PropsBornes
}

const fmtV = (v: number) => formatSi(v, 'V')
const fmtS = (v: number) => formatSi(v, 's')

/** Oscilloscope Keysight DSOX2004A : écran 10 × 8 divisions, 4 voies, déclenchement, moyennage, curseurs, mesures, Run/Stop, .csv */
export default function Oscillo({ osc, curseurs, onOsc, onCurseurs, onAutoscale, simuler, periode, pasEuler, bornes }: PropsOscillo) {
  const [rec, setRec] = useState<Enregistrement | null>(null)
  const [actif, setActif] = useState<CurseurId>('x1')
  const [voieMesure, setVoieMesure] = useState(1)
  const tampon = useRef<Enregistrement[]>([])
  const graine = useRef<number>(AU3_INSTRUMENTS.ui.graineInitiale)

  // Acquisition en Run : une nouvelle acquisition par rafraîchissement ; moyennage glissant sur les N dernières
  useEffect(() => {
    tampon.current = []
    if (!osc.run) return
    const une = () => {
      const g = graine.current++
      const plan = planAcquisition(osc, periode, pasEuler)
      const r = acquerir(osc, simuler(g, plan), plan, mulberry32(g)())
      if (!r) return
      tampon.current = [...tampon.current, r].slice(-osc.moyennage)
      setRec(moyenner(tampon.current))
    }
    une()
    const id = setInterval(une, O.rafraichissementMs)
    return () => clearInterval(id)
  }, [osc, simuler, periode, pasEuler])

  const lecture = lireCurseurs(curseurs, osc, rec)
  const mesures = mesurer(rec, voieMesure)
  const setVoie = (j: number, p: Partial<Voie>) => onOsc({ voies: osc.voies.map((v, k) => (k === j ? { ...v, ...p } : v)) })
  const deplacer = (id: CurseurId, px: number) => onCurseurs({ [id]: Math.round(Math.max(0, Math.min(id.startsWith('x') ? LARGEUR_PX : HAUTEUR_PX, px))) })

  const pointer = (e: PointerEvent<SVGSVGElement>) => {
    if (e.type === 'pointermove' && e.buttons !== 1) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) * LARGEUR_PX) / r.width
    const y = ((e.clientY - r.top) * HAUTEUR_PX) / r.height
    deplacer(actif, actif.startsWith('x') ? x : y)
  }

  const exporter = () => {
    if (!rec) return
    const url = URL.createObjectURL(new Blob([exporterCsv(rec)], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'scope_0.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const trace = (j: number) => {
    const x = rec?.voies[j]
    const v = osc.voies[j]
    if (!x || !v?.active || !rec) return null
    const pts: string[] = []
    x.forEach((val, k) => pts.push(`${tempsVersPx(rec.t0 + k * rec.dt, osc.sdiv).toFixed(1)},${tensionVersPx(val, v.vdiv, v.position).toFixed(1)}`))
    return <polyline key={j} points={pts.join(' ')} fill="none" stroke={O.couleurs[j]} strokeWidth="1.5" strokeLinejoin="round" />
  }

  const ligneX = (id: 'x1' | 'x2') => <line x1={curseurs[id]} x2={curseurs[id]} y1={0} y2={HAUTEUR_PX} stroke="#e8e8e8" strokeDasharray="4 3" strokeWidth={actif === id ? 2 : 1} />
  const yPx = (id: 'y1' | 'y2') => {
    const v = osc.voies[curseurs.source]
    const val = id === 'y1' ? lecture.y1 : lecture.y2
    return curseurs.suivre ? (val === null || !v ? null : tensionVersPx(val, v.vdiv, v.position)) : curseurs[id]
  }
  const ligneY = (id: 'y1' | 'y2') => {
    const y = yPx(id)
    return y === null ? null : <line x1={0} x2={LARGEUR_PX} y1={y} y2={y} stroke={O.couleurs[curseurs.source]} strokeDasharray="4 3" strokeWidth={actif === id ? 2 : 1} />
  }

  return (
    <section aria-label="Oscilloscope Keysight DSOX2004A" className="rounded-lg bg-[#3b3f46] p-2 shadow-xl ring-1 ring-black/40">
      <p className="mb-1 text-[11px] font-bold tracking-wider text-[#d0d4da]">KEYSIGHT · DSOX2004A</p>
      <div className="flex gap-2">
        <div>
          {/* Bandeau du haut : calibres des voies, base de temps, état */}
          <div className="flex items-center gap-3 rounded-t bg-black px-2 py-0.5 font-mono text-[11px]">
            {osc.voies.map((v, j) =>
              v.active ? (
                <span key={j} style={{ color: O.couleurs[j] }}>
                  {j + 1} {fmtV(v.vdiv)}/{v.couplage === 'AC' ? ' AC' : ''}
                </span>
              ) : null,
            )}
            <span className="ml-auto text-[#e8e8e8]">{fmtS(osc.sdiv)}/</span>
            <span className={osc.run ? 'text-[#5ad48a]' : 'text-[#ff6b6b]'}>{osc.run ? 'Run' : 'Arrêter'}</span>
            <span className="text-[#e8e8e8]">{osc.declenchement.mode === 'normal' ? 'Norm' : 'Auto'}</span>
          </div>
          <svg
            width={LARGEUR_PX}
            height={HAUTEUR_PX}
            viewBox={`0 0 ${LARGEUR_PX} ${HAUTEUR_PX}`}
            className="block touch-none bg-black font-mono"
            role="img"
            aria-label="Écran de l’oscilloscope"
            onPointerDown={pointer}
            onPointerMove={pointer}
          >
            <defs>
              <clipPath id="au3-ecran">
                <rect width={LARGEUR_PX} height={HAUTEUR_PX} />
              </clipPath>
            </defs>
            {Array.from({ length: O.divX + 1 }, (_, i) => (
              <line key={`gx${i}`} x1={i * PX} x2={i * PX} y1={0} y2={HAUTEUR_PX} stroke="#3a3a3a" strokeDasharray={i * 2 === O.divX ? undefined : '1 4'} />
            ))}
            {Array.from({ length: O.divY + 1 }, (_, i) => (
              <line key={`gy${i}`} x1={0} x2={LARGEUR_PX} y1={i * PX} y2={i * PX} stroke="#3a3a3a" strokeDasharray={i * 2 === O.divY ? undefined : '1 4'} />
            ))}
            <g clipPath="url(#au3-ecran)">{osc.voies.map((_, j) => trace(j))}</g>
            {/* Repères : instant du déclenchement (T), 0 V de chaque voie */}
            <text x={tempsVersPx(0, osc.sdiv)} y="10" fill="#f5a524" fontSize="11" textAnchor="middle">
              T
            </text>
            {osc.voies.map((v, j) =>
              v.active ? (
                <text key={j} x="2" y={Math.max(PX / 2, Math.min(HAUTEUR_PX, tensionVersPx(0, v.vdiv, v.position)))} dy="4" fill={O.couleurs[j]} fontSize="10">
                  {j + 1}▸
                </text>
              ) : null,
            )}
            {ligneX('x1')}
            {ligneX('x2')}
            {ligneY('y1')}
            {ligneY('y2')}
            {!rec && (
              <text x={LARGEUR_PX / 2} y={HAUTEUR_PX / 2} fill="#888" fontSize="13" textAnchor="middle">
                {osc.run ? 'Attente du déclenchement…' : 'Aucune acquisition'}
              </text>
            )}
          </svg>
          <div className="flex items-end justify-between rounded-b bg-[#2b2e33] px-2 pt-1 pb-1.5">
            {SONDES.map((id, j) => (
              <span key={id} className="flex items-end gap-1">
                <Borne id={id} couleur="bnc" choisie={bornes.choisie === id} verrouillee={bornes.verrouillee} onClick={bornes.onBorne} />
                <span className="pb-1 font-mono text-[11px] font-bold" style={{ color: O.couleurs[j] }}>
                  {j + 1}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Colonne de droite : Acquisition, Voies, Déclenchement, Curseurs, Mesures */}
        <div className="w-56 space-y-1.5 text-[11px] text-[#e3e6ea]">
          <div className="flex gap-1">
            <button type="button" onClick={() => onOsc({ run: !osc.run })} className={`flex-1 rounded px-2 py-1 font-semibold ${osc.run ? 'bg-[#2e7d32]' : 'bg-[#c62828]'}`}>
              {osc.run ? 'Run → Stop' : 'Stop → Run'}
            </button>
            <button type="button" onClick={onAutoscale} className="rounded bg-[#555] px-2 py-1" title="NE JAMAIS APPUYER SUR AUTOSCALE">
              Autoscale
            </button>
            <button type="button" onClick={exporter} disabled={!rec} className="rounded bg-au3-accent px-2 py-1 font-semibold text-black disabled:opacity-40">
              .csv
            </button>
          </div>

          <fieldset className="rounded bg-black/30 p-1.5">
            <legend className="px-1 text-au3-muted">Horizontal · Acquisition</legend>
            <label className="flex items-center justify-between">
              s/div
              <select value={osc.sdiv} onChange={(e) => onOsc({ sdiv: Number(e.target.value) })} className="rounded bg-[#222] px-1">
                {O.calibresS.map((s) => (
                  <option key={s} value={s}>
                    {fmtS(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-1 flex items-center justify-between">
              Moyennage
              <select value={osc.moyennage} onChange={(e) => onOsc({ moyennage: Number(e.target.value) })} className="rounded bg-[#222] px-1">
                {O.moyennages.map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? 'Normal' : `Moyenne ${n}`}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          <fieldset className="rounded bg-black/30 p-1.5">
            <legend className="px-1 text-au3-muted">Voies</legend>
            {osc.voies.map((v, j) => (
              <div key={j} className="flex items-center gap-1 py-0.5">
                <label className="flex w-7 items-center gap-0.5 font-bold" style={{ color: O.couleurs[j] }}>
                  <input type="checkbox" checked={v.active} onChange={(e) => setVoie(j, { active: e.target.checked })} aria-label={`Voie ${j + 1} active`} />
                  {j + 1}
                </label>
                <select value={v.vdiv} onChange={(e) => setVoie(j, { vdiv: Number(e.target.value) })} className="w-[4.6rem] rounded bg-[#222] px-0.5" aria-label={`Calibre voie ${j + 1}`}>
                  {O.calibresV.map((c) => (
                    <option key={c} value={c}>
                      {fmtV(c)}
                    </option>
                  ))}
                </select>
                <button type="button" className="rounded bg-[#444] px-1" aria-label={`Descendre la voie ${j + 1}`} onClick={() => setVoie(j, { position: v.position - O.pasPosition })}>
                  ▼
                </button>
                <button type="button" className="rounded bg-[#444] px-1" aria-label={`Monter la voie ${j + 1}`} onClick={() => setVoie(j, { position: v.position + O.pasPosition })}>
                  ▲
                </button>
                <button type="button" className="rounded bg-[#444] px-1" onClick={() => setVoie(j, { couplage: v.couplage === 'DC' ? 'AC' : 'DC' })} aria-label={`Couplage voie ${j + 1}`}>
                  {v.couplage}
                </button>
              </div>
            ))}
          </fieldset>

          <fieldset className="rounded bg-black/30 p-1.5">
            <legend className="px-1 text-au3-muted">Déclenchement</legend>
            <div className="flex items-center gap-1">
              <select value={osc.declenchement.source} onChange={(e) => onOsc({ declenchement: { ...osc.declenchement, source: Number(e.target.value) } })} className="rounded bg-[#222] px-1" aria-label="Source du déclenchement">
                {Array.from({ length: NB_VOIES }, (_, j) => (
                  <option key={j} value={j}>
                    Voie {j + 1}
                  </option>
                ))}
              </select>
              <button type="button" className="rounded bg-[#444] px-1.5" onClick={() => onOsc({ declenchement: { ...osc.declenchement, front: osc.declenchement.front === 'montant' ? 'descendant' : 'montant' } })} aria-label="Front">
                {osc.declenchement.front === 'montant' ? '↑ montant' : '↓ descendant'}
              </button>
              <button type="button" className="rounded bg-[#444] px-1.5" onClick={() => onOsc({ declenchement: { ...osc.declenchement, mode: osc.declenchement.mode === 'normal' ? 'auto' : 'normal' } })} aria-label="Mode de déclenchement">
                {osc.declenchement.mode === 'normal' ? 'Normal' : 'Auto'}
              </button>
            </div>
            <label className="mt-1 flex items-center justify-between">
              Niveau
              <input type="number" step={O.pasNiveau} value={osc.declenchement.niveau} onChange={(e) => onOsc({ declenchement: { ...osc.declenchement, niveau: Number(e.target.value) } })} className="w-20 rounded bg-[#222] px-1 text-right font-mono" />
            </label>
          </fieldset>

          <fieldset className="rounded bg-black/30 p-1.5">
            <legend className="px-1 text-au3-muted">Curseurs</legend>
            <div className="flex items-center gap-1" role="group" aria-label="Curseur actif">
              {(['x1', 'x2', 'y1', 'y2'] as const).map((id) => (
                <button key={id} type="button" aria-pressed={actif === id} onClick={() => setActif(id)} className={`rounded px-1.5 ${actif === id ? 'bg-au3-accent text-black' : 'bg-[#444]'}`}>
                  {id.toUpperCase()}
                </button>
              ))}
              <button type="button" className="rounded bg-[#444] px-1" aria-label="Curseur actif : 1 pixel en arrière" onClick={() => deplacer(actif, curseurs[actif] - 1)}>
                ◀
              </button>
              <button type="button" className="rounded bg-[#444] px-1" aria-label="Curseur actif : 1 pixel en avant" onClick={() => deplacer(actif, curseurs[actif] + 1)}>
                ▶
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <select value={curseurs.source} onChange={(e) => onCurseurs({ source: Number(e.target.value) })} className="rounded bg-[#222] px-1" aria-label="Source des curseurs">
                {Array.from({ length: NB_VOIES }, (_, j) => (
                  <option key={j} value={j}>
                    Source {j + 1}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={curseurs.suivre} onChange={(e) => onCurseurs({ suivre: e.target.checked })} />
                suivre signal
              </label>
            </div>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 font-mono">
              <dt>X1</dt>
              <dd className="text-right">{fmtS(lecture.x1)}</dd>
              <dt>X2</dt>
              <dd className="text-right">{fmtS(lecture.x2)}</dd>
              <dt>ΔX</dt>
              <dd className="text-right">{fmtS(lecture.dx)}</dd>
              <dt>1/ΔX</dt>
              <dd className="text-right">{formatSi(Number.isFinite(lecture.invDx) ? lecture.invDx : null, 'Hz')}</dd>
              <dt>Y1</dt>
              <dd className="text-right">{formatSi(lecture.y1, 'V')}</dd>
              <dt>Y2</dt>
              <dd className="text-right">{formatSi(lecture.y2, 'V')}</dd>
              <dt>ΔY</dt>
              <dd className="text-right">{formatSi(lecture.dy, 'V')}</dd>
            </dl>
          </fieldset>

          <fieldset className="rounded bg-black/30 p-1.5">
            <legend className="px-1 text-au3-muted">Mesures</legend>
            <select value={voieMesure} onChange={(e) => setVoieMesure(Number(e.target.value))} className="rounded bg-[#222] px-1" aria-label="Voie mesurée">
              {Array.from({ length: NB_VOIES }, (_, j) => (
                <option key={j} value={j}>
                  Voie {j + 1}
                </option>
              ))}
            </select>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 font-mono" style={{ color: O.couleurs[voieMesure] }}>
              <dt>Ampl</dt>
              <dd className="text-right">{formatSi(mesures?.ampl ?? null, 'V')}</dd>
              <dt>Max</dt>
              <dd className="text-right">{formatSi(mesures?.max ?? null, 'V')}</dd>
              <dt>Min</dt>
              <dd className="text-right">{formatSi(mesures?.min ?? null, 'V')}</dd>
              <dt>Cr-cr</dt>
              <dd className="text-right">{formatSi(mesures?.crcr ?? null, 'V')}</dd>
            </dl>
          </fieldset>
        </div>
      </div>
    </section>
  )
}
