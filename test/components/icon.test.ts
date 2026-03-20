// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import A2UIIcon from '../../packages/a2ui-catalog-basic/src/A2UIIcon.vue'

describe('A2UIIcon', () => {
  it('renders SVG with correct path from icon map', () => {
    const w = mount(A2UIIcon, { props: { icon: 'home' } })
    const svg = w.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.find('path').attributes('d')).toBeTruthy()
  })

  it('renders nothing for unknown icon name', () => {
    const w = mount(A2UIIcon, { props: { icon: 'nonexistent-icon-xyz' } })
    expect(w.find('svg').exists()).toBe(false)
  })

  it('supports custom path object', () => {
    const w = mount(A2UIIcon, { props: { icon: { path: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z' } } })
    expect(w.find('path').attributes('d')).toBe('M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z')
  })

  it('respects size prop', () => {
    const w = mount(A2UIIcon, { props: { icon: 'home', size: 48 } })
    expect(w.find('svg').attributes('width')).toBe('48')
    expect(w.find('svg').attributes('height')).toBe('48')
  })

  it('respects color prop', () => {
    const w = mount(A2UIIcon, { props: { icon: 'home', color: 'red' } })
    expect(w.find('path').attributes('fill')).toBe('red')
  })

  it('defaults to size 24 and currentColor', () => {
    const w = mount(A2UIIcon, { props: { icon: 'home' } })
    expect(w.find('svg').attributes('width')).toBe('24')
    expect(w.find('path').attributes('fill')).toBe('currentColor')
  })
})
