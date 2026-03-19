<template>
  <div class="join join-vertical w-fit min-w-[200px]">
    <div v-for="(panel, i) in panels" :key="i" class="collapse collapse-arrow join-item border border-base-300 bg-base-200">
      <input type="checkbox" :checked="isOpen(i)" @change="toggle(i)" />
      <div class="collapse-title font-medium">{{ panel.title }}</div>
      <div class="collapse-content">
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
</style>
