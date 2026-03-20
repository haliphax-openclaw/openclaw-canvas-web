// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import A2UIDivider from '../packages/a2ui-catalog-basic/src/A2UIDivider.vue'

describe('A2UIDivider', () => {
  it('renders an hr element', () => {
    const w = mount(A2UIDivider)
    expect(w.find('.divider').exists()).toBe(true)
  })
})
