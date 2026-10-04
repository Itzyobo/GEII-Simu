import { lazy, StrictMode, Suspense, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import './index.css'
import Home from './pages/Home'
import Demo from './pages/Demo'
import ExamShell from './components/ExamShell'
import { loadExamSession } from './lib/examSession'
import { TPS, type Tp } from './pages/tps'

// Une page par TP, chargée à la demande (Recharts n'est utile qu'à la machine asynchrone).
const PAGES = {
  'pas-a-pas': lazy(() => import('./pages/StepperPage')),
  'alim-decoupage': lazy(() => import('./pages/AlimPage')),
  'machine-asynchrone': lazy(() => import('./pages/AsyncPage')),
}
const renderTp = (tp: { slug: Tp['slug'] }) => {
  const full = TPS.find((t) => t.slug === tp.slug)!
  const Page = PAGES[full.slug]
  return <Page tp={full} />
}

/** Examen blanc : les 3 TP dans un ordre aléatoire, 1 h 30. */
function MockExam() {
  // Ordre repris de la session en cours (rechargement), sinon tiré au hasard
  const [order] = useState(() => {
    const saved = loadExamSession('blanc')?.order
    return saved ? saved.map((slug) => TPS.find((t) => t.slug === slug)!).filter(Boolean) : [...TPS].sort(() => Math.random() - 0.5)
  })
  return <ExamShell tps={order} minutes={90} kind="blanc" autoStart render={renderTp} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<p className="p-8 text-sm text-muted">Chargement…</p>}>
        <Routes>
          <Route path="/" element={<Home />} />
          {TPS.map((tp) => (
            <Route key={tp.slug} path={`/tp/${tp.slug}`} element={<ExamShell tps={[tp]} minutes={30} kind={tp.slug} render={renderTp} />} />
          ))}
          <Route path="/examen-blanc" element={<MockExam />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)
