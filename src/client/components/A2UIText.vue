<template>
  <component :is="tag">{{ text }}</component>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'

const hintMap: Record<string, string> = { h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6', body: 'p', label: 'span' }

export default defineComponent({
  name: 'A2UIText',
  props: { def: { type: Object, required: true } },
  setup(props) {
    const tag = computed(() => hintMap[(props.def as any).usageHint] ?? 'p')
    const text = computed(() => {
      const t = (props.def as any).text
      return t?.literalString ?? t ?? ''
    })
    return { tag, text }
  },
})
</script>
