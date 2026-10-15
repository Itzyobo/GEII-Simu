import ServeurModbus from '../components/ServeurModbus'

/** Les deux PC du banc, chacun avec son logiciel (binôme 1 → carte 1, binôme 2 → carte 2). */
export default function Logiciel() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <p className="mb-3 rounded-lg bg-warn/10 p-3 text-sm text-warn ring-1 ring-warn/30">
        Attention : Au préalable, sur le logiciel MODBUS, cliquer sur « configuration serveur », « maître », « liste des trames mémorisées », et supprimer toutes les trames présentes.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {(['c1', 'c2'] as const).map((c) => (
          <section key={c} aria-label={`PC binôme ${c === 'c1' ? 1 : 2}`} className="min-w-0 rounded-lg bg-[#008080] p-2 sm:p-4">
            <ServeurModbus card={c} />
          </section>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Fenêtres reconstituées d’après le PRD ; le bus n’est atteint que si le câble DB9/bleu-vert de la carte est branché au pupitre (onglet Banc).</p>
    </main>
  )
}
