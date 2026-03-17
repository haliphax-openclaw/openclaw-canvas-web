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

const componentMap: Record<string, ReturnType<typeof defineComponent>> = {
  Column: A2UIColumn,
  Row: A2UIRow,
  Text: A2UIText,
  Button: A2UIButton,
  Image: A2UIImage,
  Stack: A2UIStack,
  Spacer: A2UISpacer,
  Select: A2UISelect,
  Table: A2UITable,
  Checkbox: A2UICheckbox,
  ProgressBar: A2UIProgressBar,
  Slider: A2UISlider,
  Badge: A2UIBadge,
  Divider: A2UIDivider,
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

    // The component definition is { "Column": { children: ... } } — extract the type key and inner def
    const typeName = computed(() => {
      const entry = componentEntry.value
      if (!entry) return null
      return Object.keys(entry)[0] ?? null
    })

    const componentDef = computed(() => {
      const entry = componentEntry.value
      const name = typeName.value
      if (!entry || !name) return null
      return (entry as Record<string, unknown>)[name]
    })

    const resolvedComponent = computed(() => {
      const name = typeName.value
      return name ? componentMap[name] ?? null : null
    })

    return { resolvedComponent, componentDef }
  },
})
</script>
