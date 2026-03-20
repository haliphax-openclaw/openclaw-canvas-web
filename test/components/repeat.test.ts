// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../src/client/services/ws-client', () => ({
  wsClient: { send: vi.fn(), on: vi.fn(), off: vi.fn(), connect: vi.fn() },
}))
vi.mock('../../src/client/services/deep-link', () => ({
  parseOpenclawUrl: vi.fn(),
  executeDeepLink: vi.fn().mockResolvedValue({ ok: true }),
  fetchCanvasConfig: vi.fn().mockResolvedValue({ skipConfirmation: false, agents: [], allowedAgentIds: [] }),
  truncateMessage: (msg: string) => msg,
  isOpenclawDeepLink: (url: string) => url.startsWith('openclaw://'),
}))
vi.stubGlobal('location', { origin: 'http://localhost:3456', protocol: 'http:', host: 'localhost:3456' })

import A2UIRepeat from '../../packages/a2ui-catalog-extended/src/A2UIRepeat.vue'
import A2UIText from '../../packages/a2ui-catalog-basic/src/A2UIText.vue'
import A2UIProgressBar from '../../packages/a2ui-catalog-extended/src/A2UIProgressBar.vue'
import { mountWith } from '../__helpers__/mount'

describe('A2UIRepeat', () => {
  it('renders template for each row from dataSource', () => {
    const surfaces = {
      s1: {
        components: {},
        root: null,
        dataModel: {},
        sources: { items: { fields: ['name'], rows: [{ name: 'Alice' }, { name: 'Bob' }] } },
        filters: {},
      },
    }
    const def = {
      dataSource: { source: 'items' },
      template: { Text: { text: '${name}' } },
    }
    const w = mountWith(A2UIRepeat, { def, surfaceId: 's1', componentId: 'r1' }, surfaces)
    const texts = w.findAllComponents(A2UIText)
    expect(texts).toHaveLength(2)
    expect(texts[0].text()).toBe('Alice')
    expect(texts[1].text()).toBe('Bob')
  })

  it('interpolates ProgressBar label and value for each row before mounting child', () => {
    const surfaces = {
      s1: {
        components: {}, root: null, dataModel: {},
        sources: {
          samples: {
            fields: ['code', 'taxon', 'mass_g'],
            rows: [
              { code: 'S-901', taxon: 'Cryopeg brine cells', mass_g: 240 },
              { code: 'S-902', taxon: 'Ice-algae mat', mass_g: 120 },
            ],
          },
        },
        filters: {},
      },
    }
    const def = {
      dataSource: { source: 'samples' },
      transforms: { percentOfMax: { fn: 'percentOfMax' } },
      template: {
        ProgressBar: {
          label: '${code} — ${taxon}',
          value: '${mass_g | percentOfMax}',
        },
      },
    }
    const w = mountWith(A2UIRepeat, { def, surfaceId: 's1', componentId: 'r1' }, surfaces)
    const bars = w.findAllComponents(A2UIProgressBar)
    expect(bars).toHaveLength(2)
    expect(bars[0].find('.a2ui-progress-label').text()).toBe('S-901 — Cryopeg brine cells')
    expect(bars[1].find('.a2ui-progress-label').text()).toBe('S-902 — Ice-algae mat')
    expect(Number(bars[0].find('progress').attributes('value'))).toBeCloseTo(100, 5)
    expect(Number(bars[1].find('progress').attributes('value'))).toBeCloseTo(50, 5)
  })

  it('shows emptyText when no rows', () => {
    const surfaces = {
      s1: {
        components: {}, root: null, dataModel: {},
        sources: { items: { fields: [], rows: [] } },
        filters: {},
      },
    }
    const def = {
      dataSource: { source: 'items' },
      template: { Text: { text: '${name}' } },
      emptyText: 'No data',
    }
    const w = mountWith(A2UIRepeat, { def, surfaceId: 's1', componentId: 'r1' }, surfaces)
    expect(w.text()).toBe('No data')
  })
})

describe('A2UIRepeat sorting', () => {
  const repeatSurfaces = {
    s1: {
      components: {}, root: null, dataModel: {},
      sources: {
        items: {
          fields: ['name', 'score'],
          rows: [
            { name: 'Charlie', score: 80 },
            { name: 'Alice', score: 95 },
            { name: 'Bob', score: 70 },
          ],
        },
      },
      filters: {},
    },
  }

  it('does not show sort dropdown when sortable is false', () => {
    const w = mountWith(A2UIRepeat, {
      def: { dataSource: { source: 'items' }, template: { Text: { text: '${name}' } } },
      surfaceId: 's1', componentId: 'r1',
    }, repeatSurfaces)
    expect(w.find('.a2ui-repeat-sort').exists()).toBe(false)
  })

  it('shows sort dropdown when sortable is true', () => {
    const w = mountWith(A2UIRepeat, {
      def: { dataSource: { source: 'items' }, template: { Text: { text: '${name}' } }, sortable: true, sortField: 'score' },
      surfaceId: 's1', componentId: 'r1',
    }, repeatSurfaces)
    expect(w.find('.a2ui-repeat-sort select').exists()).toBe(true)
    const options = w.findAll('.a2ui-repeat-sort select option')
    expect(options.map(o => o.text())).toEqual(['Unsorted', 'Ascending', 'Descending'])
  })

  it('sorts items ascending by sortField', async () => {
    const w = mountWith(A2UIRepeat, {
      def: { dataSource: { source: 'items' }, template: { Text: { text: '${name}' } }, sortable: true, sortField: 'score' },
      surfaceId: 's1', componentId: 'r1',
    }, repeatSurfaces)

    // Initially unsorted
    let texts = w.findAllComponents(A2UIText)
    expect(texts.map(t => t.text())).toEqual(['Charlie', 'Alice', 'Bob'])

    // Select ascending
    await w.find('.a2ui-repeat-sort select').setValue('asc')
    texts = w.findAllComponents(A2UIText)
    expect(texts.map(t => t.text())).toEqual(['Bob', 'Charlie', 'Alice'])
  })

  it('sorts items descending by sortField', async () => {
    const w = mountWith(A2UIRepeat, {
      def: { dataSource: { source: 'items' }, template: { Text: { text: '${name}' } }, sortable: true, sortField: 'score' },
      surfaceId: 's1', componentId: 'r1',
    }, repeatSurfaces)

    await w.find('.a2ui-repeat-sort select').setValue('desc')
    const texts = w.findAllComponents(A2UIText)
    expect(texts.map(t => t.text())).toEqual(['Alice', 'Charlie', 'Bob'])
  })

  it('returns to unsorted when selecting Unsorted', async () => {
    const w = mountWith(A2UIRepeat, {
      def: { dataSource: { source: 'items' }, template: { Text: { text: '${name}' } }, sortable: true, sortField: 'score' },
      surfaceId: 's1', componentId: 'r1',
    }, repeatSurfaces)

    await w.find('.a2ui-repeat-sort select').setValue('asc')
    await w.find('.a2ui-repeat-sort select').setValue('')
    const texts = w.findAllComponents(A2UIText)
    expect(texts.map(t => t.text())).toEqual(['Charlie', 'Alice', 'Bob'])
  })
})
