import { lazy, StrictMode, Suspense, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import './index.css'
import Home from './pages/Home'
import ThemeToggle from './components/ThemeToggle'
import Dashboard from './pages/Dashboard'
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
const ModbusApp = lazy(() => import('./modbus/App'))
// INFO3 : pages chargées à la demande (/info3/dev = page technique, sans lien public)
const INFO3_PAGES = {
  home: lazy(() => import('./pages/info3/Home')),
  tp1: lazy(() => import('./pages/info3/Tp1')),
  tp2: lazy(() => import('./pages/info3/Tp2')),
  tp3: lazy(() => import('./pages/info3/Tp3')),
  tp4: lazy(() => import('./pages/info3/Tp4')),
  tp5: lazy(() => import('./pages/info3/Tp5')),
  tp6: lazy(() => import('./pages/info3/Tp6')),
  examen: lazy(() => import('./pages/info3/Examen')),
  hypotheses: lazy(() => import('./pages/info3/Hypotheses')),
  libre: lazy(() => import('./pages/info3/Libre')),
  // Page technique : développement seulement (absente du build de production)
  dev: import.meta.env.DEV ? lazy(() => import('./pages/info3/Dev')) : null,
}
// AU3 : moteur à courant continu + DT, pages chargées à la demande
const AU3_PAGES = {
  accueil: lazy(() => import('./au3/pages/Accueil')),
  libre: lazy(() => import('./au3/pages/BancLibre')),
  tp4: lazy(() => import('./au3/pages/Tp4')),
  examen: lazy(() => import('./au3/pages/Examen')),
  tp2: lazy(() => import('./au3/pages/Tp2')),
  tp1: lazy(() => import('./au3/pages/Tp1')),
}
const Sommaire = lazy(() => import('./cours/CoursPages').then((m) => ({ default: m.Sommaire })))
const ChapitrePage = lazy(() => import('./cours/CoursPages').then((m) => ({ default: m.ChapitrePage })))
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
    <ThemeToggle />
    <BrowserRouter>
      <Suspense fallback={<p className="p-8 text-sm text-muted">Chargement…</p>}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ener" element={<Home />} />
          <Route path="/ener/cours" element={<Sommaire />} />
          <Route path="/ener/cours/:slug" element={<ChapitrePage />} />
          {TPS.map((tp) => (
            <Route key={tp.slug} path={`/tp/${tp.slug}`} element={<ExamShell tps={[tp]} minutes={30} kind={tp.slug} render={renderTp} />} />
          ))}
          <Route path="/examen-blanc" element={<MockExam />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/modbus/*" element={<ModbusApp />} />
          <Route path="/info3" element={<INFO3_PAGES.home />} />
          <Route path="/info3/tp1" element={<INFO3_PAGES.tp1 />} />
          <Route path="/info3/tp2" element={<INFO3_PAGES.tp2 />} />
          <Route path="/info3/tp3" element={<INFO3_PAGES.tp3 />} />
          <Route path="/info3/tp4" element={<INFO3_PAGES.tp4 />} />
          <Route path="/info3/tp5" element={<INFO3_PAGES.tp5 />} />
          <Route path="/info3/tp6" element={<INFO3_PAGES.tp6 />} />
          <Route path="/info3/examen" element={<INFO3_PAGES.examen />} />
          <Route path="/info3/hypotheses" element={<INFO3_PAGES.hypotheses />} />
          <Route path="/info3/libre" element={<INFO3_PAGES.libre />} />
          {INFO3_PAGES.dev && <Route path="/info3/dev" element={<INFO3_PAGES.dev />} />}
          <Route path="/au3" element={<AU3_PAGES.accueil />} />
          <Route path="/au3/libre" element={<AU3_PAGES.libre />} />
          <Route path="/au3/tp1" element={<AU3_PAGES.tp1 />} />
          <Route path="/au3/tp2" element={<AU3_PAGES.tp2 />} />
          <Route path="/au3/tp4" element={<AU3_PAGES.tp4 />} />
          <Route path="/au3/examen" element={<AU3_PAGES.examen />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)
