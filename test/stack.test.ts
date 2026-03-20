// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

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
  fetchCanvasConfig: vi.fn().mockResolvedValue({ skipConfirmation: false, agents: ['main', 'dev'], allowedAgentIds: [] }),
  truncateMessage: (msg: string) => msg.length > 200 ? msg.slice(0, 200) + '…' : msg,
  isOpenclawDeepLink: (url: string) => url.startsWith('openclaw://'),
}))
vi.stubGlobal('location', { origin: 'http://localhost:3456', protocol: 'http:', host: 'localhost:3456' })

import A2UIStack from '../packages/a2ui-catalog-extended/src/A2UIStack.vue'
import A2UINode from '../src/client/components/A2UINode.vue'
import { makeStore } from './__helpers__/mount'

const surfaces = {
  s1: {
    components: {
      t1: { component: 'Text', text: 'A' },
      t2: { component: 'Text', text: 'B' },
    },
    root: null, dataModel: {}, sources: {}, filters: {},
  },
}

describe('A2UIStack', () => {
  it('renders children', () => {
    const store = makeStore(surfaces)
    const w = mount(A2UIStack, {
      props: { def: { children: ['t1'] }, surfaceId: 's1' },
      global: { plugins: [store], components: { A2UINode } },
    })
    expect(w.find('.stack').exists()).toBe(true)
    expect(w.findAll('p')).toHaveLength(1)
  })
})
