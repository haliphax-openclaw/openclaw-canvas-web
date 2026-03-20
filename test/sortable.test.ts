// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { a2uiModule } from '../src/client/store/a2ui'

vi.mock('../src/client/services/ws-client', () => ({
  wsClient: { send: vi.fn(), on: vi.fn(), off: vi.fn(), connect: vi.fn() },
}))
vi.mock('../src/client/services/deep-link', () => ({
  parseOpenclawUrl: vi.fn(),
  executeDeepLink: vi.fn().mockResolvedValue({ ok: true }),
  fetchCanvasConfig: vi.fn().mockResolvedValue({ skipConfirmation: false, agents: [], allowedAgentIds: [] }),
  truncateMessage: (msg: string) => msg,
  isOpenclawDeepLink: (url: string) => url.startsWith('openclaw://'),
}))
vi.stubGlobal('location', { origin: 'http://localhost:3456', protocol: 'http:', host: 'localhost:3456' })

import A2UITable from '../packages/a2ui-catalog-extended/src/A2UITable.vue'
import A2UIRepeat from '../src/client/components/A2UIRepeat.vue'
import A2UIText from '../src/client/components/A2UIText.vue'

function makeStore(surfaces: Record<string, any> = {}) {
  return createStore({
    state: { session: { active: 'main', sessions: ['main'] }, panel: { visible: true } },
    modules: { a2ui: { ...a2uiModule, state: () => ({ surfaces }) } },
  })
}

function mountWith(component: any, props: Record<string, any>, surfaces: Record<string, any> = {}) {
  return mount(component, { props, global: { plugins: [makeStore(surfaces)] } })
}

const tableSurfaces = {
  s1: {
    components: {},
    root: null,
    dataModel: {},
    sources: {
      people: {
        fields: ['name', 'age'],
        rows: [
          { name: 'Charlie', age: 30 },
          { name: 'Alice', age: 25 },
          { name: 'Bob', age: 35 },
        ],
      },
    },
    filters: {},
  },
}

describe('A2UITable sorting', () => {
  it('does not show sort indicators when sortable is false', () => {
    const w = mountWith(A2UITable, {
      def: { dataSource: { source: 'people' } },
      surfaceId: 's1', componentId: 't1',
    }, tableSurfaces)
    const ths = w.findAll('th')
    expect(ths[0].text()).toBe('name')
    expect(ths[1].text()).toBe('age')
  })

  it('cycles sort on header click: unsorted → asc → desc → unsorted', async () => {
    const w = mountWith(A2UITable, {
      def: { dataSource: { source: 'people' }, sortable: true },
      surfaceId: 's1', componentId: 't1',
    }, tableSurfaces)

    // Initially unsorted (original order)
    expect(w.findAll('tbody tr td:first-child').map(td => td.text())).toEqual(['Charlie', 'Alice', 'Bob'])

    // Click name header → ascending
    await w.findAll('th')[0].trigger('click')
    expect(w.findAll('th')[0].text()).toContain('⬆')
    expect(w.findAll('tbody tr td:first-child').map(td => td.text())).toEqual(['Alice', 'Bob', 'Charlie'])

    // Click again → descending
    await w.findAll('th')[0].trigger('click')
    expect(w.findAll('th')[0].text()).toContain('⬇')
    expect(w.findAll('tbody tr td:first-child').map(td => td.text())).toEqual(['Charlie', 'Bob', 'Alice'])

    // Click again → unsorted
    await w.findAll('th')[0].trigger('click')
    expect(w.findAll('th')[0].text()).toBe('name')
    expect(w.findAll('tbody tr td:first-child').map(td => td.text())).toEqual(['Charlie', 'Alice', 'Bob'])
  })

  it('clicking a different column resets the previous sort', async () => {
    const w = mountWith(A2UITable, {
      def: { dataSource: { source: 'people' }, sortable: true },
      surfaceId: 's1', componentId: 't1',
    }, tableSurfaces)

    // Sort by name asc
    await w.findAll('th')[0].trigger('click')
    expect(w.findAll('th')[0].text()).toContain('⬆')

    // Click age header → resets name, sorts age asc
    await w.findAll('th')[1].trigger('click')
    expect(w.findAll('th')[0].text()).toBe('name')
    expect(w.findAll('th')[1].text()).toContain('⬆')
    // age ascending: 25, 30, 35
    expect(w.findAll('tbody tr td:first-child').map(td => td.text())).toEqual(['Alice', 'Charlie', 'Bob'])
  })

  it('sorts numbers numerically', async () => {
    const w = mountWith(A2UITable, {
      def: { dataSource: { source: 'people' }, sortable: true },
      surfaceId: 's1', componentId: 't1',
    }, tableSurfaces)

    await w.findAll('th')[1].trigger('click') // age asc
    expect(w.findAll('tbody tr td:nth-child(2)').map(td => td.text())).toEqual(['25', '30', '35'])

    await w.findAll('th')[1].trigger('click') // age desc
    expect(w.findAll('tbody tr td:nth-child(2)').map(td => td.text())).toEqual(['35', '30', '25'])
  })

  it('handles null/undefined values by sorting them to end', async () => {
    const surfaces = {
      s1: {
        components: {}, root: null, dataModel: {},
        sources: {
          data: {
            fields: ['val'],
            rows: [{ val: 3 }, { val: null }, { val: 1 }],
          },
        },
        filters: {},
      },
    }
    const w = mountWith(A2UITable, {
      def: { dataSource: { source: 'data' }, sortable: true },
      surfaceId: 's1', componentId: 't1',
    }, surfaces)

    await w.findAll('th')[0].trigger('click') // asc
    const vals = w.findAll('tbody tr td').map(td => td.text())
    expect(vals).toEqual(['1', '3', ''])

    await w.findAll('th')[0].trigger('click') // desc
    const valsDesc = w.findAll('tbody tr td').map(td => td.text())
    expect(valsDesc).toEqual(['3', '1', ''])
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
