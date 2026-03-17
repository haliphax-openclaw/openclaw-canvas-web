<template>
  <div class="a2ui-slider">
    <span v-if="label" class="a2ui-slider-label">{{ label }}</span>
    <input type="range" :min="min" :max="max" :value="value" @input="onInput" />
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import { wsClient } from '../services/ws-client'

export default defineComponent({
  name: 'A2UISlider',
  props: {
    def: { type: Object, required: true },
    componentId: { type: String, required: true },
  },
  setup(props) {
    const min = computed(() => (props.def as any).min ?? 0)
    const max = computed(() => (props.def as any).max ?? 100)
    const value = computed(() => (props.def as any).value ?? 0)
    const label = computed(() => (props.def as any).label ?? '')
    const onInput = (e: Event) => {
      wsClient.send({ type: 'a2ui.sliderChange', componentId: props.componentId, value: Number((e.target as HTMLInputElement).value) })
    }
    return { min, max, value, label, onInput }
  },
})
</script>

<style scoped>
.a2ui-slider { color: #e0e0e0; }
.a2ui-slider-label { display: block; margin-bottom: 4px; font-size: 0.85em; }
input[type="range"] { width: 100%; accent-color: #4a6cf7; }
</style>
