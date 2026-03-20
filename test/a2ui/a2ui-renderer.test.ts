// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'

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

import A2UIRenderer from '../../src/client/components/A2UIRenderer.vue'
import { mountWith } from '../__helpers__/mount'

describe('A2UIRenderer', () => {
  it('renders root component from store', () => {
    const surfaces = {
      s1: {
        components: { root: { component: 'Text', text: 'Root' } },
        root: 'root', dataModel: {}, sources: {}, filters: {},
      },
    }
    const w = mountWith(A2UIRenderer, { surfaceId: 's1' }, surfaces)
    expect(w.find('.a2ui-renderer').exists()).toBe(true)
    expect(w.text()).toBe('Root')
  })

  it('renders nothing when no root', () => {
    const surfaces = {
      s1: { components: {}, root: null, dataModel: {}, sources: {}, filters: {} },
    }
    const w = mountWith(A2UIRenderer, { surfaceId: 's1' }, surfaces)
    expect(w.find('.a2ui-renderer').exists()).toBe(false)
  })
})
