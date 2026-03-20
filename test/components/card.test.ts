// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { a2uiModule } from '../../src/client/store/a2ui'

vi.mock('../../src/client/services/ws-client', () => ({
  wsClient: { send: vi.fn(), on: vi.fn(), off: vi.fn(), connect: vi.fn() },
}))
vi.mock('virtual:openclaw-catalogs', async () => {
  const A2UIText = (await import('../../packages/a2ui-catalog-basic/src/A2UIText.vue')).default
  const A2UIButton = (await import('../../packages/a2ui-catalog-basic/src/A2UIButton.vue')).default
  return {
    catalogComponents: {
      Text: { component: A2UIText },
      Button: { component: A2UIButton },
    },
  }
})
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

import A2UICard from '../../packages/a2ui-catalog-basic/src/A2UICard.vue'
import A2UINode from '../../src/client/components/A2UINode.vue'

function makeStore(surfaces: Record<string, any> = {}) {
  return createStore({
    state: { session: { active: 'main', sessions: ['main'] }, panel: { visible: true } },
    modules: { a2ui: { ...a2uiModule, state: () => ({ surfaces }) } },
  })
}

const baseSurface = { root: null, dataModel: {}, sources: {}, filters: {} }

function mountCard(def: Record<string, any>, components: Record<string, any> = {}) {
  const surfaces = { s1: { ...baseSurface, components } }
  const store = makeStore(surfaces)
  return mount(A2UICard, {
    props: { def, surfaceId: 's1', componentId: 'card1' },
    global: { plugins: [store], components: { A2UINode } },
  })
}

describe('A2UICard', () => {
  it('renders card wrapper', () => {
    const w = mountCard({ child: 't1' }, { t1: { component: 'Text', text: 'Card content' } })
    expect(w.find('.a2ui-card').exists()).toBe(true)
    expect(w.find('.card-body').exists()).toBe(true)
  })

  it('renders child component inside card body', () => {
    const w = mountCard({ child: 't1' }, { t1: { component: 'Text', text: 'Hello Card' } })
    expect(w.text()).toContain('Hello Card')
  })

  it('renders empty card body when no child', () => {
    const w = mountCard({})
    expect(w.find('.card-body').exists()).toBe(true)
    expect(w.find('.card-body').text()).toBe('')
  })

  it('renders card with default shadow-sm class', () => {
    const w = mountCard({})
    expect(w.find('.card').classes()).toContain('shadow-sm')
  })

  it('renders card-title when title prop is provided', () => {
    const w = mountCard({ title: 'My Title' })
    const h2 = w.find('h2.card-title')
    expect(h2.exists()).toBe(true)
    expect(h2.text()).toBe('My Title')
  })

  it('does not render card-title when title is omitted', () => {
    const w = mountCard({})
    expect(w.find('h2.card-title').exists()).toBe(false)
  })

  it('renders figure with image when image prop is provided', () => {
    const w = mountCard({ image: 'https://example.com/img.png', imageAlt: 'Test image' })
    expect(w.find('figure').exists()).toBe(true)
    const img = w.find('figure img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/img.png')
    expect(img.attributes('alt')).toBe('Test image')
  })

  it('does not render figure when image is omitted', () => {
    const w = mountCard({})
    expect(w.find('figure').exists()).toBe(false)
  })

  it('renders actions in card-actions div', () => {
    const w = mountCard(
      { actions: ['b1', 'b2'] },
      {
        b1: { component: 'Button', label: 'OK' },
        b2: { component: 'Button', label: 'Cancel' },
      },
    )
    const actionsDiv = w.find('.card-actions.justify-end')
    expect(actionsDiv.exists()).toBe(true)
    expect(actionsDiv.text()).toContain('OK')
    expect(actionsDiv.text()).toContain('Cancel')
  })

  it('applies variant classes (neutral)', () => {
    const w = mountCard({ variant: 'neutral' })
    const card = w.find('.card')
    expect(card.classes()).toContain('bg-neutral')
    expect(card.classes()).toContain('text-neutral-content')
  })

  it('applies lg:card-side class when side is true', () => {
    const w = mountCard({ side: true })
    expect(w.find('.card').classes()).toContain('lg:card-side')
  })

  it('applies card-xs class when size is true', () => {
    const w = mountCard({ size: "xs" })
    expect(w.find('.card').classes()).toContain('card-xs')
  })

  it('applies correct shadow class', () => {
    const none = mountCard({ shadow: 'none' })
    expect(none.find('.card').classes()).toContain('shadow-none')

    const xl = mountCard({ shadow: 'xl' })
    expect(xl.find('.card').classes()).toContain('shadow-xl')
  })
})
