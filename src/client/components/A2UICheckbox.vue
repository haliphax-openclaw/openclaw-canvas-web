<template>
  <label class="a2ui-checkbox">
    <input type="checkbox" :checked="checked" @change="onChange" />
    <span>{{ label }}</span>
  </label>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import { wsClient } from '../services/ws-client'
import { useFilterBind } from '../composables/useFilterBind'

export default defineComponent({
  name: 'A2UICheckbox',
  props: {
    def: { type: Object, required: true },
    componentId: { type: String, required: true },
    surfaceId: { type: String, default: '' },
  },
  setup(props) {
    const label = computed(() => (props.def as any).label ?? '')
    const checked = computed(() => (props.def as any).checked ?? false)
    const { updateFilter, maybeEmit } = useFilterBind(props as any, { op: 'eq', nullValue: false })
    const onChange = (e: Event) => {
      const val = (e.target as HTMLInputElement).checked
      wsClient.send({ type: 'a2ui.checkboxChange', componentId: props.componentId, checked: val })
      updateFilter(val)
      maybeEmit(val)
    }
    return { label, checked, onChange }
  },
})
</script>

<style scoped>
.a2ui-checkbox { display: inline-flex; align-items: center; gap: 6px; color: var(--a2ui-text); cursor: pointer; }
</style>
