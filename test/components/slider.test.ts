// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'

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

import A2UISlider from '../../packages/a2ui-catalog-basic/src/A2UISlider.vue'
import { mountWith } from '../__helpers__/mount'

beforeEach(() => { vi.mocked(wsClient.send).mockClear() })

describe('A2UISlider', () => {
  it('renders with min/max/value', () => {
    const w = mountWith(A2UISlider, { def: { min: 10, max: 50, value: 25, label: 'Vol' }, componentId: 'sl1', surfaceId: 's1' })
    const input = w.find('input')
    expect(input.attributes('min')).toBe('10')
    expect(input.attributes('max')).toBe('50')
    expect(w.find('.a2ui-slider-label').text()).toBe('Vol')
  })

  it('sends sliderChange on input', async () => {
    const w = mountWith(A2UISlider, { def: { min: 0, max: 100, value: 50 }, componentId: 'sl1', surfaceId: 's1' })
    await w.find('input').setValue('75')
    expect(wsClient.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'a2ui.sliderChange', componentId: 'sl1' }))
  })
})
