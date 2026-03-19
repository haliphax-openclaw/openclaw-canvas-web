<template>
  <component v-if="resolvedComponent" :is="resolvedComponent" :def="componentDef" :component-id="componentId" :surface-id="surfaceId" />
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import { useStore } from 'vuex'
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
import A2UIBadge from './A2UIBadge.vue'
import A2UIDivider from './A2UIDivider.vue'
import A2UIRepeat from './A2UIRepeat.vue'
import A2UIAccordion from './A2UIAccordion.vue'
import A2UITabs from './A2UITabs.vue'

const componentMap: Record<string, ReturnType<typeof defineComponent>> = {
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
  Badge: A2UIBadge,
  Divider: A2UIDivider,
  Repeat: A2UIRepeat,
  Accordion: A2UIAccordion,
  Tabs: A2UITabs,
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

    const resolvedComponent = computed(() => {
      const name = typeName.value
      return name ? componentMap[name] ?? null : null
    })

    return { resolvedComponent, componentDef }
  },
})
</script>
