import { describe, it, expect } from 'vitest'
import { reactive } from 'vue'
import { materializeDataRow } from '../packages/a2ui-sdk/src/utils/materialize-data-row'

describe('materializeDataRow', () => {
  it('reads named fields through a vue reactive proxy', () => {
    const row = reactive({ code: 'S-901', taxon: 'Cryopeg', mass_g: 240 })
    const out = materializeDataRow(row, ['code', 'taxon', 'mass_g'])
    expect(out).toEqual({ code: 'S-901', taxon: 'Cryopeg', mass_g: 240 })
  })

  it('zips array rows with fields', () => {
    const row = ['S-901', 'Cryopeg', 240]
    const out = materializeDataRow(row, ['code', 'taxon', 'mass_g'])
    expect(out).toEqual({ code: 'S-901', taxon: 'Cryopeg', mass_g: 240 })
  })

  it('spreads plain objects when fields omitted', () => {
    expect(materializeDataRow({ a: 1 })).toEqual({ a: 1 })
  })
})
