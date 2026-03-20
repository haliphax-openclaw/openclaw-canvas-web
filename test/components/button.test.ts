// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { a2uiModule } from '../../src/client/store/a2ui'

vi.mock('../../src/client/services/ws-client', () => ({
  wsClient: { send: vi.fn(), on: vi.fn(), off: vi.fn(), connect: vi.fn() },
}))
vi.mock('../../src/client/services/deep-link', () => ({
  parseOpenclawUrl: vi.fn(),
  executeDeepLink: vi.fn().mockResolvedValue({ ok: true }),
  fetchCanvasConfig: vi.fn().mockResolvedValue({ skipConfirmation: false, agents: ['main', 'dev'], allowedAgentIds: [] }),
  truncateMessage: (msg: string) => msg.length > 200 ? msg.slice(0, 200) + '…' : msg,
  isOpenclawDeepLink: (url: string) => url.startsWith('openclaw://'),
}))
vi.stubGlobal('location', { origin: 'http://localhost:3456', protocol: 'http:', host: 'localhost:3456' })

import { wsClient } from '../../src/client/services/ws-client'
import { registerWsSend } from '@haliphax-openclaw/a2ui-sdk'
registerWsSend(wsClient.send.bind(wsClient))

import A2UIButton from '../../packages/a2ui-catalog-basic/src/A2UIButton.vue'
import { mountWith } from '../__helpers__/mount'

beforeEach(() => { vi.mocked(wsClient.send).mockClear() })

describe('A2UIButton', () => {
  it('renders label text', () => {
    const w = mountWith(A2UIButton, { def: { label: 'Click me' }, surfaceId: 's1', componentId: 'c1' })
    expect(w.find('button').text()).toBe('Click me')
  })

  it('defaults label to Button', () => {
    const w = mountWith(A2UIButton, { def: {}, surfaceId: 's1', componentId: 'c1' })
    expect(w.find('button').text()).toBe('Button')
  })

  it('sends buttonClick on click', async () => {
    const w = mountWith(A2UIButton, { def: { label: 'Go' }, surfaceId: 's1', componentId: 'btn1' })
    await w.find('button').trigger('click')
    expect(wsClient.send).toHaveBeenCalledWith({ type: 'a2ui.buttonClick', componentId: 'btn1' })
  })
})
