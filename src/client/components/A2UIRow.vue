<template>
  <div class="a2ui-row">
    <A2UINode v-for="childId in children" :key="childId" :component-id="childId" :surface-id="surfaceId" />
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'

export default defineComponent({
  name: 'A2UIRow',
  props: {
    def: { type: Object, required: true },
    surfaceId: { type: String, required: true },
  },
  setup(props) {
    const children = computed(() => {
      const c = (props.def as any).children
      return c?.explicitList ?? c ?? []
    })
    return { children }
  },
})
</script>

<style scoped>
.a2ui-row { display: flex; flex-direction: row; gap: 8px; }
</style>
