<template>
  <label class="a2ui-checkbox">
    <input type="checkbox" :checked="checked" @change="onChange" />
    <span>{{ label }}</span>
  </label>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import { wsClient } from '../services/ws-client'

export default defineComponent({
  name: 'A2UICheckbox',
  props: {
    def: { type: Object, required: true },
    componentId: { type: String, required: true },
  },
  setup(props) {
    const label = computed(() => (props.def as any).label ?? '')
    const checked = computed(() => (props.def as any).checked ?? false)
    const onChange = (e: Event) => {
      wsClient.send({ type: 'a2ui.checkboxChange', componentId: props.componentId, checked: (e.target as HTMLInputElement).checked })
    }
    return { label, checked, onChange }
  },
})
</script>

<style scoped>
.a2ui-checkbox { display: inline-flex; align-items: center; gap: 6px; color: #e0e0e0; cursor: pointer; }
</style>
