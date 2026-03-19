import { describe, it, expect, beforeEach } from 'vitest'
import { a2uiModule, type A2UIState } from '../src/client/store/a2ui'

// Minimal Vuex-like test harness: call mutations directly on state
function createState(): A2UIState {
  return (a2uiModule.state as () => A2UIState)()
}

const mutations = a2uiModule.mutations!
const getters = a2uiModule.getters!

describe('a2ui Vuex module mutations', () => {
  let state: A2UIState

  beforeEach(() => { state = createState() })

  it('upsertSurface creates surface and adds components', () => {
    mutations.upsertSurface(state, { surfaceId: 's1', components: [{ id: 'c1', component: 'Text', text: 'hi' }] })
    expect(state.surfaces.s1).toBeTruthy()
    expect(state.surfaces.s1.components.c1).toEqual({ component: 'Text', text: 'hi' })
  })

  it('upsertSurface merges into existing surface', () => {
    mutations.upsertSurface(state, { surfaceId: 's1', components: [{ id: 'c1', component: 'Text' }] })
    mutations.upsertSurface(state, { surfaceId: 's1', components: [{ id: 'c2', component: 'Button' }] })
    expect(Object.keys(state.surfaces.s1.components)).toEqual(['c1', 'c2'])
  })

  it('setRoot sets root on existing surface', () => {
    mutations.upsertSurface(state, { surfaceId: 's1', components: [] })
    mutations.setRoot(state, { surfaceId: 's1', root: 'c1' })
    expect(state.surfaces.s1.root).toBe('c1')
  })

  it('updateDataModel merges data', () => {
    mutations.upsertSurface(state, { surfaceId: 's1', components: [] })
    mutations.updateDataModel(state, { surfaceId: 's1', data: { a: 1 } })
    mutations.updateDataModel(state, { surfaceId: 's1', data: { b: 2 } })
    expect(state.surfaces.s1.dataModel).toEqual({ a: 1, b: 2 })
  })

  it('updateDataModel extracts $sources into sources map', () => {
    mutations.upsertSurface(state, { surfaceId: 's1', components: [] })
    mutations.updateDataModel(state, {
      surfaceId: 's1',
      data: { $sources: { items: { fields: ['name'], rows: [{ name: 'Alice' }] } } },
    })
    expect(state.surfaces.s1.sources.items.rows).toEqual([{ name: 'Alice' }])
    expect(state.surfaces.s1.dataModel.$sources).toBeUndefined()
  })

  it('updateDataModel merges source rows by primaryKey', () => {
    mutations.upsertSurface(state, { surfaceId: 's1', components: [] })
    mutations.updateDataModel(state, {
      surfaceId: 's1',
      data: { $sources: { items: { fields: ['id', 'v'], rows: [{ id: '1', v: 'a' }], primaryKey: 'id' } } },
    })
    mutations.updateDataModel(state, {
      surfaceId: 's1',
      data: { $sources: { items: { fields: [], rows: [{ id: '1', v: 'b' }, { id: '2', v: 'c' }] } } },
      merge: true,
    })
    const rows = state.surfaces.s1.sources.items.rows
    expect(rows).toHaveLength(2)
    expect(rows.find((r: any) => r.id === '1')!.v).toBe('b')
  })

  it('setFilter adds and replaces filters', () => {
    mutations.upsertSurface(state, { surfaceId: 's1', components: [] })
    mutations.setFilter(state, { surfaceId: 's1', source: 'items', field: 'name', op: 'eq', value: 'Alice', nullValue: '', isNull: false, componentId: 'c1' })
    expect(state.surfaces.s1.filters.items).toHaveLength(1)
    mutations.setFilter(state, { surfaceId: 's1', source: 'items', field: 'name', op: 'eq', value: 'Bob', nullValue: '', isNull: false, componentId: 'c1' })
    expect(state.surfaces.s1.filters.items).toHaveLength(1)
    expect(state.surfaces.s1.filters.items[0].value).toBe('Bob')
  })

  it('clearFilters removes all filters for a surface', () => {
    mutations.upsertSurface(state, { surfaceId: 's1', components: [] })
    mutations.setFilter(state, { surfaceId: 's1', source: 'items', field: 'x', op: 'eq', value: 1, nullValue: '', isNull: false, componentId: 'c1' })
    mutations.clearFilters(state, { surfaceId: 's1' })
    expect(state.surfaces.s1.filters).toEqual({})
  })

  it('deleteSurface removes surface', () => {
    mutations.upsertSurface(state, { surfaceId: 's1', components: [] })
    mutations.deleteSurface(state, { surfaceId: 's1' })
    expect(state.surfaces.s1).toBeUndefined()
  })

  it('clearAll removes all surfaces', () => {
    mutations.upsertSurface(state, { surfaceId: 's1', components: [] })
    mutations.upsertSurface(state, { surfaceId: 's2', components: [] })
    mutations.clearAll(state)
    expect(Object.keys(state.surfaces)).toHaveLength(0)
  })
})

describe('a2ui Vuex module getters', () => {
  it('filteredSource applies active filters', () => {
    const state = createState()
    mutations.upsertSurface(state, { surfaceId: 's1', components: [] })
    mutations.updateDataModel(state, {
      surfaceId: 's1',
      data: { $sources: { items: { fields: ['name'], rows: [{ name: 'Alice' }, { name: 'Bob' }] } } },
    })
    mutations.setFilter(state, { surfaceId: 's1', source: 'items', field: 'name', op: 'eq', value: 'Alice', nullValue: '', isNull: false, componentId: 'c1' })

    const getter = getters.filteredSource(state, {}, {} as any, {})
    const result = getter('s1', 'items')
    expect(result).toEqual([{ name: 'Alice' }])
  })

  it('filteredSource returns empty for missing surface', () => {
    const state = createState()
    const getter = getters.filteredSource(state, {}, {} as any, {})
    expect(getter('nope', 'items')).toEqual([])
  })
})
