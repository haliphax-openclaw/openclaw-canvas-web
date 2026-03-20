// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

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
  fetchCanvasConfig: vi.fn().mockResolvedValue({ skipConfirmation: false, agents: ['main', 'dev'], allowedAgentIds: [] }),
  truncateMessage: (msg: string) => msg.length > 200 ? msg.slice(0, 200) + '…' : msg,
  isOpenclawDeepLink: (url: string) => url.startsWith('openclaw://'),
}))
vi.stubGlobal('location', { origin: 'http://localhost:3456', protocol: 'http:', host: 'localhost:3456' })

import A2UIWrap from '../../packages/a2ui-catalog-extended/src/A2UIWrap.vue'
import A2UINode from '../../src/client/components/A2UINode.vue'
import { makeStore } from '../__helpers__/mount'

const surfaces = {
  s1: {
    components: {
      t1: { component: 'Text', text: 'A' },
      t2: { component: 'Text', text: 'B' },
      t3: { component: 'Text', text: 'C' },
    },
    root: null, dataModel: {}, sources: {}, filters: {},
  },
}

describe('A2UIWrap', () => {
  it('renders children in a flex-wrap container', () => {
    const store = makeStore(surfaces)
    const w = mount(A2UIWrap, {
      props: { def: { children: ['t1', 't2', 't3'] }, surfaceId: 's1' },
      global: { plugins: [store], components: { A2UINode } },
    })
    expect(w.find('.a2ui-wrap').exists()).toBe(true)
    expect(w.findAll('p')).toHaveLength(3)
  })

  it('applies default gap when no gap prop is set', () => {
    const store = makeStore(surfaces)
    const w = mount(A2UIWrap, {
      props: { def: { children: ['t1'] }, surfaceId: 's1' },
      global: { plugins: [store], components: { A2UINode } },
    })
    const style = w.find('.a2ui-wrap').attributes('style')
    expect(style).toBeUndefined()
  })

  it('applies custom gap when provided', () => {
    const store = makeStore(surfaces)
    const w = mount(A2UIWrap, {
      props: { def: { children: ['t1'], gap: '16px' }, surfaceId: 's1' },
      global: { plugins: [store], components: { A2UINode } },
    })
    const style = w.find('.a2ui-wrap').attributes('style')
    expect(style).toContain('gap: 16px')
  })

  it('renders empty when no children provided', () => {
    const store = makeStore(surfaces)
    const w = mount(A2UIWrap, {
      props: { def: {}, surfaceId: 's1' },
      global: { plugins: [store], components: { A2UINode } },
    })
    expect(w.find('.a2ui-wrap').exists()).toBe(true)
    expect(w.findAll('p')).toHaveLength(0)
  })
})
