import { defineConfig } from 'vitest/config'
import { PERF_TESTS } from './vite.config.ts'

/** `npm run test:perf` : uniquement les *.perf.test.ts, en série (un seul worker, un fichier à la fois) */
export default defineConfig({ test: { include: [PERF_TESTS], fileParallelism: false, maxWorkers: 1 } })
