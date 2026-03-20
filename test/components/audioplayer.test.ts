// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

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

import A2UIAudioPlayer from '../../packages/a2ui-catalog-basic/src/A2UIAudioPlayer.vue'

describe('A2UIAudioPlayer', () => {
  it('renders audio element with src', () => {
    const w = mount(A2UIAudioPlayer, {
      props: { def: { url: 'https://example.com/audio.mp3' }, componentId: 'ap1' },
    })
    const audio = w.find('audio')
    expect(audio.exists()).toBe(true)
    expect(audio.attributes('src')).toBe('https://example.com/audio.mp3')
  })

  it('renders description when provided', () => {
    const w = mount(A2UIAudioPlayer, {
      props: { def: { url: 'https://example.com/a.mp3', description: 'My Track' }, componentId: 'ap1' },
    })
    expect(w.find('.a2ui-audio-description').text()).toBe('My Track')
  })

  it('does not render description when absent', () => {
    const w = mount(A2UIAudioPlayer, {
      props: { def: { url: 'https://example.com/a.mp3' }, componentId: 'ap1' },
    })
    expect(w.find('.a2ui-audio-description').exists()).toBe(false)
  })

  it('passes autoplay and loop attributes', () => {
    const w = mount(A2UIAudioPlayer, {
      props: { def: { url: 'https://example.com/a.mp3', autoplay: true, loop: true }, componentId: 'ap1' },
    })
    const audio = w.find('audio')
    expect(audio.attributes('autoplay')).toBeDefined()
    expect(audio.attributes('loop')).toBeDefined()
  })

  it('rewrites openclaw-canvas:// URLs', () => {
    const w = mount(A2UIAudioPlayer, {
      props: { def: { url: 'openclaw-canvas://proj/track.mp3' }, componentId: 'ap1' },
    })
    expect(w.find('audio').attributes('src')).toBe('http://localhost:3456/_c/proj/track.mp3')
  })
})
