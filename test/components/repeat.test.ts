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

import { reactive } from 'vue'
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

describe('A2UIRepeat with ProgressBar', () => {
  it('interpolates label and value per row when template repeats ProgressBar with same dataSource', () => {
    const surfaces = {
      s1: {
        components: {},
        root: null,
        dataModel: {},
        sources: {
          items: {
            fields: ['name', 'pct'],
            rows: [
              reactive({ name: 'Alpha', pct: 25 }),
              reactive({ name: 'Beta', pct: 75 }),
            ],
          },
        },
        filters: {},
      },
    }
    const def = {
      dataSource: { source: 'items' },
      template: {
        ProgressBar: {
          dataSource: { source: 'items' },
          label: '${name} — ${pct}%',
          value: '${pct}',
        },
      },
    }
    const w = mountWith(A2UIRepeat, { def, surfaceId: 's1', componentId: 'r1' }, surfaces)
    const bars = w.findAllComponents(A2UIProgressBar)
    expect(bars).toHaveLength(2)
    expect(bars[0].find('.a2ui-progress-label').text()).toBe('Alpha — 25%')
    expect(bars[1].find('.a2ui-progress-label').text()).toBe('Beta — 75%')
    expect(bars[0].find('progress').element.getAttribute('value')).toBe('25')
    expect(bars[1].find('progress').element.getAttribute('value')).toBe('75')
  })

  it('interpolates ProgressBar props when rows are field-aligned arrays', () => {
    const surfaces = {
      s1: {
        components: {},
        root: null,
        dataModel: {},
        sources: {
          items: {
            fields: ['name', 'pct'],
            rows: [
              ['North', 30],
              ['South', 90],
            ],
          },
        },
        filters: {},
      },
    }
    const def = {
      dataSource: { source: 'items' },
      template: {
        ProgressBar: {
          label: '${name} (${pct}%)',
          value: '${pct}',
        },
      },
    }
    const w = mountWith(A2UIRepeat, { def, surfaceId: 's1', componentId: 'r1' }, surfaces)
    const bars = w.findAllComponents(A2UIProgressBar)
    expect(bars).toHaveLength(2)
    expect(bars[0].find('.a2ui-progress-label').text()).toBe('North (30%)')
    expect(bars[1].find('.a2ui-progress-label').text()).toBe('South (90%)')
  })
})
