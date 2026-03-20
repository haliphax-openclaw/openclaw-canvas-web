<template>
  <component :is="'div'" class="a2ui-list" :class="`a2ui-list--${direction}`">
    <div v-for="childId in children" :key="childId" class="a2ui-list-item">
      <A2UINode :component-id="childId" :surface-id="surfaceId" />
    </div>
  </component>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'

export default defineComponent({
  name: 'A2UIList',
  props: {
    def: { type: Object, required: true },
    surfaceId: { type: String, required: true },
    componentId: { type: String, required: true },
  },
  setup(props) {
    const children = computed(() => {
      const c = (props.def as any).children
      return c?.explicitList ?? c ?? []
    })
    const direction = computed(() => (props.def as any).direction ?? 'vertical')
    const align = computed(() => (props.def as any).align ?? 'stretch')
    return { children, direction, align }
  },
})
</script>

<style scoped>
.a2ui-list { display: flex; flex-direction: column; gap: 8px; }
.a2ui-list--horizontal { flex-direction: row; }
.a2ui-list--vertical { flex-direction: column; }
.a2ui-list-item { display: flex; }
</style>
