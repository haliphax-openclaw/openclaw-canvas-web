import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'

/**
 * Tests for A2UINode two-tier component resolution:
 * 1. Built-in components (highest priority)
 * 2. Catalog components from virtual:openclaw-catalogs
 */

// Fake catalog components for testing
const FakeCatalogChart = defineComponent({ name: 'FakeCatalogChart', template: '<div />' })
const FakeCatalogMap = defineComponent({ name: 'FakeCatalogMap', template: '<div />' })
// A catalog component that collides with a built-in name
const FakeCatalogText = defineComponent({ name: 'FakeCatalogText', template: '<div />' })

// Mock the virtual module BEFORE importing A2UINode
vi.mock('virtual:openclaw-catalogs', () => ({
  catalogComponents: {
    Chart: { component: FakeCatalogChart },
    Map: { component: FakeCatalogMap },
    Text: { component: FakeCatalogText }, // collides with built-in Text
  },
}))

// Mock wsClient (required by some component imports)
vi.mock('../src/client/services/ws-client', () => ({
  wsClient: { send: vi.fn() },
}))

// Now import the resolution function
const { resolveA2UIComponent } = await import('../src/client/components/A2UINode.vue')

describe('A2UINode two-tier component resolution', () => {
  describe('built-in components', () => {
    it('resolves known built-in component names', () => {
      const builtinNames = [
        'Column', 'Row', 'Text', 'Button', 'Image', 'Stack', 'Spacer',
        'Select', 'MultiSelect', 'Table', 'Checkbox', 'ProgressBar',
        'Slider', 'Divider', 'Repeat', 'Accordion', 'Tabs',
      ]
      for (const name of builtinNames) {
        const result = resolveA2UIComponent(name)
        expect(result, `expected built-in "${name}" to resolve`).not.toBeNull()
      }
    })
  })

  describe('catalog components', () => {
    it('resolves catalog component when not in built-in map', () => {
      const chart = resolveA2UIComponent('Chart')
      expect(chart).toBe(FakeCatalogChart)
    })

    it('resolves another catalog component', () => {
      const map = resolveA2UIComponent('Map')
      expect(map).toBe(FakeCatalogMap)
    })
  })

  describe('priority: built-in wins over catalog', () => {
    it('returns built-in Text, not catalog Text, when names collide', () => {
      const resolved = resolveA2UIComponent('Text')
      // Should NOT be the fake catalog version
      expect(resolved).not.toBe(FakeCatalogText)
      // Should be a real component (the built-in)
      expect(resolved).not.toBeNull()
    })
  })

  describe('unknown components', () => {
    it('returns null for unknown component name', () => {
      expect(resolveA2UIComponent('NonExistent')).toBeNull()
    })

    it('returns null for null input', () => {
      expect(resolveA2UIComponent(null)).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(resolveA2UIComponent('')).toBeNull()
    })
  })
})
