// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'

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

import DeepLinkConfirm from '../../src/client/components/DeepLinkConfirm.vue'
import { mountWith } from '../__helpers__/mount'

describe('DeepLinkConfirm', () => {
  it('is hidden by default', () => {
    const w = mountWith(DeepLinkConfirm, {})
    expect(document.querySelector('.confirm-overlay')).toBeNull()
    w.unmount()
  })

  it('shows dialog when show() is called and cancel resolves false', async () => {
    const w = mountWith(DeepLinkConfirm, {})
    const vm = w.vm as any
    const promise = vm.show({ message: 'Run task' })
    await w.vm.$nextTick()
    const overlay = document.querySelector('.confirm-overlay')!
    expect(overlay).toBeTruthy()
    expect(overlay.querySelector('.confirm-message')!.textContent).toBe('Run task')
    // Cancel
    ;(overlay.querySelector('.btn-cancel') as HTMLElement).click()
    await w.vm.$nextTick()
    expect(await promise).toBe(false)
    w.unmount()
  })

  it('confirm resolves true', async () => {
    const w = mountWith(DeepLinkConfirm, {})
    const vm = w.vm as any
    const promise = vm.show({ message: 'Go' })
    await w.vm.$nextTick()
    ;(document.querySelector('.btn-confirm') as HTMLElement).click()
    await w.vm.$nextTick()
    expect(await promise).toBe(true)
    w.unmount()
  })

  it('toggles advanced options', async () => {
    const w = mountWith(DeepLinkConfirm, {})
    const vm = w.vm as any
    vm.show({ message: 'test' })
    await w.vm.$nextTick()
    expect(document.querySelector('.advanced-controls')).toBeNull()
    ;(document.querySelector('.advanced-toggle') as HTMLElement).click()
    await w.vm.$nextTick()
    expect(document.querySelector('.advanced-controls')).toBeTruthy()
    ;(document.querySelector('.btn-cancel') as HTMLElement).click()
    await w.vm.$nextTick()
    w.unmount()
  })
})
