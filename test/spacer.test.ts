// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import A2UISpacer from '../packages/a2ui-catalog-extended/src/A2UISpacer.vue'

describe('A2UISpacer', () => {
  it('renders a div', () => {
    const w = mount(A2UISpacer)
    expect(w.find('div').exists()).toBe(true)
  })
})
