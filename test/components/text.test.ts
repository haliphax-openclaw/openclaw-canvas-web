// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { a2uiModule } from '../../src/client/store/a2ui'

vi.mock('../../src/client/services/ws-client', () => ({
  wsClient: { send: vi.fn(), on: vi.fn(), off: vi.fn(), connect: vi.fn() },
}))
vi.mock('../../src/client/services/deep-link', () => ({
  parseOpenclawUrl: vi.fn(),
  executeDeepLink: vi.fn().mockResolvedValue({ ok: true }),
  fetchCanvasConfig: vi.fn().mockResolvedValue({ skipConfirmation: false, agents: ['main'], allowedAgentIds: [] }),
  truncateMessage: (msg: string) => msg,
  isOpenclawDeepLink: (url: string) => url.startsWith('openclaw://'),
}))
vi.stubGlobal('location', { origin: 'http://localhost:3456', protocol: 'http:', host: 'localhost:3456' })

import A2UIText from '../../packages/a2ui-catalog-basic/src/A2UIText.vue'
import { mountWith } from '../__helpers__/mount'

function makeStore(surfaces: Record<string, any> = {}) {
  return createStore({
    state: { session: { active: 'main', sessions: ['main'] }, panel: { visible: true } },
    modules: { a2ui: { ...a2uiModule, state: () => ({ surfaces }) } },
  })
}

function mountText(def: Record<string, any>, surfaces: Record<string, any> = {}) {
  const store = makeStore(surfaces)
  return mount(A2UIText, { props: { def, surfaceId: 's1', componentId: 'c1' }, global: { plugins: [store] } })
}

const baseSurface = (rows: Record<string, unknown>[]) => ({
  s1: {
    components: {},
    root: null,
    dataModel: {},
    sources: { items: { fields: ['name', 'amount'], rows } },
    filters: {},
  },
})

describe('A2UIText', () => {
  it('renders text in a p tag by default', () => {
    const w = mountWith(A2UIText, { def: { text: 'Hello' }, surfaceId: 's1', componentId: 'c1' })
    expect(w.find('p').text()).toBe('Hello')
  })

  it('renders literalString form', () => {
    const w = mountWith(A2UIText, { def: { text: { literalString: 'Lit' } }, surfaceId: 's1', componentId: 'c1' })
    expect(w.find('p').text()).toBe('Lit')
  })

  it('uses variant to pick tag', () => {
    const w = mountWith(A2UIText, { def: { text: 'Title', variant: 'h1' }, surfaceId: 's1', componentId: 'c1' })
    expect(w.find('h1').text()).toBe('Title')
  })

  it('maps label hint to span', () => {
    const w = mountWith(A2UIText, { def: { text: 'lbl', variant: 'label' }, surfaceId: 's1', componentId: 'c1' })
    expect(w.find('span').text()).toBe('lbl')
  })
})

describe('A2UIText data binding', () => {
  it('interpolates ${field} placeholders from first row', () => {
    const rows = [{ name: 'Alice', amount: 100 }, { name: 'Bob', amount: 200 }]
    const w = mountText(
      { text: 'User: ${name}, Amount: ${amount}', dataSource: { source: 'items' } },
      baseSurface(rows),
    )
    expect(w.text()).toBe('User: Alice, Amount: 100')
  })

  it('interpolates aggregate ${$value} in text prop', () => {
    const rows = [{ name: 'A', amount: 10 }, { name: 'B', amount: 20 }]
    const w = mountText(
      { text: 'Total: ${$value}', dataSource: { source: 'items', aggregate: { fn: 'sum', field: 'amount' } } },
      baseSurface(rows),
    )
    expect(w.text()).toBe('Total: 30')
  })

  it('interpolates compound aggregates in text prop', () => {
    const rows = [{ name: 'A', amount: 10 }, { name: 'B', amount: 20 }]
    const w = mountText(
      {
        text: '${$count} items, total ${$total}',
        dataSource: {
          source: 'items',
          aggregates: {
            $count: { fn: 'count' },
            $total: { fn: 'sum', field: 'amount' },
          },
        },
      },
      baseSurface(rows),
    )
    expect(w.text()).toBe('2 items, total 30')
  })

  it('uses map.text over text prop when both present', () => {
    const rows = [{ name: 'Alice', amount: 50 }]
    const w = mountText(
      {
        text: 'fallback',
        dataSource: { source: 'items', aggregate: { fn: 'count' }, map: { text: '${$value} records' } },
      },
      baseSurface(rows),
    )
    expect(w.text()).toBe('1 records')
  })

  it('resolves ${field} in map templates against first row', () => {
    const rows = [{ name: 'Alice', amount: 42 }]
    const w = mountText(
      {
        text: 'fallback',
        dataSource: { source: 'items', map: { text: 'Name: ${name}' } },
      },
      baseSurface(rows),
    )
    expect(w.text()).toBe('Name: Alice')
  })

  it('returns original token for unknown placeholders', () => {
    const rows = [{ name: 'Alice' }]
    const w = mountText(
      { text: 'Hi ${unknown}!', dataSource: { source: 'items' } },
      baseSurface(rows),
    )
    expect(w.text()).toBe('Hi ${unknown}!')
  })

  it('falls back to static text when no dataSource', () => {
    const w = mountText({ text: 'Hello ${name}' })
    expect(w.text()).toBe('Hello ${name}')
  })

  it('reacts to data source changes', async () => {
    const surfaces = baseSurface([{ name: 'Alice', amount: 10 }])
    const store = makeStore(surfaces)
    const w = mount(A2UIText, {
      props: { def: { text: 'User: ${name}', dataSource: { source: 'items' } }, surfaceId: 's1', componentId: 'c1' },
      global: { plugins: [store] },
    })
    expect(w.text()).toBe('User: Alice')
    store.commit('a2ui/updateDataModel', {
      surfaceId: 's1',
      data: { $sources: { items: { fields: ['name', 'amount'], rows: [{ name: 'Bob', amount: 20 }] } } },
    })
    await w.vm.$nextTick()
    expect(w.text()).toBe('User: Bob')
  })

  it('reacts to filter changes', async () => {
    const rows = [{ name: 'Alice', amount: 10 }, { name: 'Bob', amount: 20 }]
    const store = makeStore(baseSurface(rows))
    const w = mount(A2UIText, {
      props: { def: { text: 'First: ${name}', dataSource: { source: 'items' } }, surfaceId: 's1', componentId: 'c1' },
      global: { plugins: [store] },
    })
    expect(w.text()).toBe('First: Alice')
    store.commit('a2ui/setFilter', {
      surfaceId: 's1', source: 'items', field: 'name', op: 'eq', value: 'Bob', nullValue: null, isNull: false, componentId: 'f1',
    })
    await w.vm.$nextTick()
    expect(w.text()).toBe('First: Bob')
  })

  it('supports compact format in aggregates', () => {
    const rows = Array.from({ length: 1500 }, (_, i) => ({ name: `u${i}`, amount: 1 }))
    const w = mountText(
      {
        text: '${$total} items',
        dataSource: { source: 'items', aggregates: { $total: { fn: 'count', format: 'compact' } } },
      },
      baseSurface(rows),
    )
    expect(w.text()).toBe('1.5K items')
  })
})
