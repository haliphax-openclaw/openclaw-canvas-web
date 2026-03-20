// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../src/client/services/ws-client', () => ({
  wsClient: { send: vi.fn(), on: vi.fn(), off: vi.fn(), connect: vi.fn() },
}))
vi.mock('virtual:openclaw-catalogs', async () => {
  const A2UIText = (await import('../../packages/a2ui-catalog-basic/src/A2UIText.vue')).default
  const A2UIButton = (await import('../../packages/a2ui-catalog-basic/src/A2UIButton.vue')).default
  const A2UISelect = (await import('../../packages/a2ui-catalog-basic/src/A2UIChoicePicker.vue')).default
  return {
    catalogComponents: {
      Text: { component: A2UIText },
      Button: { component: A2UIButton },
      ChoicePicker: { component: A2UISelect },
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

import A2UIText from '../../packages/a2ui-catalog-basic/src/A2UIText.vue'
import A2UIButton from '../../packages/a2ui-catalog-basic/src/A2UIButton.vue'
import A2UISelect from '../../packages/a2ui-catalog-basic/src/A2UIChoicePicker.vue'
import A2UINode from '../../src/client/components/A2UINode.vue'
import { mountWith } from '../__helpers__/mount'

describe('A2UINode', () => {
  it('resolves Text component from store', () => {
    const surfaces = {
      s1: {
        components: { c1: { component: 'Text', text: 'Hello' } },
        root: 'c1', dataModel: {}, sources: {}, filters: {},
      },
    }
    const w = mountWith(A2UINode, { componentId: 'c1', surfaceId: 's1' }, surfaces)
    expect(w.findComponent(A2UIText).exists()).toBe(true)
    expect(w.text()).toBe('Hello')
  })

  it('resolves Button component', () => {
    const surfaces = {
      s1: {
        components: { b1: { component: 'Button', label: 'Go' } },
        root: 'b1', dataModel: {}, sources: {}, filters: {},
      },
    }
    const w = mountWith(A2UINode, { componentId: 'b1', surfaceId: 's1' }, surfaces)
    expect(w.findComponent(A2UIButton).exists()).toBe(true)
    expect(w.find('button').text()).toBe('Go')
  })

  it('renders nothing for unknown component type', () => {
    const surfaces = {
      s1: {
        components: { x1: { component: 'UnknownWidget' } },
        root: 'x1', dataModel: {}, sources: {}, filters: {},
      },
    }
    const w = mountWith(A2UINode, { componentId: 'x1', surfaceId: 's1' }, surfaces)
    expect(w.html()).toBe('<!--v-if-->')
  })

  it('renders nothing for missing componentId', () => {
    const surfaces = {
      s1: { components: {}, root: null, dataModel: {}, sources: {}, filters: {} },
    }
    const w = mountWith(A2UINode, { componentId: 'missing', surfaceId: 's1' }, surfaces)
    expect(w.html()).toBe('<!--v-if-->')
  })

  it('resolves ChoicePicker', () => {
    const surfaces = {
      s1: {
        components: { ms1: { component: 'ChoicePicker', options: [{ value: 'a', label: 'A' }], selected: ['a'] } },
        root: 'ms1', dataModel: {}, sources: {}, filters: {},
      },
    }
    const w = mountWith(A2UINode, { componentId: 'ms1', surfaceId: 's1' }, surfaces)
    expect(w.findComponent(A2UISelect).exists()).toBe(true)
  })
})
