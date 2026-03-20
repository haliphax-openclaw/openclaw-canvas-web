// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.stubGlobal('location', { origin: 'http://localhost:3456', protocol: 'http:', host: 'localhost:3456' })

import A2UIImage from '../packages/a2ui-catalog-basic/src/A2UIImage.vue'

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
