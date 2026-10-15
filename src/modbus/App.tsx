import { Route, Routes } from 'react-router'
import Layout from './pages/Layout'
import Accueil from './pages/Accueil'
import Banc from './pages/Banc'
import Logiciel from './pages/Logiciel'
import Questions from './pages/Questions'
import Exercices from './pages/Exercices'
import Reglages from './pages/Reglages'
import Cours from './pages/Cours'
import PagePartiel from './pages/Partiel'
import Hypotheses from './pages/Hypotheses'

/** Simulateur TP2, monté sur /modbus/* (chargé à la demande depuis main.tsx). */
export default function ModbusApp() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Accueil />} />
        <Route path="banc" element={<Banc />} />
        <Route path="logiciel" element={<Logiciel />} />
        <Route path="questions" element={<Questions />} />
        <Route path="exercices" element={<Exercices />} />
        <Route path="reglages" element={<Reglages />} />
        <Route path="cours" element={<Cours />} />
        <Route path="partiel" element={<PagePartiel />} />
        <Route path="hypotheses" element={<Hypotheses />} />
        <Route path="*" element={<Accueil />} />
      </Route>
    </Routes>
  )
}
