<template>
  <span class="a2ui-badge" :class="'a2ui-badge--' + variant">{{ displayText }}</span>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import { useDataSource } from '../composables/useDataSource'

const validVariants = ['success', 'warning', 'error', 'info']

export default defineComponent({
  name: 'A2UIBadge',
  props: {
    def: { type: Object, required: true },
    surfaceId: { type: String, required: true },
    componentId: { type: String, required: true },
  },
  setup(props) {
    const { aggregatedValue, mappedProps, binding } = useDataSource(props as any)
    const displayText = computed(() => {
      if (binding.value) {
        if (mappedProps.value.text != null) return mappedProps.value.text
        if (aggregatedValue.value != null) return aggregatedValue.value
      }
      return (props.def as any).text ?? ''
    })
    const variant = computed(() => {
      const v = (props.def as any).variant
      return validVariants.includes(v) ? v : 'info'
    })
    return { displayText, variant }
  },
})
</script>

<style scoped>
.a2ui-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 0.75em; font-weight: 600; }
.a2ui-badge--info { background: #1e3a5f; color: #7ec8e3; }
.a2ui-badge--success { background: #1b4332; color: #74c69d; }
.a2ui-badge--warning { background: #5a3e00; color: #ffd166; }
.a2ui-badge--error { background: #5c1a1a; color: #f28b82; }
</style>
