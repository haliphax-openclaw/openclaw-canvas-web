<template>
  <select :value="selected" @change="onChange">
    <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
  </select>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import { wsClient } from '../services/ws-client'

export default defineComponent({
  name: 'A2UISelect',
  props: {
    def: { type: Object, required: true },
    surfaceId: { type: String, required: true },
    componentId: { type: String, required: true },
  },
  setup(props) {
    const options = computed(() => (props.def as any).options ?? [])
    const selected = computed(() => (props.def as any).selected ?? '')
    const onChange = (e: Event) => {
      wsClient.send({ type: 'a2ui.selectChange', componentId: props.componentId, value: (e.target as HTMLSelectElement).value })
    }
    return { options, selected, onChange }
  },
})
</script>

<style scoped>
select { background: #1a1a2e; color: #e0e0e0; border: 1px solid #444; padding: 4px 8px; border-radius: 4px; }
</style>
