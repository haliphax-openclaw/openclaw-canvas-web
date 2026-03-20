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

import A2UITable from '../../packages/a2ui-catalog-extended/src/A2UITable.vue'
import { mountWith } from '../__helpers__/mount'

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

describe('A2UITable', () => {
  it('renders headers and rows', () => {
    const w = mountWith(A2UITable, {
      def: { headers: ['Name', 'Age'], rows: [['Alice', '30'], ['Bob', '25']] },
      surfaceId: 's1', componentId: 't1',
    })
    expect(w.findAll('th')).toHaveLength(2)
    expect(w.findAll('tbody tr')).toHaveLength(2)
    expect(w.findAll('td')[0].text()).toBe('Alice')
  })

  it('renders empty table when no data', () => {
    const w = mountWith(A2UITable, { def: {}, surfaceId: 's1', componentId: 't1' })
    expect(w.findAll('th')).toHaveLength(0)
    expect(w.findAll('tbody tr')).toHaveLength(0)
  })
})

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

describe('A2UITable static sorting', () => {
  it('sorts static rows ascending by clicking a column header', async () => {
    const w = mountWith(A2UITable, {
      def: { headers: ['Name', 'Score'], rows: [['Charlie', 30], ['Alice', 25], ['Bob', 35]], sortable: true },
      surfaceId: 's1', componentId: 't1',
    })

    // Initially unsorted
    expect(w.findAll('tbody tr td:first-child').map(td => td.text())).toEqual(['Charlie', 'Alice', 'Bob'])

    // Click Name header → ascending
    await w.findAll('th')[0].trigger('click')
    expect(w.findAll('th')[0].text()).toContain('⬆')
    expect(w.findAll('tbody tr td:first-child').map(td => td.text())).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('cycles static sort: unsorted → asc → desc → unsorted', async () => {
    const w = mountWith(A2UITable, {
      def: { headers: ['Name', 'Score'], rows: [['Charlie', 30], ['Alice', 25], ['Bob', 35]], sortable: true },
      surfaceId: 's1', componentId: 't1',
    })

    // Click Score header → ascending
    await w.findAll('th')[1].trigger('click')
    expect(w.findAll('tbody tr td:nth-child(2)').map(td => td.text())).toEqual(['25', '30', '35'])

    // Click again → descending
    await w.findAll('th')[1].trigger('click')
    expect(w.findAll('tbody tr td:nth-child(2)').map(td => td.text())).toEqual(['35', '30', '25'])

    // Click again → unsorted (original order)
    await w.findAll('th')[1].trigger('click')
    expect(w.findAll('tbody tr td:nth-child(2)').map(td => td.text())).toEqual(['30', '25', '35'])
  })

  it('does not sort static rows when sortable is false', async () => {
    const w = mountWith(A2UITable, {
      def: { headers: ['Name'], rows: [['Charlie'], ['Alice'], ['Bob']], sortable: false },
      surfaceId: 's1', componentId: 't1',
    })

    await w.findAll('th')[0].trigger('click')
    // Should remain in original order
    expect(w.findAll('tbody tr td').map(td => td.text())).toEqual(['Charlie', 'Alice', 'Bob'])
  })

  it('sorts static numeric values numerically, not lexicographically', async () => {
    const w = mountWith(A2UITable, {
      def: { headers: ['Val'], rows: [[9], [100], [20]], sortable: true },
      surfaceId: 's1', componentId: 't1',
    })

    await w.findAll('th')[0].trigger('click') // asc
    expect(w.findAll('tbody tr td').map(td => td.text())).toEqual(['9', '20', '100'])
  })
})
