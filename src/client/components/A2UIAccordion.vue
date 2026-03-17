<template>
  <div class="a2ui-accordion">
    <div v-for="(panel, i) in panels" :key="i" class="a2ui-accordion-panel">
      <div class="a2ui-accordion-header" @click="toggle(i)">
        <span class="a2ui-accordion-indicator">{{ isOpen(i) ? '▼' : '▶' }}</span>
        {{ panel.title }}
      </div>
      <div class="a2ui-accordion-content" :class="{ collapsed: !isOpen(i) }">
        <A2UINode :component-id="panel.child" :surface-id="surfaceId" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed } from 'vue'

export default defineComponent({
  name: 'A2UIAccordion',
  props: {
    def: { type: Object, required: true },
    surfaceId: { type: String, required: true },
    componentId: { type: String, required: true },
  },
  setup(props) {
    const panels = computed(() => (props.def as any).panels ?? [])
    const mode = computed(() => (props.def as any).mode ?? 'single')
    const openSet = ref<Set<number>>(new Set((props.def as any).expanded ?? []))

    const isOpen = (i: number) => openSet.value.has(i)

    const toggle = (i: number) => {
      const next = new Set(openSet.value)
      if (next.has(i)) {
        next.delete(i)
      } else {
        if (mode.value === 'single') next.clear()
        next.add(i)
      }
      openSet.value = next
    }

    return { panels, isOpen, toggle }
  },
})
</script>

<style scoped>
.a2ui-accordion { display: flex; flex-direction: column; gap: 2px; width: fit-content; min-width: 200px; }
.a2ui-accordion-panel { border: 1px solid #444; border-radius: 4px; overflow: hidden; }
.a2ui-accordion-header { padding: 8px 12px; cursor: pointer; user-select: none; background: #2a2a2a; color: #e0e0e0; }
.a2ui-accordion-header:hover { background: #3a3a3a; }
.a2ui-accordion-indicator { margin-right: 8px; font-size: 0.75em; }
.a2ui-accordion-content { padding: 8px 12px; background: #1e1e1e; }
.a2ui-accordion-content.collapsed { height: 0; padding-top: 0; padding-bottom: 0; overflow: hidden; }
</style>
