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
  fetchCanvasConfig: vi.fn().mockResolvedValue({ skipConfirmation: false, agents: ['main'], allowedAgentIds: [] }),
  truncateMessage: (msg: string) => msg,
  isOpenclawDeepLink: (url: string) => url.startsWith('openclaw://'),
}))
vi.stubGlobal('location', { origin: 'http://localhost:3456', protocol: 'http:', host: 'localhost:3456' })

import { wsClient } from '../../src/client/services/ws-client'
import { registerWsSend } from '@haliphax-openclaw/a2ui-sdk'
registerWsSend(wsClient.send.bind(wsClient))

import A2UITextField from '../../packages/a2ui-catalog-basic/src/A2UITextField.vue'

const emptySurface = () => ({
  root: null,
  dataModel: {} as Record<string, unknown>,
  components: {},
  sources: {},
  filters: {},
})

function makeStore(surfaces: Record<string, any> = {}) {
  const merged =
    Object.keys(surfaces).length === 0
      ? { s1: emptySurface() }
      : Object.fromEntries(
          Object.entries(surfaces).map(([id, s]) => [id, { ...emptySurface(), ...s }]),
        )
  return createStore({
    state: { session: { active: 'main', sessions: ['main'] }, panel: { visible: true } },
    modules: { a2ui: { ...a2uiModule, state: () => ({ surfaces: merged }) } },
  })
}

function mountWith(def: Record<string, any>, surfaces: Record<string, any> = {}) {
  const store = makeStore(surfaces)
  return mount(A2UITextField, { props: { def, surfaceId: 's1', componentId: 'tf1' }, global: { plugins: [store] } })
}

beforeEach(() => { vi.mocked(wsClient.send).mockClear() })

describe('A2UITextField', () => {
  it('renders an input element by default', () => {
    const w = mountWith({ label: 'L', value: 'hello' })
    expect(w.find('input').exists()).toBe(true)
    expect((w.find('input').element as HTMLInputElement).value).toBe('hello')
  })

  it('renders a textarea for longText variant', () => {
    const w = mountWith({ label: 'L', variant: 'longText', value: 'long content' })
    expect(w.find('textarea').exists()).toBe(true)
    expect(w.find('input').exists()).toBe(false)
  })

  it('renders password input for obscured variant', () => {
    const w = mountWith({ label: 'L', variant: 'obscured', value: 'secret' })
    expect(w.find('input').attributes('type')).toBe('password')
  })

  it('renders label when provided', () => {
    const w = mountWith({ label: 'Username', value: '' })
    expect(w.find('.label-text').text()).toBe('Username')
  })

  it('resolves value from data model path', () => {
    const w = mountWith(
      { label: 'Email', value: { path: '/user/email' } },
      { s1: { dataModel: { user: { email: 'x@y.z' } } } },
    )
    expect((w.find('input').element as HTMLInputElement).value).toBe('x@y.z')
  })

  it('shows check messages when condition is false', () => {
    const w = mountWith(
      {
        label: 'L',
        value: '',
        checks: [{ condition: { path: '/flags/bad' }, message: 'Not good' }],
      },
      { s1: { dataModel: { flags: { bad: false } } } },
    )
    expect(w.find('.a2ui-field-checks').text()).toContain('Not good')
  })

  it('shows accessibility description', () => {
    const w = mountWith({
      label: 'L',
      value: '',
      accessibility: { description: 'Use 8+ characters' },
    })
    expect(w.find('.a2ui-field-hint').text()).toBe('Use 8+ characters')
  })

  it('sends textFieldChange on input', async () => {
    const w = mountWith({ label: 'L', value: '' })
    await w.find('input').setValue('typed')
    expect(wsClient.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'a2ui.textFieldChange', componentId: 'tf1', value: 'typed' }),
    )
  })

  it('defaults variant to shortText (text input)', () => {
    const w = mountWith({ label: 'L' })
    expect(w.find('input').attributes('type')).toBe('text')
  })
})
