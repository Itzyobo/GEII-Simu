import { Link } from 'react-router'
import { ATTENDUS } from '../data/attendus'
import { coverage } from '../data/questions'

/** Accueil : les attendus du partiel (PRD §1), reliés aux questions qui les couvrent. */
export default function Accueil() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.2em] text-accent">TP2 · BUT GEII</p>
      <h1 className="mt-2 text-3xl font-bold">Liaison série asynchrone / MODBUS</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Entraînement au TP et au partiel. Un attendu est couvert quand au moins une question qui s’y rapporte est implémentée.
      </p>

      <div className="mt-8 overflow-x-auto rounded-card bg-card ring-1 ring-line">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2">Attendu</th>
              <th className="px-3 py-2">Origine</th>
              <th className="px-3 py-2">Couvert par</th>
              <th className="px-3 py-2 text-right">État</th>
            </tr>
          </thead>
          <tbody>
            {ATTENDUS.map((a) => {
              const { linked, covered } = coverage(a.id)
              return (
                <tr key={a.id} className="border-t border-line align-top">
                  <td className="px-3 py-2 font-medium">{a.text}</td>
                  <td className="px-3 py-2 text-muted">{a.origine}</td>
                  <td className="px-3 py-2">
                    <p>{a.couvertPar}</p>
                    {linked.length > 0 && (
                      <p className="mt-1 text-xs text-muted">
                        {linked.length} question{linked.length > 1 ? 's' : ''} :{' '}
                        {[...new Set(linked.map((q) => q.section))].map((sec, k) => {
                          const qs = linked.filter((q) => q.section === sec)
                          return (
                            <span key={sec}>
                              {k > 0 && ', '}
                              <Link to={`/modbus/questions#${qs[0]?.id}`} className="underline-offset-2 hover:underline">
                                {sec}
                              </Link>
                              {qs.length > 1 && ` (${qs.length})`}
                            </span>
                          )
                        })}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${covered ? 'bg-ok/15 text-ok' : 'bg-err/10 text-err'}`}>{covered ? 'couvert' : 'non couvert'}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['/modbus/banc', 'Banc', 'Oscilloscope, cartes d’interface, PC avec SERIE_1 à SERIE_3 et RealTerm. Posez les sondes, faites vérifier, lancez le programme.'],
          ['/modbus/logiciel', 'Logiciel MODBUS', 'SERVEUR JBUS/MODBUS : menus, Configuration Maître, trames mémorisées.'],
          ['/modbus/questions', 'Questions', 'Toutes les questions de l’énoncé, par section ; 2.1 à 2.4 corrigées.'],
          ['/modbus/exercices', 'Message codé', 'Chronogrammes tirés au sort à décoder : débit, format, message. Correction bit par bit.'],
        ].map(([to, title, text]) => (
          <Link key={to} to={to!} className="group rounded-card bg-card p-5 ring-1 ring-line transition hover:ring-accent">
            <h2 className="font-semibold group-hover:text-accent">{title}</h2>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
