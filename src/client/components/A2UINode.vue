<template>
  <component v-if="resolvedComponent" :is="resolvedComponent" :def="componentDef" :component-id="componentId" :surface-id="surfaceId" />
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import type { Component } from 'vue'
import { useStore } from 'vuex'
import { catalogComponents } from 'virtual:openclaw-catalogs'
import A2UIColumn from './A2UIColumn.vue'
import A2UIRow from './A2UIRow.vue'
import A2UIText from './A2UIText.vue'
import A2UIButton from './A2UIButton.vue'
import A2UIImage from './A2UIImage.vue'
import A2UIStack from './A2UIStack.vue'
import A2UISpacer from './A2UISpacer.vue'
import A2UISelect from './A2UISelect.vue'
import A2UITable from './A2UITable.vue'
import A2UICheckbox from './A2UICheckbox.vue'
import A2UIProgressBar from './A2UIProgressBar.vue'
import A2UISlider from './A2UISlider.vue'
import A2UIDivider from './A2UIDivider.vue'
import A2UIRepeat from './A2UIRepeat.vue'
import A2UIAccordion from './A2UIAccordion.vue'
import A2UITabs from './A2UITabs.vue'

/** Built-in component map — highest priority in resolution */
const builtinMap: Record<string, Component> = {
  Column: A2UIColumn,
  Row: A2UIRow,
  Text: A2UIText,
  Button: A2UIButton,
  Image: A2UIImage,
  Stack: A2UIStack,
  Spacer: A2UISpacer,
  Select: A2UISelect,
  MultiSelect: A2UISelect,
  Table: A2UITable,
  Checkbox: A2UICheckbox,
  ProgressBar: A2UIProgressBar,
  Slider: A2UISlider,
  Divider: A2UIDivider,
  Repeat: A2UIRepeat,
  Accordion: A2UIAccordion,
  Tabs: A2UITabs,
}

/**
 * Resolve a component by name using two-tier lookup:
 * 1. Built-in map (always wins)
 * 2. Catalog components from virtual:openclaw-catalogs
 *
 * Exported for testability.
 */
export function resolveA2UIComponent(name: string | null): Component | null {
  if (!name) return null

  // Built-in always wins
  if (builtinMap[name]) return builtinMap[name]

  // Catalog fallback
  // TODO: catalogId filtering — restrict catalog components by surface catalogId
  const catalogEntry = catalogComponents[name]
  if (catalogEntry) return catalogEntry.component

  return null
}

export default defineComponent({
  name: 'A2UINode',
  props: {
    componentId: { type: String, required: true },
    surfaceId: { type: String, required: true },
  },
  setup(props) {
    const store = useStore()

    const componentEntry = computed(() => {
      const surface = store.state.a2ui?.surfaces?.[props.surfaceId]
      return surface?.components?.[props.componentId] ?? null
    })

    // v0.9 flat shape: { component: "Column", children: [...] }
    const typeName = computed(() => {
      const entry = componentEntry.value
      if (!entry) return null
      return (entry.component as string) ?? null
    })

    const componentDef = computed(() => {
      const entry = componentEntry.value
      if (!entry || !typeName.value) return null
      const { component, ...props } = entry as Record<string, unknown>
      // MultiSelect alias implies multi: true
      if (component === 'MultiSelect') return { ...props, multi: true }
      return props
    })

    const resolvedComponent = computed(() => resolveA2UIComponent(typeName.value))

    return { resolvedComponent, componentDef }
  },
})
</script>
