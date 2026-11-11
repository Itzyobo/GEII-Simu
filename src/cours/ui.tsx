import { useId, useState, type ReactNode, type RefObject } from 'react'

/** Briques de mise en page communes aux chapitres du cours. */

export function Section({ id, eyebrow, title, intro, children }: { id?: string; eyebrow: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <div className="space-y-2">
        <p className="font-mono text-xs font-semibold tracking-[0.12em] text-copper uppercase">{eyebrow}</p>
        <h2 className="text-2xl font-bold text-balance">{title}</h2>
        {intro && <p className="max-w-3xl text-muted">{intro}</p>}
      </div>
      {children}
    </section>
  )
}

export const Panel = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`flex flex-col gap-4 rounded-card bg-card p-4 ring-1 ring-line ${className}`}>{children}</div>
)

/** Deux colonnes sur grand écran, une seule sur mobile. */
export const Deux = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`grid gap-4 md:grid-cols-2 [&>*]:min-w-0 ${className}`}>{children}</div>
)

/** Idée clé du paragraphe. */
export const Cle = ({ children }: { children: ReactNode }) => <p className="max-w-3xl border-l-3 border-copper py-1 pl-4">{children}</p>

export const Legende = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted">{children}</p>

export const Pastille = ({ col, children }: { col: string; children: ReactNode }) => (
  <span className="mr-4 inline-flex items-center gap-1.5 text-sm text-muted">
    <i className="inline-block size-2.5 rounded-sm" style={{ background: `var(--color-${col})` }} />
    {children}
  </span>
)

/** Formules : titre, expression, commentaire. */
export function Formules({ items }: { items: [titre: string, expr: ReactNode, note?: ReactNode][] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map(([t, e, n]) => (
        <div key={t} className="flex min-w-0 flex-col gap-1 rounded-lg p-3 ring-1 ring-line">
          <span className="font-mono text-xs font-semibold tracking-wider text-copper uppercase">{t}</span>
          <span className="font-mono text-sm break-words">{e}</span>
          {n && <span className="text-sm text-muted">{n}</span>}
        </div>
      ))}
    </div>
  )
}

/** Afficheurs numériques. */
export function Mesures({ items }: { items: [label: string, valeur: ReactNode, unite?: string][] }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-line ring-1 ring-line sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
      {items.map(([l, v, u]) => (
        <div key={l} className="flex min-w-0 flex-col gap-0.5 bg-card px-3 py-2">
          <span className="font-mono text-[0.68rem] tracking-wider text-muted uppercase">{l}</span>
          <b className="font-mono text-lg font-semibold tabular-nums">{v}</b>
          {u && <small className="text-xs text-muted">{u}</small>}
        </div>
      ))}
    </div>
  )
}

export function Curseur({ label, value, min, max, step = 1, onChange, aff }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; aff?: string }) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label} : <span className="font-mono">{aff ?? String(value).replace('.', ',')}</span>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full accent-copper" />
    </div>
  )
}

const btn = 'min-h-10 rounded-lg px-3 text-sm font-semibold ring-1 transition'
export const Bouton = ({ on, onClick, children }: { on?: boolean; onClick: () => void; children: ReactNode }) => (
  <button type="button" aria-pressed={on} onClick={onClick} className={`${btn} ${on ? 'bg-copper text-white ring-copper' : 'bg-bg ring-line hover:ring-copper'}`}>
    {children}
  </button>
)

/** Choix exclusif parmi des options. */
export function Choix<T extends string | number>({ value, options, onChange, label }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map(([v, l]) => (
        <Bouton key={String(v)} on={v === value} onClick={() => onChange(v)}>
          {l}
        </Bouton>
      ))}
    </div>
  )
}

export const Lecture = ({ play, setPlay }: { play: boolean; setPlay: (p: boolean) => void }) => (
  <Bouton onClick={() => setPlay(!play)}>{play ? 'Pause' : 'Lecture'}</Bouton>
)

export const Ligne = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap items-center gap-x-5 gap-y-3">{children}</div>

/** Question « À votre avis… » du diaporama : réponse révélée au clic, avec la justification. */
export function Quiz({ question, choix, bonne, pourquoi }: { question: string; choix: string[]; bonne: number; pourquoi: ReactNode }) {
  const [rep, setRep] = useState<number | null>(null)
  return (
    <div className="rounded-card bg-card-2 p-4 ring-1 ring-line">
      <p className="font-mono text-xs font-semibold tracking-wider text-accent uppercase">À votre avis…</p>
      <p className="mt-1 font-semibold">{question}</p>
      <div className="mt-3 flex flex-col gap-1.5">
        {choix.map((c, i) => {
          const tone = rep === null ? 'bg-card ring-line hover:ring-accent' : i === bonne ? 'bg-ok/15 ring-ok' : i === rep ? 'bg-err/10 ring-err' : 'bg-card ring-line opacity-60'
          return (
            <button key={c} type="button" disabled={rep !== null} onClick={() => setRep(i)} className={`min-h-10 rounded-lg px-3 py-2 text-left text-sm ring-1 ${tone}`}>
              {i + 1}. {c}
            </button>
          )
        })}
      </div>
      {rep !== null && (
        <div className="mt-3 text-sm" aria-live="polite">
          <b className={rep === bonne ? 'text-ok' : 'text-err'}>{rep === bonne ? 'Exact.' : `Non : réponse ${bonne + 1}.`}</b> {pourquoi}{' '}
          <button type="button" onClick={() => setRep(null)} className="ml-1 text-muted underline">
            recommencer
          </button>
        </div>
      )}
    </div>
  )
}

/** Canvas plein largeur au rapport donné. */
export const Toile = ({ cref, ratio, label }: { cref: RefObject<HTMLCanvasElement | null>; ratio: string; label: string }) => (
  <canvas ref={cref} role="img" aria-label={label} className="block w-full" style={{ aspectRatio: ratio }} />
)
