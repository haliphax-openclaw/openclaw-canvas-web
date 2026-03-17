<template>
  <select v-if="isMulti" multiple :value="selectedMulti" @change="onChangeMulti">
    <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
  </select>
  <select v-else :value="selected" @change="onChange">
    <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
  </select>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import { wsClient } from '../services/ws-client'
import { useFilterBind } from '../composables/useFilterBind'

export default defineComponent({
  name: 'A2UISelect',
  props: {
    def: { type: Object, required: true },
    surfaceId: { type: String, required: true },
    componentId: { type: String, required: true },
  },
  setup(props) {
    const isMulti = computed(() => !!(props.def as any).multi)
    const options = computed(() => (props.def as any).options ?? [])

    // Single-select: string
    const selected = computed(() => {
      const s = (props.def as any).selected
      return typeof s === 'string' ? s : ''
    })

    // Multi-select: string[]
    const selectedMulti = computed(() => {
      const s = (props.def as any).selected
      if (Array.isArray(s)) return s
      if (typeof s === 'string' && s) return [s]
      return []
    })

    const { updateFilter, maybeEmit } = useFilterBind(props as any)

    // Single-select handler (unchanged behavior)
    const onChange = (e: Event) => {
      const value = (e.target as HTMLSelectElement).value
      wsClient.send({ type: 'a2ui.selectChange', componentId: props.componentId, value })
      updateFilter(value)
      maybeEmit(value)
    }

    // Multi-select handler
    const onChangeMulti = (e: Event) => {
      const sel = e.target as HTMLSelectElement
      const values = Array.from(sel.selectedOptions, (o) => o.value)
      wsClient.send({ type: 'a2ui.selectChange', componentId: props.componentId, values })
      updateFilter(values)
      maybeEmit(values)
    }

    return { isMulti, options, selected, selectedMulti, onChange, onChangeMulti }
  },
})
</script>

<style scoped>
select { background: #1a1a2e; color: #e0e0e0; border: 1px solid #444; padding: 4px 8px; border-radius: 4px; }
select[multiple] { min-height: 5em; }
select[multiple] option { padding: 2px 4px; }
</style>
