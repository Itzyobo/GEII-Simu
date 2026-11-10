import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { configDefaults, defineConfig } from 'vitest/config'

/** Tests de performance (temps réel) : exclus de `npm test`, lancés par `npm run test:perf` (vitest.perf.config.ts) */
export const PERF_TESTS = '**/*.perf.test.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Worker en module ES : les professeurs virtuels y sont chargés à la demande (un chunk par TP)
  worker: { format: 'es' },
  // Délai par test large : les tests du professeur (20 exécutions) ne doivent pas échouer sur une machine chargée
  test: { exclude: [...configDefaults.exclude, PERF_TESTS], testTimeout: 60_000 },
})
