<template>
  <div class="a2ui-progress">
    <span v-if="label" class="a2ui-progress-label">{{ label }}</span>
    <div class="a2ui-progress-track">
      <div class="a2ui-progress-fill" :style="{ width: clampedValue + '%' }" />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'

export default defineComponent({
  name: 'A2UIProgressBar',
  props: {
    def: { type: Object, required: true },
    surfaceId: { type: String, required: true },
    componentId: { type: String, required: true },
  },
  setup(props) {
    const clampedValue = computed(() => Math.min(100, Math.max(0, Number((props.def as any).value) || 0)))
    const label = computed(() => (props.def as any).label ?? '')
    return { clampedValue, label }
  },
})
</script>

<style scoped>
.a2ui-progress { color: #e0e0e0; }
.a2ui-progress-label { display: block; margin-bottom: 4px; font-size: 0.85em; }
.a2ui-progress-track { background: #333; border-radius: 4px; height: 12px; overflow: hidden; }
.a2ui-progress-fill { background: #4a6cf7; height: 100%; transition: width 0.3s; }
</style>
