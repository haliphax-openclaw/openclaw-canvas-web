<template>
  <div class="a2ui-renderer" v-if="root">
    <A2UINode :component-id="root" :surface-id="surfaceId" />
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import { useStore } from 'vuex'
import A2UINode from './A2UINode.vue'

export default defineComponent({
  name: 'A2UIRenderer',
  components: { A2UINode },
  props: {
    surfaceId: { type: String, required: true },
  },
  setup(props) {
    const store = useStore()
    const root = computed(() => store.state.a2ui?.surfaces?.[props.surfaceId]?.root ?? null)
    return { root }
  },
})
</script>

<style scoped>
.a2ui-renderer { width: 100%; min-height: 100%; height: auto; padding: 12px; box-sizing: border-box; }
</style>
