// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import A2UIBadge from '../../packages/a2ui-catalog-extended/src/A2UIBadge.vue'
import { mountWith } from '../__helpers__/mount'

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

describe('A2UIBadge', () => {
  it('renders text with variant class', () => {
    const w = mountWith(A2UIBadge, { def: { text: 'OK', variant: 'success' }, surfaceId: 's1', componentId: 'c1' })
    expect(w.find('span').text()).toBe('OK')
    expect(w.find('span').classes()).toContain('badge-success')
  })

  it('defaults to info variant', () => {
    const w = mountWith(A2UIBadge, { def: { text: 'X', variant: 'bogus' }, surfaceId: 's1', componentId: 'c1' })
    expect(w.find('span').classes()).toContain('badge-info')
  })
})
