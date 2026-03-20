import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'

/**
 * Tests for A2UINode component resolution:
 * All components now resolve through the catalog system (builtinMap is empty).
 */

// Fake catalog components for testing
const FakeCatalogChart = defineComponent({ name: 'FakeCatalogChart', template: '<div />' })
const FakeCatalogMap = defineComponent({ name: 'FakeCatalogMap', template: '<div />' })
const FakeCatalogText = defineComponent({ name: 'FakeCatalogText', template: '<div />' })
const FakeCatalogColumn = defineComponent({ name: 'FakeCatalogColumn', template: '<div />' })
const FakeCatalogButton = defineComponent({ name: 'FakeCatalogButton', template: '<div />' })

// Mock the virtual module BEFORE importing A2UINode
vi.mock('virtual:openclaw-catalogs', () => ({
  catalogComponents: {
    Chart: { component: FakeCatalogChart },
    Map: { component: FakeCatalogMap },
    Text: { component: FakeCatalogText },
    Column: { component: FakeCatalogColumn },
    Button: { component: FakeCatalogButton },
  },
}))

// Mock wsClient (required by some component imports)
vi.mock('../src/client/services/ws-client', () => ({
  wsClient: { send: vi.fn() },
}))

// Now import the resolution function
const { resolveA2UIComponent } = await import('../src/client/components/A2UINode.vue')

describe('A2UINode catalog component resolution', () => {
  describe('catalog components', () => {
    it('resolves catalog component by name', () => {
      const chart = resolveA2UIComponent('Chart')
      expect(chart).toBe(FakeCatalogChart)
    })

    it('resolves another catalog component', () => {
      const map = resolveA2UIComponent('Map')
      expect(map).toBe(FakeCatalogMap)
    })

    it('resolves Text from catalog', () => {
      const text = resolveA2UIComponent('Text')
      expect(text).toBe(FakeCatalogText)
    })

    it('resolves Column from catalog', () => {
      const col = resolveA2UIComponent('Column')
      expect(col).toBe(FakeCatalogColumn)
    })

    it('resolves Button from catalog', () => {
      const btn = resolveA2UIComponent('Button')
      expect(btn).toBe(FakeCatalogButton)
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
