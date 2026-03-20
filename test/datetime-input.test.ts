// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { a2uiModule } from '../src/client/store/a2ui'

vi.mock('../src/client/services/ws-client', () => ({
  wsClient: { send: vi.fn(), on: vi.fn(), off: vi.fn(), connect: vi.fn() },
}))
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

import A2UIDateTimeInput from '../packages/a2ui-catalog-basic/src/A2UIDateTimeInput.vue'

function makeStore(surfaces: Record<string, any> = {}) {
  return createStore({
    state: { session: { active: 'main', sessions: ['main'] }, panel: { visible: true } },
    modules: { a2ui: { ...a2uiModule, state: () => ({ surfaces }) } },
  })
}

function mountWith(def: Record<string, any>, surfaces: Record<string, any> = {}) {
  const store = makeStore(surfaces)
  return mount(A2UIDateTimeInput, { props: { def, surfaceId: 's1', componentId: 'dt1' }, global: { plugins: [store] } })
}

beforeEach(() => { vi.mocked(wsClient.send).mockClear() })

describe('A2UIDateTimeInput', () => {
  it('renders a date input by default', () => {
    const w = mountWith({ value: '2025-01-15' })
    expect(w.find('input').attributes('type')).toBe('date')
  })

  it('renders a time input when only enableTime is true', () => {
    const w = mountWith({ enableTime: true })
    expect(w.find('input').attributes('type')).toBe('time')
  })

  it('renders datetime-local when both enableDate and enableTime are true', () => {
    const w = mountWith({ enableDate: true, enableTime: true })
    expect(w.find('input').attributes('type')).toBe('datetime-local')
  })

  it('renders label when provided', () => {
    const w = mountWith({ label: 'Start Date' })
    expect(w.find('.label-text').text()).toBe('Start Date')
  })

  it('sends dateTimeChange on input', async () => {
    const w = mountWith({ value: '' })
    await w.find('input').setValue('2025-06-01')
    expect(wsClient.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'a2ui.dateTimeChange', componentId: 'dt1', value: '2025-06-01' }),
    )
  })
})
