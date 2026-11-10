// Assertions de temps réel (performance.now()) : hors de `npm test`, lancées par `npm run test:perf` en série.
import { describe, expect, it } from 'vitest'
import { compile, formatDiagnostic } from '../compiler'
import { Vm } from '../vm/vm'
import { crProject } from '.'

function boot(files: Record<string, string>) {
  const r = compile(files)
  if (!r.ok) throw new Error(r.diagnostics.map(formatDiagnostic).join('\n'))
  const vm = new Vm()
  vm.load(r.program!)
  return vm
}

describe('performance (Node)', () => {
  it('10 s simulées de q3_5 en moins de 300 ms', () => {
    const vm = boot(crProject('tp1/q3_5'))
    const t0 = performance.now()
    vm.runFor({ ms: 10_000 })
    const dt = performance.now() - t0
    console.info(`q3_5 : 10 s simulées en ${dt.toFixed(1)} ms`)
    expect(vm.timeS).toBeGreaterThanOrEqual(10)
    expect(dt).toBeLessThan(300)
  })
  it('1 s simulée de q3_4 (boucle sans délai) en moins de 250 ms', () => {
    const vm = boot(crProject('tp1/q3_4'))
    const t0 = performance.now()
    vm.runFor({ ms: 1000 })
    const dt = performance.now() - t0
    console.info(`q3_4 : 1 s simulée en ${dt.toFixed(1)} ms`)
    expect(dt).toBeLessThan(250)
  })
})
