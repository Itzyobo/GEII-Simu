import { memo, useMemo } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MISE_EN_PAGE } from '../miseEnPage'
import { formatSi } from '../ui/format'
import type { ContexteTp3 } from './useContexte'

const I = MISE_EN_PAGE.identification

/** II.2 Mesures Q7 : réponse à l'échelon de la mesure M pour K = 1, 2, 4 et 7 (modèle sans bruit), temps depuis le front */
function FigureK({ comparaison }: { comparaison: ContexteTp3['comparaison'] }) {
  const data = useMemo(() => {
    const [premier] = comparaison.essais
    if (!premier) return []
    const t0 = premier.a.r.t[0]!
    return Array.from(premier.a.r.t, (t, i) => Object.fromEntries([['t', t - t0], ...comparaison.essais.map((x) => [`K${x.K}`, x.a.r.voie2[i]!]), ['c', premier.a.r.voie1[i]!]]) as Record<string, number>)
  }, [comparaison])
  return (
    <figure className="rounded bg-au3-panel p-2 ring-1 ring-au3-line" data-figure="tp3-comparaison-k">
      <figcaption className="mb-1 text-[11px] text-au3-muted">Mesure M après le front montant de la consigne (±2 V, 0,2 Hz), selon K (modèle, valeurs non vérifiées)</figcaption>
      <ResponsiveContainer width="100%" height={I.hauteurGraphe}>
        <LineChart data={data} margin={I.marge}>
          <CartesianGrid stroke="var(--color-au3-line)" />
          <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(t: number) => formatSi(t, 's', I.chiffresAxe)} stroke="var(--color-au3-muted)" fontSize={I.police} />
          <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => formatSi(v, 'V', I.chiffresAxe)} stroke="var(--color-au3-muted)" fontSize={I.police} width={I.largeurAxe} />
          <Tooltip contentStyle={{ background: 'var(--color-au3-panel)', border: '1px solid var(--color-au3-line)', fontSize: I.police }} labelFormatter={(t) => `t = ${formatSi(Number(t), 's')}`} formatter={(v) => formatSi(Number(v), 'V')} />
          <Legend wrapperStyle={{ fontSize: I.police }} />
          <Line dataKey="c" name="Consigne C" stroke="var(--color-au3-muted)" strokeDasharray={I.tirets} dot={false} isAnimationActive={false} />
          {comparaison.essais.map((x, j) => (
            <Line key={x.K} dataKey={`K${x.K}`} name={`M, K = ${x.K}${comparaison.retenus.includes(x.K) ? ' (cahier des charges respecté)' : ''}`} stroke={MISE_EN_PAGE.disque.couleursK[j]} strokeWidth={2} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </figure>
  )
}

export default memo(FigureK)
