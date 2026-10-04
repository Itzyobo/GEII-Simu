import { useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MAS } from '../data/reference'
import { Cell, GradeBar, num, TOL_CALC, TOL_READ, useTableGrading, type Check } from '../components/Worksheet'
import { inverterVoltage, lossSeparation, motorState, powerBalance, syncSpeed } from '../models/asyncMotor'

const fr = (x: number, digits = 3) => String(Number(x.toPrecision(digits))).replace('.', ',')

/** Explications des feuilles de calcul notées (cartes et clé de correction d'examen). */
export const TABLE_EXPLANATIONS = {
  releve: 'Ω = N·π/30 ; Pu = Cu·Ω ; g = (Ns − N)/Ns ; S = √(Pa² + Qa²) ; η = Pu/Pa ; cos φ = Pa/S. Lectures attendues à ±5 % du banc.',
  variateur: 'U lu en mode harmonique (fondamental) ; U/f ≈ 8 V/Hz constant.',
  pertes: 'PjsΔ = 3·Rs·(I0Δ/√3)², PjsY = 3·Rs·I0Y², α = (PcΔ − PcY)/(U² − V²), Pméca = PcΔ − α·U².',
  bilan: 'Pjs = 3·Rs·(Is/√3)², Pfer = α·U², Ptr = Pa − Pjs − Pfer, Pjr = g·Ptr, Pméca = Ptr − Pjr − Pu, η = Pu/Pa.',
}

/* ─────────────────────────── Courbes ─────────────────────────── */

function Chart({ title, data, x, lines, xLabel, yFromZero }: { title: string; data: Record<string, number>[]; x: string; xLabel: string; yFromZero?: boolean; lines: { key: string; name: string; color: string; right?: boolean }[] }) {
  const hasRight = lines.some((l) => l.right)
  return (
    <div className="rounded-lg bg-card-2 p-2">
      <div className="mb-1 text-xs font-semibold text-muted">{title}</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={[...data].sort((a, b) => a[x] - b[x])} margin={{ top: 5, right: 10, bottom: 15, left: 0 }}>
          <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
          <XAxis dataKey={x} type="number" domain={['auto', 'auto']} stroke="var(--color-muted)" fontSize={10} label={{ value: xLabel, position: 'insideBottom', offset: -8, fill: 'var(--color-muted)', fontSize: 10 }} />
          <YAxis yAxisId="l" stroke="var(--color-muted)" fontSize={10} domain={yFromZero ? [0, 'auto'] : ['auto', 'auto']} />
          {hasRight && <YAxis yAxisId="r" orientation="right" stroke="var(--color-muted)" fontSize={10} domain={['auto', 'auto']} />}
          <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-line)', borderRadius: 10, fontSize: 11 }} />
          {lines.length > 1 && <Legend verticalAlign="top" wrapperStyle={{ fontSize: 10 }} />}
          {lines.map((l) => (
            <Line key={l.key} yAxisId={l.right ? 'r' : 'l'} dataKey={l.key} name={l.name} stroke={l.color} dot={{ r: 3 }} isAnimationActive={false} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ─────────────────────────── Tableau de relevés (Q3) ─────────────────────────── */

const LOADS = ['A vide 0', '¼ charge nominale', '½ charge nominale', '¾ charge Nominale', 'Charge nominale']
const LOAD_TORQUES = [0, 2.5, 5, 7.5, 10]
type RowKey = 'cu' | 'n' | 'omega' | 'pu' | 'is' | 'v' | 'g' | 'pa' | 'qa' | 's' | 'eta' | 'cos'
const ROWS: { key: RowKey; label: string; calc: boolean }[] = [
  { key: 'cu', label: 'Cu (N.m) mesure', calc: false },
  { key: 'n', label: 'Vitesse (tr/mn)', calc: false },
  { key: 'omega', label: 'Ω (rd/s) calcul', calc: true },
  { key: 'pu', label: 'Pu (W) calcul', calc: true },
  { key: 'is', label: 'Is (A) mesure', calc: false },
  { key: 'v', label: 'V (volt) mesure', calc: false },
  { key: 'g', label: 'g (%) calcul', calc: true },
  { key: 'pa', label: 'Pa (W) mesure', calc: false },
  { key: 'qa', label: 'Qa (var) mesure', calc: false },
  { key: 's', label: 'S (VA) calcul', calc: true },
  { key: 'eta', label: 'η (%) calcul', calc: true },
  { key: 'cos', label: 'cos φ calcul', calc: true },
]

/** Contrôle d'une case : calcul depuis les mesures saisies (±3 %), ou lecture comparée au simulateur (±5 %). */
function releveCheck(key: RowKey, col: Record<string, string>, c: number): Check {
  const cu = num(col.cu)
  const n = num(col.n)
  const pa = num(col.pa)
  const qa = num(col.qa)
  const omega = (n * Math.PI) / 30
  const ns = syncSpeed(MAS.fReseau)
  const sim = motorState({ couple: LOAD_TORQUES[c], couplage: 'triangle', source: 'reseau', f: MAS.fReseau })
  const calc = (expected: number) => ({ expected, tol: TOL_CALC })
  const read = (expected: number) => ({ expected, tol: TOL_READ })
  switch (key) {
    case 'cu':
      return read(LOAD_TORQUES[c])
    case 'n':
      return read(sim.n)
    case 'is':
      return read(sim.is)
    case 'v':
      return read(sim.v)
    case 'pa':
      return read(sim.pa)
    case 'qa':
      return read(sim.qa)
    case 'omega':
      return calc(omega)
    case 'pu':
      return calc(cu * omega)
    case 'g':
      return calc(((ns - n) / ns) * 100)
    case 's':
      return calc(Math.hypot(pa, qa))
    case 'eta':
      return calc(((cu * omega) / pa) * 100)
    case 'cos':
      return calc(pa / Math.hypot(pa, qa))
  }
}

export function ReleveTable({ id }: { id: string }) {
  const [cols, setCols] = useState<Record<string, string>[]>(LOADS.map(() => ({})))
  const [plot, setPlot] = useState<Record<string, number>[] | null>(null)
  const g = useTableGrading(id, TABLE_EXPLANATIONS.releve)

  const set = (c: number, key: RowKey, v: string) => {
    setCols(cols.map((col, k) => (k === c ? { ...col, [key]: v } : col)))
    g.setChecked(false)
  }
  const submit = () => g.submit(cols.flatMap((col, c) => ROWS.map((r) => ({ value: col[r.key], check: releveCheck(r.key, col, c) }))))
  const trace = () => setPlot(cols.map((col) => Object.fromEntries(ROWS.map((r) => [r.key, num(col[r.key])]))).filter((p) => Number.isFinite(p.cu)))

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg ring-1 ring-line">
        <table className="w-full text-xs">
          <thead className="bg-card-2 text-muted">
            <tr>
              <th className="px-2 py-1.5 text-left font-normal" />
              {LOADS.map((l) => (
                <th key={l} className="px-2 py-1.5 font-normal">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.key} className="border-t border-line">
                <td className={`px-2 py-1 whitespace-nowrap ${r.calc ? 'text-accent' : 'text-ink'}`}>{r.label}</td>
                {cols.map((col, c) => (
                  <td key={c} className="px-1 py-1 text-center">
                    <Cell label={`${r.label}, ${LOADS[c]}`} value={col[r.key] ?? ''} onChange={(v) => set(c, r.key, v)} check={releveCheck(r.key, col, c)} checked={g.checked} calc={r.calc} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <GradeBar exam={g.exam} saved={g.saved} onSubmit={submit} label="Vérifier le tableau">
        <button type="button" onClick={trace} className="min-h-11 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent">
          Tracer
        </button>
        {!g.exam && <span className="text-xs text-muted">Calculs (lignes ambrées) vérifiés à ±3 % depuis vos mesures ; mesures à ±5 % du banc. Survolez une case rouge.</span>}
      </GradeBar>
      {plot && (
        <div className="grid gap-3 md:grid-cols-2">
          {plot.length < 2 && <p className="text-sm text-err">Saisissez au moins deux colonnes (Cu et les mesures) pour tracer.</p>}
          <Chart title="Cu = f(N)" data={plot} x="n" xLabel="N (tr/min)" lines={[{ key: 'cu', name: 'Cu (N·m)', color: 'var(--color-accent)' }]} />
          <Chart title="Cu = f(g)" data={plot} x="g" xLabel="g (%)" lines={[{ key: 'cu', name: 'Cu (N·m)', color: 'var(--color-accent)' }]} />
          <Chart
            title="cos φ et η en fonction de Cu"
            data={plot}
            x="cu"
            xLabel="Cu (N·m)"
            lines={[
              { key: 'eta', name: 'η (%)', color: 'var(--color-ch1)' },
              { key: 'cos', name: 'cos φ', color: 'var(--color-ch2)', right: true },
            ]}
          />
          <Chart title="Is = f(Cu)" data={plot} x="cu" xLabel="Cu (N·m)" lines={[{ key: 'is', name: 'Is (A)', color: 'var(--color-ch1)' }]} />
          <Chart title="Qa = f(Cu)" data={plot} x="cu" xLabel="Cu (N·m)" yFromZero lines={[{ key: 'qa', name: 'Qa (var)', color: 'var(--color-ch2)' }]} />
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── Variateur (Q7) ─────────────────────────── */

const FREQS = [15, 35, 50]

export function VariateurTable({ id }: { id: string }) {
  const [rows, setRows] = useState<Record<string, string>[]>(FREQS.map(() => ({})))
  const [plot, setPlot] = useState<{ f: number; n: number }[] | null>(null)
  const g = useTableGrading(id, TABLE_EXPLANATIONS.variateur)
  const checks = (k: number) => ({
    u: { expected: inverterVoltage(FREQS[k], 'fondamental'), tol: TOL_READ },
    uf: { expected: num(rows[k].u) / FREQS[k], tol: TOL_CALC },
  })
  const set = (k: number, key: string, v: string) => {
    setRows(rows.map((r, i) => (i === k ? { ...r, [key]: v } : r)))
    g.setChecked(false)
  }
  const submit = () => g.submit(FREQS.flatMap((_, k) => [{ value: rows[k].u, check: checks(k).u }, { value: rows[k].uf, check: checks(k).uf }]))
  return (
    <div className="space-y-3">
      <table className="text-xs ring-1 ring-line">
        <thead className="bg-card-2 text-muted">
          <tr>
            {['f (Hz)', 'N (tr/min)', 'U (V)', 'U/f (V/Hz) calcul'].map((h) => (
              <th key={h} className="px-2 py-1.5 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FREQS.map((f, k) => (
            <tr key={f} className="border-t border-line">
              <td className="px-2 py-1 text-center font-mono">{f}</td>
              <td className="px-1 py-1">
                <Cell label={`N à ${f} Hz`} value={rows[k].n ?? ''} onChange={(v) => set(k, 'n', v)} checked={false} />
              </td>
              <td className="px-1 py-1">
                <Cell label={`U à ${f} Hz`} value={rows[k].u ?? ''} onChange={(v) => set(k, 'u', v)} check={checks(k).u} checked={g.checked} />
              </td>
              <td className="px-1 py-1">
                <Cell label={`U/f à ${f} Hz`} value={rows[k].uf ?? ''} onChange={(v) => set(k, 'uf', v)} check={checks(k).uf} checked={g.checked} calc />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <GradeBar exam={g.exam} saved={g.saved} onSubmit={submit} label="Vérifier le tableau">
        <button
          type="button"
          onClick={() => setPlot(FREQS.map((f, k) => ({ f, n: num(rows[k].n) })).filter((p) => Number.isFinite(p.n)))}
          className="min-h-11 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent"
        >
          Tracer N = f(f)
        </button>
      </GradeBar>
      {plot && <Chart title="N = f(f)" data={plot} x="f" xLabel="f (Hz)" lines={[{ key: 'n', name: 'N (tr/min)', color: 'var(--color-accent)' }]} />}
    </div>
  )
}

/* ─────────────────────────── Séparation des pertes (Q8) ─────────────────────────── */

export type LossValues = Record<string, string>
/** Mesures à vide saisies, converties ; NaN si incomplètes. */
export const lossInputs = (v: LossValues) => ({ p0d: num(v.p0d), i0d: num(v.i0d), p0y: num(v.p0y), i0y: num(v.i0y) })
export const lossComplete = (v: LossValues) => Object.values(lossInputs(v)).every(Number.isFinite)

const LOSS_IN = [
  { key: 'p0d', label: 'P0Δ (W)', exact: MAS.releves[0].pa },
  { key: 'i0d', label: 'I0Δ (A)', exact: MAS.releves[0].is },
  { key: 'p0y', label: 'P0Y (W)', exact: MAS.p0Etoile400 },
  { key: 'i0y', label: 'I0Y (A)', exact: MAS.i0Etoile400 },
] as const
const LOSS_OUT = [
  { key: 'pjsD', label: 'PjsΔ (W)' },
  { key: 'pjsY', label: 'PjsY (W)' },
  { key: 'alpha', label: 'α (W/V²)' },
  { key: 'pmeca', label: 'Pméca (W)' },
] as const

export function LossSection({ id, vals, setVals }: { id: string; vals: LossValues; setVals: (v: LossValues) => void }) {
  const g = useTableGrading(id, TABLE_EXPLANATIONS.pertes)
  const expected = lossSeparation(lossInputs(vals))
  const checkOf = (k: string): Check => {
    const inp = LOSS_IN.find((f) => f.key === k)
    return inp ? { expected: inp.exact, tol: TOL_READ } : { expected: expected[k as keyof typeof expected], tol: TOL_CALC }
  }
  const set = (k: string, v: string) => {
    setVals({ ...vals, [k]: v })
    g.setChecked(false)
  }
  const submit = () => g.submit([...LOSS_IN, ...LOSS_OUT].map((f) => ({ value: vals[f.key], check: checkOf(f.key) })))
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">Saisissez vos mesures à vide (triangle puis étoile sur 400 V), puis vos calculs. Rs = {MAS.rsChaud} Ω (question 4).</p>
      <div className="flex flex-wrap gap-4">
        {LOSS_IN.map((f) => (
          <label key={f.key} className="flex items-center gap-2 text-xs">
            {f.label}
            <Cell label={f.label} value={vals[f.key] ?? ''} onChange={(v) => set(f.key, v)} check={checkOf(f.key)} checked={g.checked} />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        {LOSS_OUT.map((f) => (
          <label key={f.key} className="flex items-center gap-2 text-xs text-accent">
            {f.label}
            <Cell label={f.label} value={vals[f.key] ?? ''} onChange={(v) => set(f.key, v)} check={checkOf(f.key)} checked={g.checked} calc />
          </label>
        ))}
      </div>
      <GradeBar exam={g.exam} saved={g.saved} onSubmit={submit} label="Vérifier (±3 %)" />
    </div>
  )
}

/* ─────────────────────────── Bilan de puissance au point nominal ─────────────────────────── */

const BAL_IN = [
  { key: 'pa', label: 'Pa (W)' },
  { key: 'is', label: 'Is (A)' },
  { key: 'g', label: 'g (%)' },
  { key: 'pu', label: 'Pu (W)' },
  { key: 'alpha', label: 'α (W/V²)' },
] as const
const BAL_OUT = [
  { key: 'pjs', label: 'Pjs = 3·Rs·(Is/√3)² (W)' },
  { key: 'pfer', label: 'Pfer = α·U² (W)' },
  { key: 'ptr', label: 'Ptr = Pa − Pjs − Pfer (W)' },
  { key: 'pjr', label: 'Pjr = g·Ptr (W)' },
  { key: 'pmeca', label: 'Pméca(bilan) = Ptr − Pjr − Pu (W)' },
  { key: 'eta', label: 'η = Pu/Pa (%)' },
] as const

export function BalanceSection({ id, lossVals }: { id: string; lossVals: LossValues }) {
  const [vals, setVals] = useState<LossValues>({})
  const g = useTableGrading(id, TABLE_EXPLANATIONS.bilan)
  const nominal = motorState({ couple: 10, couplage: 'triangle', source: 'reseau', f: MAS.fReseau })
  const data = { pa: num(vals.pa), is: num(vals.is), g: num(vals.g) / 100, pu: num(vals.pu), alpha: num(vals.alpha) }
  const b = powerBalance(data)
  const exactIn: Record<string, Check> = {
    pa: { expected: nominal.pa, tol: TOL_READ },
    is: { expected: nominal.is, tol: TOL_READ },
    g: { expected: nominal.g * 100, tol: 0.1 },
    pu: { expected: nominal.pu, tol: TOL_READ },
    alpha: { expected: lossSeparation(lossInputs(lossVals)).alpha, tol: TOL_CALC },
  }
  const checkOf = (k: string): Check => exactIn[k] ?? { expected: k === 'eta' ? b.eta * 100 : b[k as keyof typeof b], tol: TOL_CALC }
  const set = (k: string, v: string) => {
    setVals({ ...vals, [k]: v })
    g.setChecked(false)
  }
  const submit = () => g.submit([...BAL_IN, ...BAL_OUT].map((f) => ({ value: vals[f.key], check: checkOf(f.key) })))
  const sep = lossComplete(lossVals) ? lossSeparation(lossInputs(lossVals)).pmeca : NaN
  const pmecaBilan = num(vals.pmeca)
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Données au point nominal (colonne « Charge nominale » du tableau) et α issu de votre séparation des pertes. U = {MAS.uReseau} V, Rs = {MAS.rsChaud} Ω.
      </p>
      <div className="flex flex-wrap gap-4">
        {BAL_IN.map((f) => (
          <label key={f.key} className="flex items-center gap-2 text-xs">
            {f.label}
            <Cell label={`Bilan ${f.label}`} value={vals[f.key] ?? ''} onChange={(v) => set(f.key, v)} check={checkOf(f.key)} checked={g.checked} />
          </label>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {BAL_OUT.map((f) => (
          <label key={f.key} className="flex items-center justify-between gap-2 text-xs text-accent">
            {f.label}
            <Cell label={`Bilan ${f.label}`} value={vals[f.key] ?? ''} onChange={(v) => set(f.key, v)} check={checkOf(f.key)} checked={g.checked} calc />
          </label>
        ))}
      </div>
      <GradeBar exam={g.exam} saved={g.saved} onSubmit={submit} label="Vérifier (±3 %)" />
      {!g.exam && g.checked && Number.isFinite(pmecaBilan) && (
        <div className="rounded-lg bg-card-2 px-3 py-2 text-sm">
          <p className="font-mono">
            Pméca (bilan) = {fr(pmecaBilan)} W · Pméca (séparation à vide) = {Number.isFinite(sep) ? `${fr(sep)} W` : 'section précédente incomplète'}
          </p>
          <p className="mt-1 text-muted">
            Les deux méthodes ne concordent pas. La séparation à vide est peu fiable, parce que le circuit est saturé et que le wattmètre est imprécis à faible cos φ.
          </p>
        </div>
      )}
    </div>
  )
}

export { Exercise } from '../components/Worksheet'
