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
  fetchCanvasConfig: vi.fn().mockResolvedValue({ skipConfirmation: false, agents: ['main'], allowedAgentIds: [] }),
  truncateMessage: (msg: string) => msg,
  isOpenclawDeepLink: (url: string) => url.startsWith('openclaw://'),
}))
vi.stubGlobal('location', { origin: 'http://localhost:3456', protocol: 'http:', host: 'localhost:3456' })

import A2UIProgressBar from '../packages/a2ui-catalog-extended/src/A2UIProgressBar.vue'

function makeStore(surfaces: Record<string, any> = {}) {
  return createStore({
    state: { session: { active: 'main', sessions: ['main'] }, panel: { visible: true } },
    modules: { a2ui: { ...a2uiModule, state: () => ({ surfaces }) } },
  })
}

function mountBar(def: Record<string, any>, surfaces: Record<string, any> = {}) {
  const store = makeStore(surfaces)
  return mount(A2UIProgressBar, { props: { def, surfaceId: 's1', componentId: 'c1' }, global: { plugins: [store] } })
}

const baseSurface = (rows: Record<string, unknown>[]) => ({
  s1: {
    components: {},
    root: null,
    dataModel: {},
    sources: { content: { fields: ['progress_label', 'progress_value'], rows } },
    filters: {},
  },
})

describe('A2UIProgressBar data binding', () => {
  it('renders static label and value without dataSource', () => {
    const w = mountBar({ label: 'Upload', value: 75 })
    expect(w.find('.a2ui-progress-label').text()).toBe('Upload')
    expect(w.find('progress').attributes('value')).toBe('75')
  })

  it('interpolates ${field} in label from first row', () => {
    const rows = [{ progress_label: 'Season 3 Completion', progress_value: 63 }]
    const w = mountBar(
      { label: '${progress_label}', value: 50, dataSource: { source: 'content' } },
      baseSurface(rows),
    )
    expect(w.find('.a2ui-progress-label').text()).toBe('Season 3 Completion')
  })

  it('interpolates ${field} in value from first row', () => {
    const rows = [{ progress_label: 'Test', progress_value: 63 }]
    const w = mountBar(
      { label: 'Progress', value: '${progress_value}', dataSource: { source: 'content' } },
      baseSurface(rows),
    )
    expect(w.find('progress').attributes('value')).toBe('63')
  })

  it('interpolates both label and value together', () => {
    const rows = [{ progress_label: 'Op Permafrost', progress_value: 42 }]
    const w = mountBar(
      { label: '${progress_label}', value: '${progress_value}', dataSource: { source: 'content' } },
      baseSurface(rows),
    )
    expect(w.find('.a2ui-progress-label').text()).toBe('Op Permafrost')
    expect(w.find('progress').attributes('value')).toBe('42')
  })

  it('clamps resolved value to 0-100', () => {
    const rows = [{ val: 150 }]
    const surfaces = { s1: { components: {}, root: null, dataModel: {}, sources: { s: { fields: ['val'], rows } }, filters: {} } }
    const w = mountBar({ label: 'X', value: '${val}', dataSource: { source: 's' } }, surfaces)
    expect(w.find('progress').attributes('value')).toBe('100')
  })

  it('resolves aggregate ${$value} in value', () => {
    const rows = [{ score: 30 }, { score: 70 }]
    const surfaces = { s1: { components: {}, root: null, dataModel: {}, sources: { s: { fields: ['score'], rows } }, filters: {} } }
    const w = mountBar(
      { label: 'Avg', value: '${$value}', dataSource: { source: 's', aggregate: { fn: 'avg', field: 'score' } } },
      surfaces,
    )
    expect(w.find('progress').attributes('value')).toBe('50')
  })

  it('resolves compound aggregates in label', () => {
    const rows = [{ name: 'A', score: 10 }, { name: 'B', score: 20 }]
    const surfaces = { s1: { components: {}, root: null, dataModel: {}, sources: { s: { fields: ['name', 'score'], rows } }, filters: {} } }
    const w = mountBar(
      {
        label: '${$count} items, total ${$total}',
        value: 50,
        dataSource: { source: 's', aggregates: { $count: { fn: 'count' }, $total: { fn: 'sum', field: 'score' } } },
      },
      surfaces,
    )
    expect(w.find('.a2ui-progress-label').text()).toBe('2 items, total 30')
  })

  it('returns original token for unknown placeholders', () => {
    const rows = [{ name: 'Alice' }]
    const w = mountBar(
      { label: 'Hi ${unknown}!', value: 50, dataSource: { source: 'content' } },
      baseSurface(rows),
    )
    expect(w.find('.a2ui-progress-label').text()).toBe('Hi ${unknown}!')
  })

  it('does not interpolate without dataSource', () => {
    const w = mountBar({ label: 'Hello ${name}', value: 50 })
    expect(w.find('.a2ui-progress-label').text()).toBe('Hello ${name}')
  })

  it('reacts to data source changes', async () => {
    const surfaces = baseSurface([{ progress_label: 'Phase 1', progress_value: 25 }])
    const store = makeStore(surfaces)
    const w = mount(A2UIProgressBar, {
      props: { def: { label: '${progress_label}', value: '${progress_value}', dataSource: { source: 'content' } }, surfaceId: 's1', componentId: 'c1' },
      global: { plugins: [store] },
    })
    expect(w.find('.a2ui-progress-label').text()).toBe('Phase 1')
    store.commit('a2ui/updateDataModel', {
      surfaceId: 's1',
      data: { $sources: { content: { fields: ['progress_label', 'progress_value'], rows: [{ progress_label: 'Phase 2', progress_value: 80 }] } } },
    })
    await w.vm.$nextTick()
    expect(w.find('.a2ui-progress-label').text()).toBe('Phase 2')
    expect(w.find('progress').attributes('value')).toBe('80')
  })
})
