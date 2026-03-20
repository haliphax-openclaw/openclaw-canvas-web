import { describe, it, expect } from 'vitest'
import { reactive } from 'vue'
import { deepInterpolate, interpolateRepeatChildDef } from '../packages/a2ui-sdk/src/utils/deep-interpolate'

describe('deepInterpolate', () => {
  it('resolves ProgressBar-style label and percentOfMax value', () => {
    const row = { code: 'S-901', taxon: 'Cryopeg brine cells', mass_g: 240 }
    const inner = { label: '${code} — ${taxon}', value: '${mass_g | percentOfMax}' }
    const rows = [row, { code: 'S-902', taxon: 'x', mass_g: 120 }]
    const out = deepInterpolate(inner, row, {
      transforms: { percentOfMax: { fn: 'percentOfMax' } },
      allRows: rows,
    }) as { label: string; value: string }
    expect(out.label).toBe('S-901 — Cryopeg brine cells')
    expect(out.value).toBe('100')
  })

  it('works with vue reactive row objects', () => {
    const row = reactive({ code: 'A', taxon: 'B' })
    const inner = { label: '${code} — ${taxon}' }
    expect(deepInterpolate(inner, row as Record<string, unknown>)).toEqual({
      label: 'A — B',
    })
  })
})

describe('interpolateRepeatChildDef', () => {
  it('matches Repeat + ProgressBar template resolution', () => {
    const row = { code: 'S-901', taxon: 'Cryopeg brine cells', mass_g: 240 }
    const rows = [row, { code: 'S-902', taxon: 'x', mass_g: 120 }]
    const inner = reactive({
      label: '${code} — ${taxon}',
      value: '${mass_g | percentOfMax}',
    })
    const out = interpolateRepeatChildDef(inner, row, {
      transforms: { percentOfMax: { fn: 'percentOfMax' } },
      allRows: rows,
    })
    expect(out.label).toBe('S-901 — Cryopeg brine cells')
    expect(out.value).toBe('100')
  })
})
