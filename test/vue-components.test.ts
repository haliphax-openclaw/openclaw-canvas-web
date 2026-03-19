// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { a2uiModule } from '../src/client/store/a2ui'

// Mock wsClient before importing components
vi.mock('../src/client/services/ws-client', () => ({
  wsClient: { send: vi.fn(), on: vi.fn(), off: vi.fn(), connect: vi.fn() },
}))

// Mock deep-link for DeepLinkConfirm and composables
vi.mock('../src/client/services/deep-link', () => ({
  parseOpenclawUrl: vi.fn(),
  executeDeepLink: vi.fn().mockResolvedValue({ ok: true }),
  fetchCanvasConfig: vi.fn().mockResolvedValue({ skipConfirmation: false, agents: ['main', 'dev'], allowedAgentIds: [] }),
  truncateMessage: (msg: string) => msg.length > 200 ? msg.slice(0, 200) + '…' : msg,
  isOpenclawDeepLink: (url: string) => url.startsWith('openclaw://'),
}))

// Stub location for url-rewriter
vi.stubGlobal('location', { origin: 'http://localhost:3456', protocol: 'http:', host: 'localhost:3456' })

import { wsClient } from '../src/client/services/ws-client'
import A2UIDivider from '../src/client/components/A2UIDivider.vue'
import A2UISpacer from '../src/client/components/A2UISpacer.vue'
import A2UIText from '../src/client/components/A2UIText.vue'
import A2UIButton from '../src/client/components/A2UIButton.vue'
import A2UIImage from '../src/client/components/A2UIImage.vue'
import A2UIBadge from '../src/client/components/A2UIBadge.vue'
import A2UICheckbox from '../src/client/components/A2UICheckbox.vue'
import A2UISlider from '../src/client/components/A2UISlider.vue'
import A2UISelect from '../src/client/components/A2UISelect.vue'
import A2UIProgressBar from '../src/client/components/A2UIProgressBar.vue'
import A2UITable from '../src/client/components/A2UITable.vue'
import A2UIColumn from '../src/client/components/A2UIColumn.vue'
import A2UIRow from '../src/client/components/A2UIRow.vue'
import A2UIStack from '../src/client/components/A2UIStack.vue'
import A2UINode from '../src/client/components/A2UINode.vue'
import A2UIRenderer from '../src/client/components/A2UIRenderer.vue'
import A2UIRepeat from '../src/client/components/A2UIRepeat.vue'
import DeepLinkConfirm from '../src/client/components/DeepLinkConfirm.vue'

function makeStore(surfaces: Record<string, any> = {}) {
  return createStore({
    state: { session: { active: 'main', sessions: ['main'] }, panel: { visible: true } },
    modules: { a2ui: { ...a2uiModule, state: () => ({ surfaces }) } },
  })
}

function mountWith(component: any, props: Record<string, any>, surfaces: Record<string, any> = {}) {
  const store = makeStore(surfaces)
  return mount(component, { props, global: { plugins: [store] } })
}

beforeEach(() => { vi.mocked(wsClient.send).mockClear() })

describe('A2UIDivider', () => {
  it('renders an hr element', () => {
    const w = mount(A2UIDivider)
    expect(w.find('hr').exists()).toBe(true)
  })
})

describe('A2UISpacer', () => {
  it('renders a div', () => {
    const w = mount(A2UISpacer)
    expect(w.find('div').exists()).toBe(true)
  })
})

describe('A2UIText', () => {
  it('renders text in a p tag by default', () => {
    const w = mountWith(A2UIText, { def: { text: 'Hello' }, surfaceId: 's1', componentId: 'c1' })
    expect(w.find('p').text()).toBe('Hello')
  })

  it('renders literalString form', () => {
    const w = mountWith(A2UIText, { def: { text: { literalString: 'Lit' } }, surfaceId: 's1', componentId: 'c1' })
    expect(w.find('p').text()).toBe('Lit')
  })

  it('uses variant to pick tag', () => {
    const w = mountWith(A2UIText, { def: { text: 'Title', variant: 'h1' }, surfaceId: 's1', componentId: 'c1' })
    expect(w.find('h1').text()).toBe('Title')
  })

  it('maps label hint to span', () => {
    const w = mountWith(A2UIText, { def: { text: 'lbl', variant: 'label' }, surfaceId: 's1', componentId: 'c1' })
    expect(w.find('span').text()).toBe('lbl')
  })
})

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

describe('A2UIImage', () => {
  it('renders img with src and alt', () => {
    const w = mount(A2UIImage, { props: { def: { src: 'https://example.com/img.png', alt: 'logo' } } })
    const img = w.find('img')
    expect(img.attributes('src')).toBe('https://example.com/img.png')
    expect(img.attributes('alt')).toBe('logo')
  })

  it('rewrites openclaw-canvas:// URLs', () => {
    const w = mount(A2UIImage, { props: { def: { src: 'openclaw-canvas://proj/logo.png' } } })
    expect(w.find('img').attributes('src')).toBe('http://localhost:3456/_c/proj/logo.png')
  })
})

describe('A2UIBadge', () => {
  it('renders text with variant class', () => {
    const w = mountWith(A2UIBadge, { def: { text: 'OK', variant: 'success' }, surfaceId: 's1', componentId: 'c1' })
    expect(w.find('span').text()).toBe('OK')
    expect(w.find('span').classes()).toContain('a2ui-badge--success')
  })

  it('defaults to info variant', () => {
    const w = mountWith(A2UIBadge, { def: { text: 'X', variant: 'bogus' }, surfaceId: 's1', componentId: 'c1' })
    expect(w.find('span').classes()).toContain('a2ui-badge--info')
  })
})

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

describe('A2UISelect', () => {
  const opts = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }]

  it('renders options', () => {
    const w = mountWith(A2UISelect, { def: { options: opts, selected: 'a' }, surfaceId: 's1', componentId: 'sel1' })
    expect(w.findAll('option')).toHaveLength(2)
  })

  it('sends selectChange on change', async () => {
    const w = mountWith(A2UISelect, { def: { options: opts, selected: 'a' }, surfaceId: 's1', componentId: 'sel1' })
    await w.find('select').setValue('b')
    expect(wsClient.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'a2ui.selectChange', componentId: 'sel1', value: 'b' }))
  })

  it('renders multi-select when multi is true', () => {
    const w = mountWith(A2UISelect, { def: { options: opts, multi: true, selected: ['a'] }, surfaceId: 's1', componentId: 'sel2' })
    expect(w.find('select').attributes('multiple')).toBeDefined()
  })
})

describe('A2UIProgressBar', () => {
  it('renders with clamped width', () => {
    const w = mountWith(A2UIProgressBar, { def: { value: 75, label: 'Loading' }, surfaceId: 's1', componentId: 'pb1' })
    expect(w.find('.a2ui-progress-fill').attributes('style')).toContain('--progress: 75%')
    expect(w.find('.a2ui-progress-label').text()).toBe('Loading')
  })

  it('clamps value to 0-100', () => {
    const w = mountWith(A2UIProgressBar, { def: { value: 150 }, surfaceId: 's1', componentId: 'pb1' })
    expect(w.find('.a2ui-progress-fill').attributes('style')).toContain('--progress: 100%')
  })
})

describe('A2UITable', () => {
  it('renders headers and rows', () => {
    const w = mountWith(A2UITable, {
      def: { headers: ['Name', 'Age'], rows: [['Alice', '30'], ['Bob', '25']] },
      surfaceId: 's1', componentId: 't1',
    })
    expect(w.findAll('th')).toHaveLength(2)
    expect(w.findAll('tbody tr')).toHaveLength(2)
    expect(w.findAll('td')[0].text()).toBe('Alice')
  })

  it('renders empty table when no data', () => {
    const w = mountWith(A2UITable, { def: {}, surfaceId: 's1', componentId: 't1' })
    expect(w.findAll('th')).toHaveLength(0)
    expect(w.findAll('tbody tr')).toHaveLength(0)
  })
})

describe('A2UIColumn / A2UIRow / A2UIStack (layout)', () => {
  const surfaces = {
    s1: {
      components: {
        t1: { component: 'Text', text: 'A' },
        t2: { component: 'Text', text: 'B' },
      },
      root: null, dataModel: {}, sources: {}, filters: {},
    },
  }

  function mountLayout(component: any, props: Record<string, any>) {
    const store = makeStore(surfaces)
    return mount(component, {
      props,
      global: { plugins: [store], components: { A2UINode } },
    })
  }

  it('A2UIColumn renders children', () => {
    const w = mountLayout(A2UIColumn, { def: { children: ['t1', 't2'] }, surfaceId: 's1' })
    expect(w.find('.a2ui-column').exists()).toBe(true)
    expect(w.findAll('p')).toHaveLength(2)
  })

  it('A2UIColumn supports explicitList form', () => {
    const w = mountLayout(A2UIColumn, { def: { children: { explicitList: ['t1'] } }, surfaceId: 's1' })
    expect(w.findAll('p')).toHaveLength(1)
  })

  it('A2UIRow renders children', () => {
    const w = mountLayout(A2UIRow, { def: { children: ['t1'] }, surfaceId: 's1' })
    expect(w.find('.a2ui-row').exists()).toBe(true)
    expect(w.findAll('p')).toHaveLength(1)
  })

  it('A2UIStack renders children', () => {
    const w = mountLayout(A2UIStack, { def: { children: ['t1'] }, surfaceId: 's1' })
    expect(w.find('.a2ui-stack').exists()).toBe(true)
    expect(w.findAll('p')).toHaveLength(1)
  })
})

describe('A2UINode', () => {
  it('resolves Text component from store', () => {
    const surfaces = {
      s1: {
        components: { c1: { component: 'Text', text: 'Hello' } },
        root: 'c1', dataModel: {}, sources: {}, filters: {},
      },
    }
    const w = mountWith(A2UINode, { componentId: 'c1', surfaceId: 's1' }, surfaces)
    expect(w.findComponent(A2UIText).exists()).toBe(true)
    expect(w.text()).toBe('Hello')
  })

  it('resolves Button component', () => {
    const surfaces = {
      s1: {
        components: { b1: { component: 'Button', label: 'Go' } },
        root: 'b1', dataModel: {}, sources: {}, filters: {},
      },
    }
    const w = mountWith(A2UINode, { componentId: 'b1', surfaceId: 's1' }, surfaces)
    expect(w.findComponent(A2UIButton).exists()).toBe(true)
    expect(w.find('button').text()).toBe('Go')
  })

  it('renders nothing for unknown component type', () => {
    const surfaces = {
      s1: {
        components: { x1: { component: 'UnknownWidget' } },
        root: 'x1', dataModel: {}, sources: {}, filters: {},
      },
    }
    const w = mountWith(A2UINode, { componentId: 'x1', surfaceId: 's1' }, surfaces)
    expect(w.html()).toBe('<!--v-if-->')
  })

  it('renders nothing for missing componentId', () => {
    const surfaces = {
      s1: { components: {}, root: null, dataModel: {}, sources: {}, filters: {} },
    }
    const w = mountWith(A2UINode, { componentId: 'missing', surfaceId: 's1' }, surfaces)
    expect(w.html()).toBe('<!--v-if-->')
  })

  it('resolves MultiSelect as Select with multi: true', () => {
    const surfaces = {
      s1: {
        components: { ms1: { component: 'MultiSelect', options: [{ value: 'a', label: 'A' }], selected: ['a'] } },
        root: 'ms1', dataModel: {}, sources: {}, filters: {},
      },
    }
    const w = mountWith(A2UINode, { componentId: 'ms1', surfaceId: 's1' }, surfaces)
    expect(w.findComponent(A2UISelect).exists()).toBe(true)
    expect(w.find('select').attributes('multiple')).toBeDefined()
  })
})

describe('A2UIRenderer', () => {
  it('renders root component from store', () => {
    const surfaces = {
      s1: {
        components: { root: { component: 'Text', text: 'Root' } },
        root: 'root', dataModel: {}, sources: {}, filters: {},
      },
    }
    const w = mountWith(A2UIRenderer, { surfaceId: 's1' }, surfaces)
    expect(w.find('.a2ui-renderer').exists()).toBe(true)
    expect(w.text()).toBe('Root')
  })

  it('renders nothing when no root', () => {
    const surfaces = {
      s1: { components: {}, root: null, dataModel: {}, sources: {}, filters: {} },
    }
    const w = mountWith(A2UIRenderer, { surfaceId: 's1' }, surfaces)
    expect(w.find('.a2ui-renderer').exists()).toBe(false)
  })
})

describe('A2UIRepeat', () => {
  it('renders template for each row from dataSource', () => {
    const surfaces = {
      s1: {
        components: {},
        root: null,
        dataModel: {},
        sources: { items: { fields: ['name'], rows: [{ name: 'Alice' }, { name: 'Bob' }] } },
        filters: {},
      },
    }
    const def = {
      dataSource: { source: 'items' },
      template: { Text: { text: '{{name}}' } },
    }
    const w = mountWith(A2UIRepeat, { def, surfaceId: 's1', componentId: 'r1' }, surfaces)
    const texts = w.findAllComponents(A2UIText)
    expect(texts).toHaveLength(2)
    expect(texts[0].text()).toBe('Alice')
    expect(texts[1].text()).toBe('Bob')
  })

  it('shows emptyText when no rows', () => {
    const surfaces = {
      s1: {
        components: {}, root: null, dataModel: {},
        sources: { items: { fields: [], rows: [] } },
        filters: {},
      },
    }
    const def = {
      dataSource: { source: 'items' },
      template: { Text: { text: '{{name}}' } },
      emptyText: 'No data',
    }
    const w = mountWith(A2UIRepeat, { def, surfaceId: 's1', componentId: 'r1' }, surfaces)
    expect(w.text()).toBe('No data')
  })
})

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
