// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { a2uiModule } from '../../src/client/store/a2ui'

vi.mock('../../src/client/services/ws-client', () => ({
  wsClient: { send: vi.fn(), on: vi.fn(), off: vi.fn(), connect: vi.fn() },
}))
vi.mock('virtual:openclaw-catalogs', async () => {
  const A2UIText = (await import('../../packages/a2ui-catalog-basic/src/A2UIText.vue')).default
  return {
    catalogComponents: {
      Text: { component: A2UIText },
    },
  }
})
vi.mock('../../src/client/services/deep-link', () => ({
  parseOpenclawUrl: vi.fn(),
  executeDeepLink: vi.fn().mockResolvedValue({ ok: true }),
  fetchCanvasConfig: vi.fn().mockResolvedValue({ skipConfirmation: false, agents: ['main'], allowedAgentIds: [] }),
  truncateMessage: (msg: string) => msg,
  isOpenclawDeepLink: (url: string) => url.startsWith('openclaw://'),
}))
vi.stubGlobal('location', { origin: 'http://localhost:3456', protocol: 'http:', host: 'localhost:3456' })

import { wsClient } from '../../src/client/services/ws-client'
import { registerWsSend } from '@haliphax-openclaw/a2ui-sdk'
registerWsSend(wsClient.send.bind(wsClient))

import A2UIList from '../../packages/a2ui-catalog-basic/src/A2UIList.vue'
import A2UINode from '../../src/client/components/A2UINode.vue'

function makeStore(surfaces: Record<string, any> = {}) {
  return createStore({
    state: { session: { active: 'main', sessions: ['main'] }, panel: { visible: true } },
    modules: { a2ui: { ...a2uiModule, state: () => ({ surfaces }) } },
  })
}

const surfaces = {
  s1: {
    components: {
      // Row definitions (children looked up by List)
      r1: { component: 'Row', children: ['c1a', 'c1b', 'c1c'] },
      r2: { component: 'Row', children: ['c2a', 'c2b'] },
      r3: { component: 'Row', children: { explicitList: ['c3a', 'c3b'] } },
      // Column components
      c1a: { component: 'Text', text: 'Name 1' },
      c1b: { component: 'Text', text: 'Role 1' },
      c1c: { component: 'Text', text: 'Status 1' },
      c2a: { component: 'Text', text: 'Name 2' },
      c2b: { component: 'Text', text: 'Role 2' },
      c3a: { component: 'Text', text: 'Name 3' },
      c3b: { component: 'Text', text: 'Role 3' },
    },
    root: null, dataModel: {}, sources: {}, filters: {},
  },
}

function mountList(def: Record<string, any>, customSurfaces?: Record<string, any>) {
  const store = makeStore(customSurfaces ?? surfaces)
  return mount(A2UIList, {
    props: { def, surfaceId: 's1', componentId: 'list1' },
    global: { plugins: [store], components: { A2UINode } },
  })
}

describe('A2UIList', () => {
  it('renders ul with list class', () => {
    const w = mountList({ rows: ['r1'] })
    expect(w.find('ul.list').exists()).toBe(true)
  })

  it('renders li with list-row class for each row', () => {
    const w = mountList({ rows: ['r1', 'r2'] })
    const items = w.findAll('li.list-row')
    expect(items).toHaveLength(2)
  })

  it('renders row children as direct columns inside list-row', () => {
    const w = mountList({ rows: ['r1'] })
    const row = w.find('li.list-row')
    // r1 has 3 children: c1a, c1b, c1c
    const cols = row.findAll(':scope > div')
    expect(cols).toHaveLength(3)
  })

  it('renders text content from column components', () => {
    const w = mountList({ rows: ['r1'] })
    expect(w.text()).toContain('Name 1')
    expect(w.text()).toContain('Role 1')
    expect(w.text()).toContain('Status 1')
  })

  it('applies list-col-grow to column index 1 by default', () => {
    const w = mountList({ rows: ['r1'] })
    const row = w.find('li.list-row')
    const cols = row.findAll(':scope > div')
    expect(cols[0].classes()).not.toContain('list-col-grow')
    expect(cols[1].classes()).toContain('list-col-grow')
    expect(cols[2].classes()).not.toContain('list-col-grow')
  })

  it('applies list-col-grow to custom column index', () => {
    const w = mountList({ rows: ['r1'], grow: 2 })
    const row = w.find('li.list-row')
    const cols = row.findAll(':scope > div')
    expect(cols[0].classes()).not.toContain('list-col-grow')
    expect(cols[1].classes()).not.toContain('list-col-grow')
    expect(cols[2].classes()).toContain('list-col-grow')
  })

  it('applies list-col-wrap to specified column index', () => {
    const w = mountList({ rows: ['r1'], wrap: 2 })
    const row = w.find('li.list-row')
    const cols = row.findAll(':scope > div')
    expect(cols[0].classes()).not.toContain('list-col-wrap')
    expect(cols[1].classes()).not.toContain('list-col-wrap')
    expect(cols[2].classes()).toContain('list-col-wrap')
  })

  it('does not apply list-col-wrap when wrap is not set', () => {
    const w = mountList({ rows: ['r1'] })
    const row = w.find('li.list-row')
    const cols = row.findAll(':scope > div')
    for (const col of cols) {
      expect(col.classes()).not.toContain('list-col-wrap')
    }
  })

  it('supports explicitList form for rows', () => {
    const w = mountList({ rows: { explicitList: ['r1', 'r2'] } })
    expect(w.findAll('li.list-row')).toHaveLength(2)
  })

  it('supports explicitList form for row children', () => {
    const w = mountList({ rows: ['r3'] })
    const row = w.find('li.list-row')
    const cols = row.findAll(':scope > div')
    expect(cols).toHaveLength(2)
    expect(w.text()).toContain('Name 3')
  })

  it('renders empty list when no rows', () => {
    const w = mountList({})
    expect(w.find('ul.list').exists()).toBe(true)
    expect(w.findAll('li.list-row')).toHaveLength(0)
  })

  it('renders empty row when row component has no children', () => {
    const emptySurfaces = {
      s1: {
        components: { r1: { component: 'Row' } },
        root: null, dataModel: {}, sources: {}, filters: {},
      },
    }
    const w = mountList({ rows: ['r1'] }, emptySurfaces)
    const row = w.find('li.list-row')
    expect(row.exists()).toBe(true)
    expect(row.findAll(':scope > div')).toHaveLength(0)
  })

  it('applies both grow and wrap to different columns', () => {
    const w = mountList({ rows: ['r1'], grow: 1, wrap: 0 })
    const row = w.find('li.list-row')
    const cols = row.findAll(':scope > div')
    expect(cols[0].classes()).toContain('list-col-wrap')
    expect(cols[0].classes()).not.toContain('list-col-grow')
    expect(cols[1].classes()).toContain('list-col-grow')
    expect(cols[1].classes()).not.toContain('list-col-wrap')
  })
})
