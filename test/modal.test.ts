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
  const A2UIButton = (await import('../packages/a2ui-catalog-basic/src/A2UIButton.vue')).default
  const A2UIColumn = (await import('../packages/a2ui-catalog-basic/src/A2UIColumn.vue')).default
  return {
    catalogComponents: {
      Text: { component: A2UIText },
      Button: { component: A2UIButton },
      Column: { component: A2UIColumn },
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

import A2UIModal from '../packages/a2ui-catalog-basic/src/A2UIModal.vue'
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
      triggerBtn: { component: 'Button', label: 'Open' },
      modalContent: { component: 'Text', text: 'Modal body' },
    },
    root: null, dataModel: {}, sources: {}, filters: {},
  },
}

describe('A2UIModal', () => {
  it('renders trigger and content areas', () => {
    const store = makeStore(surfaces)
    const w = mount(A2UIModal, {
      props: { def: { trigger: 'triggerBtn', content: 'modalContent' }, surfaceId: 's1', componentId: 'modal1' },
      global: { plugins: [store], components: { A2UINode } },
    })
    expect(w.find('.a2ui-modal-wrapper').exists()).toBe(true)
    expect(w.find('dialog').exists()).toBe(true)
  })

  it('starts closed (no modal-open class)', () => {
    const store = makeStore(surfaces)
    const w = mount(A2UIModal, {
      props: { def: { trigger: 'triggerBtn', content: 'modalContent' }, surfaceId: 's1', componentId: 'modal1' },
      global: { plugins: [store], components: { A2UINode } },
    })
    expect(w.find('dialog').classes()).not.toContain('modal-open')
  })

  it('opens when trigger area is clicked', async () => {
    const store = makeStore(surfaces)
    const w = mount(A2UIModal, {
      props: { def: { trigger: 'triggerBtn', content: 'modalContent' }, surfaceId: 's1', componentId: 'modal1' },
      global: { plugins: [store], components: { A2UINode } },
    })
    // Click the trigger wrapper div
    await w.find('.a2ui-modal-wrapper > div').trigger('click')
    expect(w.find('dialog').classes()).toContain('modal-open')
  })

  it('closes when Close button is clicked', async () => {
    const store = makeStore(surfaces)
    const w = mount(A2UIModal, {
      props: { def: { trigger: 'triggerBtn', content: 'modalContent' }, surfaceId: 's1', componentId: 'modal1' },
      global: { plugins: [store], components: { A2UINode } },
    })
    // Open first
    await w.find('.a2ui-modal-wrapper > div').trigger('click')
    expect(w.find('dialog').classes()).toContain('modal-open')
    // Click the Close button in modal-action
    await w.find('.modal-action .btn').trigger('click')
    expect(w.find('dialog').classes()).not.toContain('modal-open')
  })

  it('renders trigger child component', () => {
    const store = makeStore(surfaces)
    const w = mount(A2UIModal, {
      props: { def: { trigger: 'triggerBtn', content: 'modalContent' }, surfaceId: 's1', componentId: 'modal1' },
      global: { plugins: [store], components: { A2UINode } },
    })
    expect(w.find('button').text()).toBe('Open')
  })
})
