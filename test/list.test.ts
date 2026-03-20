// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { a2uiModule } from '../src/client/store/a2ui'

vi.mock('../src/client/services/ws-client', () => ({
  wsClient: { send: vi.fn(), on: vi.fn(), off: vi.fn(), connect: vi.fn() },
}))
vi.mock('virtual:openclaw-catalogs', async () => {
  const A2UIText = (await import('../packages/a2ui-catalog-basic/src/A2UIText.vue')).default
  return {
    catalogComponents: {
      Text: { component: A2UIText },
    },
  }
})
vi.mock('../src/client/services/deep-link', () => ({
  parseOpenclawUrl: vi.fn(),
  executeDeepLink: vi.fn().mockResolvedValue({ ok: true }),
  fetchCanvasConfig: vi.fn().mockResolvedValue({ skipConfirmation: false, agents: ['main'], allowedAgentIds: [] }),
  truncateMessage: (msg: string) => msg,
  isOpenclawDeepLink: (url: string) => url.startsWith('openclaw://'),
}))
vi.stubGlobal('location', { origin: 'http://localhost:3456', protocol: 'http:', host: 'localhost:3456' })

import { wsClient } from '../src/client/services/ws-client'
import { registerWsSend } from '@haliphax-openclaw/a2ui-sdk'
registerWsSend(wsClient.send.bind(wsClient))

import A2UIList from '../packages/a2ui-catalog-basic/src/A2UIList.vue'
import A2UINode from '../src/client/components/A2UINode.vue'

function makeStore(surfaces: Record<string, any> = {}) {
  return createStore({
    state: { session: { active: 'main', sessions: ['main'] }, panel: { visible: true } },
    modules: { a2ui: { ...a2uiModule, state: () => ({ surfaces }) } },
  })
}

const surfaces = {
  s1: {
    components: {
      t1: { component: 'Text', text: 'Item A' },
      t2: { component: 'Text', text: 'Item B' },
      t3: { component: 'Text', text: 'Item C' },
    },
    root: null, dataModel: {}, sources: {}, filters: {},
  },
}

function mountList(def: Record<string, any>) {
  const store = makeStore(surfaces)
  return mount(A2UIList, {
    props: { def, surfaceId: 's1', componentId: 'list1' },
    global: { plugins: [store], components: { A2UINode } },
  })
}

describe('A2UIList', () => {
  it('renders children', () => {
    const w = mountList({ children: ['t1', 't2', 't3'] })
    expect(w.find('.a2ui-list').exists()).toBe(true)
    expect(w.findAll('.a2ui-list-item')).toHaveLength(3)
  })

  it('defaults to vertical direction', () => {
    const w = mountList({ children: ['t1'] })
    expect(w.find('.a2ui-list').classes()).toContain('a2ui-list--vertical')
  })

  it('supports horizontal direction', () => {
    const w = mountList({ children: ['t1'], direction: 'horizontal' })
    expect(w.find('.a2ui-list').classes()).toContain('a2ui-list--horizontal')
  })

  it('supports explicitList form for children', () => {
    const w = mountList({ children: { explicitList: ['t1', 't2'] } })
    expect(w.findAll('.a2ui-list-item')).toHaveLength(2)
  })

  it('renders empty list when no children', () => {
    const w = mountList({})
    expect(w.find('.a2ui-list').exists()).toBe(true)
    expect(w.findAll('.a2ui-list-item')).toHaveLength(0)
  })
})
