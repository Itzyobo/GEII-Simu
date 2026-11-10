import { describe, expect, it } from 'vitest'
import { INFO3, type SfrDef } from './reference'

describe('INFO3.sfr', () => {
  it('deux registres n’ont jamais la même adresse', () => {
    const seen = new Map<number, string>()
    for (const [name, def] of Object.entries(INFO3.sfr as Record<string, SfrDef>)) {
      expect(seen.get(def.addr), `${name} et ${seen.get(def.addr)} à 0x${def.addr.toString(16)}`).toBeUndefined()
      seen.set(def.addr, name)
    }
  })
})
