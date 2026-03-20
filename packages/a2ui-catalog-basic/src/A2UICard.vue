<template>
  <div class="card a2ui-card">
    <div class="card-body">
      <A2UINode v-if="child" :component-id="child" :surface-id="surfaceId" />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'

export default defineComponent({
  name: 'A2UICard',
  props: {
    def: { type: Object, required: true },
    surfaceId: { type: String, required: true },
    componentId: { type: String, required: true },
  },
  setup(props) {
    const child = computed(() => (props.def as any).child ?? null)
    return { child }
  },
})
</script>

<style scoped>
.a2ui-card { background-color: var(--a2ui-surface, oklch(var(--b2))); color: var(--a2ui-text, inherit); }
</style>
