<template>
  <component :is="tag">{{ displayText }}</component>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import { useDataSource } from '../composables/useDataSource'

const hintMap: Record<string, string> = { h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6', body: 'p', label: 'span' }

export default defineComponent({
  name: 'A2UIText',
  props: {
    def: { type: Object, required: true },
    surfaceId: { type: String, required: true },
    componentId: { type: String, required: true },
  },
  setup(props) {
    const { aggregatedValue, mappedProps, binding } = useDataSource(props as any)
    const tag = computed(() => hintMap[(props.def as any).usageHint] ?? 'p')
    const displayText = computed(() => {
      if (binding.value) {
        if (mappedProps.value.text != null) return mappedProps.value.text
        if (aggregatedValue.value != null) return aggregatedValue.value
      }
      const t = (props.def as any).text
      return t?.literalString ?? t ?? ''
    })
    return { tag, displayText }
  },
})
</script>
