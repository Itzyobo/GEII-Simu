import { Link, NavLink, useParams } from 'react-router'
import { CHAPITRES } from './chapitres'

/** /ener/cours : sommaire du cours. */
export function Sommaire() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <Link to="/ener" className="text-sm text-muted hover:text-accent">
        ← ENER3
      </Link>
      <p className="mt-4 text-xs font-semibold tracking-[0.2em] text-accent">ENER3 · COURS</p>
      <h1 className="mt-2 text-3xl font-bold">Cours animé</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Le diaporama de cours, chapitre par chapitre. Chaque notion a son animation : réglez les curseurs et regardez la physique réagir.
      </p>
      <ol className="mt-8 grid gap-4 md:grid-cols-2">
        {CHAPITRES.map((c, i) => (
          <li key={c.slug}>
            <Link to={`/ener/cours/${c.slug}`} className="group flex h-full gap-4 rounded-card bg-card p-5 ring-1 ring-line transition hover:ring-accent">
              <span className="grid size-10 flex-none place-items-center rounded-full bg-copper font-bold text-white">{i + 1}</span>
              <span>
                <span className="block text-lg font-semibold group-hover:text-accent">{c.titre}</span>
                <span className="mt-1 block text-sm text-muted">{c.resume}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </main>
  )
}

/** /ener/cours/:slug : un chapitre, avec navigation entre chapitres. */
export function ChapitrePage() {
  const { slug } = useParams()
  const i = Math.max(0, CHAPITRES.findIndex((c) => c.slug === slug))
  const { Page, titre } = CHAPITRES[i]
  const prev = CHAPITRES[i - 1]
  const next = CHAPITRES[i + 1]
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <Link to="/ener/cours" className="text-sm text-muted hover:text-accent">
            ← Sommaire du cours
          </Link>
          <nav aria-label="Chapitres" className="flex flex-wrap gap-1 text-sm">
            {CHAPITRES.map((c, k) => (
              <NavLink
                key={c.slug}
                to={`/ener/cours/${c.slug}`}
                title={c.titre}
                className={({ isActive }) => `grid size-9 place-items-center rounded-lg font-mono ${isActive ? 'bg-copper text-white' : 'text-muted hover:bg-card-2'}`}
              >
                {k + 1}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-14 px-4 py-10">
        <header>
          <p className="font-mono text-xs font-semibold tracking-[0.2em] text-copper">ENER3 · CHAPITRE {i + 1}</p>
          <h1 className="mt-2 text-3xl font-bold text-balance sm:text-4xl">{titre}</h1>
        </header>
        <Page key={slug} />
        <nav className="flex flex-wrap justify-between gap-3 border-t border-line pt-6 text-sm">
          {prev ? (
            <Link to={`/ener/cours/${prev.slug}`} className="text-muted hover:text-accent">
              ← {i}. {prev.titre}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link to={`/ener/cours/${next.slug}`} className="text-muted hover:text-accent">
              {i + 2}. {next.titre} →
            </Link>
          )}
        </nav>
      </main>
    </div>
  )
}
