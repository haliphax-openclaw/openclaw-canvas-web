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

import A2UICard from '../packages/a2ui-catalog-basic/src/A2UICard.vue'
import A2UINode from '../src/client/components/A2UINode.vue'

function makeStore(surfaces: Record<string, any> = {}) {
  return createStore({
    state: { session: { active: 'main', sessions: ['main'] }, panel: { visible: true } },
    modules: { a2ui: { ...a2uiModule, state: () => ({ surfaces }) } },
  })
}

describe('A2UICard', () => {
  it('renders card wrapper', () => {
    const surfaces = {
      s1: {
        components: { t1: { component: 'Text', text: 'Card content' } },
        root: null, dataModel: {}, sources: {}, filters: {},
      },
    }
    const store = makeStore(surfaces)
    const w = mount(A2UICard, {
      props: { def: { child: 't1' }, surfaceId: 's1', componentId: 'card1' },
      global: { plugins: [store], components: { A2UINode } },
    })
    expect(w.find('.a2ui-card').exists()).toBe(true)
    expect(w.find('.card-body').exists()).toBe(true)
  })

  it('renders child component inside card body', () => {
    const surfaces = {
      s1: {
        components: { t1: { component: 'Text', text: 'Hello Card' } },
        root: null, dataModel: {}, sources: {}, filters: {},
      },
    }
    const store = makeStore(surfaces)
    const w = mount(A2UICard, {
      props: { def: { child: 't1' }, surfaceId: 's1', componentId: 'card1' },
      global: { plugins: [store], components: { A2UINode } },
    })
    expect(w.text()).toContain('Hello Card')
  })

  it('renders empty card body when no child', () => {
    const surfaces = {
      s1: { components: {}, root: null, dataModel: {}, sources: {}, filters: {} },
    }
    const store = makeStore(surfaces)
    const w = mount(A2UICard, {
      props: { def: {}, surfaceId: 's1', componentId: 'card1' },
      global: { plugins: [store], components: { A2UINode } },
    })
    expect(w.find('.card-body').exists()).toBe(true)
    expect(w.find('.card-body').text()).toBe('')
  })
})
