// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/client/services/ws-client', () => ({
  wsClient: { send: vi.fn(), on: vi.fn(), off: vi.fn(), connect: vi.fn() },
}))
vi.mock('../src/client/services/deep-link', () => ({
  parseOpenclawUrl: vi.fn(),
  executeDeepLink: vi.fn().mockResolvedValue({ ok: true }),
  fetchCanvasConfig: vi.fn().mockResolvedValue({ skipConfirmation: false, agents: ['main', 'dev'], allowedAgentIds: [] }),
  truncateMessage: (msg: string) => msg.length > 200 ? msg.slice(0, 200) + '…' : msg,
  isOpenclawDeepLink: (url: string) => url.startsWith('openclaw://'),
}))
vi.stubGlobal('location', { origin: 'http://localhost:3456', protocol: 'http:', host: 'localhost:3456' })

import { wsClient } from '../src/client/services/ws-client'
import { registerWsSend } from '@haliphax-openclaw/a2ui-sdk'
registerWsSend(wsClient.send.bind(wsClient))

import A2UICheckbox from '../packages/a2ui-catalog-basic/src/A2UICheckbox.vue'
import { mountWith } from './__helpers__/mount'

beforeEach(() => { vi.mocked(wsClient.send).mockClear() })

describe('A2UICheckbox', () => {
  it('renders label and checked state', () => {
    const w = mountWith(A2UICheckbox, { def: { label: 'Agree', checked: true }, componentId: 'c1', surfaceId: 's1' })
    expect(w.find('span').text()).toBe('Agree')
    expect((w.find('input').element as HTMLInputElement).checked).toBe(true)
  })

  it('sends checkboxChange on change', async () => {
    const w = mountWith(A2UICheckbox, { def: { label: 'X' }, componentId: 'cb1', surfaceId: 's1' })
    await w.find('input').setValue(true)
    expect(wsClient.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'a2ui.checkboxChange', componentId: 'cb1' }))
  })
})
