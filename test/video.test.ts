// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

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

import A2UIVideo from '../packages/a2ui-catalog-basic/src/A2UIVideo.vue'

describe('A2UIVideo', () => {
  it('renders video element with src', () => {
    const w = mount(A2UIVideo, {
      props: { def: { url: 'https://example.com/video.mp4' }, componentId: 'v1' },
    })
    const video = w.find('video')
    expect(video.exists()).toBe(true)
    expect(video.attributes('src')).toBe('https://example.com/video.mp4')
  })

  it('passes autoplay and loop attributes', () => {
    const w = mount(A2UIVideo, {
      props: { def: { url: 'https://example.com/v.mp4', autoplay: true, loop: true }, componentId: 'v1' },
    })
    const video = w.find('video')
    expect(video.attributes('autoplay')).toBeDefined()
    expect(video.attributes('loop')).toBeDefined()
  })

  it('renders poster when provided', () => {
    const w = mount(A2UIVideo, {
      props: { def: { url: 'https://example.com/v.mp4', poster: 'https://example.com/thumb.jpg' }, componentId: 'v1' },
    })
    expect(w.find('video').attributes('poster')).toBe('https://example.com/thumb.jpg')
  })

  it('rewrites openclaw-canvas:// URLs for src and poster', () => {
    const w = mount(A2UIVideo, {
      props: { def: { url: 'openclaw-canvas://proj/clip.mp4', poster: 'openclaw-canvas://proj/thumb.jpg' }, componentId: 'v1' },
    })
    expect(w.find('video').attributes('src')).toBe('http://localhost:3456/_c/proj/clip.mp4')
    expect(w.find('video').attributes('poster')).toBe('http://localhost:3456/_c/proj/thumb.jpg')
  })

  it('defaults controls to true', () => {
    const w = mount(A2UIVideo, {
      props: { def: { url: 'https://example.com/v.mp4' }, componentId: 'v1' },
    })
    expect(w.find('video').attributes('controls')).toBeDefined()
  })
})
