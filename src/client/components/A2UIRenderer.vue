<template>
  <div class="a2ui-renderer" v-if="root" :style="themeStyle">
    <div v-if="attribution" class="a2ui-attribution">
      <img v-if="attribution.iconUrl" :src="attribution.iconUrl" class="a2ui-attribution-icon" />
      <span>{{ attribution.name }}</span>
    </div>
    <A2UINode :component-id="root" :surface-id="surfaceId" />
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import { useStore } from 'vuex'
import A2UINode from './A2UINode.vue'
import { lighten, darken } from '../utils/color-utils'

export default defineComponent({
  name: 'A2UIRenderer',
  components: { A2UINode },
  props: {
    surfaceId: { type: String, required: true },
  },
  setup(props) {
    const store = useStore()
    const surface = computed(() => store.state.a2ui?.surfaces?.[props.surfaceId])
    const root = computed(() => surface.value?.root ?? null)
    const theme = computed(() => surface.value?.theme)

    const themeStyle = computed(() => {
      const t = theme.value
      if (!t?.primaryColor) return {}
      const pc = t.primaryColor as string
      return {
        '--a2ui-primary': pc,
        '--a2ui-primary-hover': lighten(pc, 15),
        '--a2ui-badge-info-bg': darken(pc, 40),
        '--a2ui-badge-info-fg': lighten(pc, 30),
      }
    })

    const attribution = computed(() => {
      const t = theme.value
      if (!t?.agentDisplayName) return null
      return { name: t.agentDisplayName as string, iconUrl: t.iconUrl as string | undefined }
    })

    return { root, themeStyle, attribution }
  },
})
</script>

<style scoped>
.a2ui-renderer {
  width: 100%; min-height: 100%; height: auto; padding: 12px; box-sizing: border-box;

  --a2ui-primary: #4a6cf7;
  --a2ui-primary-hover: #5d7df9;
  --a2ui-text: #e0e0e0;
  --a2ui-text-muted: #999;
  --a2ui-bg: #000000;
  --a2ui-bg-surface: #1a1a2e;
  --a2ui-bg-raised: #2a2a2a;
  --a2ui-bg-raised-hover: #3a3a3a;
  --a2ui-bg-inset: #1e1e1e;
  --a2ui-border: #444;
  --a2ui-track: #333;
  --a2ui-badge-info-bg: #1e3a5f;
  --a2ui-badge-info-fg: #7ec8e3;
  --a2ui-badge-success-bg: #1b4332;
  --a2ui-badge-success-fg: #74c69d;
  --a2ui-badge-warning-bg: #5a3e00;
  --a2ui-badge-warning-fg: #ffd166;
  --a2ui-badge-error-bg: #5c1a1a;
  --a2ui-badge-error-fg: #f28b82;
}
.a2ui-attribution { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 0.85em; color: var(--a2ui-text-muted); }
.a2ui-attribution-icon { width: 20px; height: 20px; border-radius: 50%; }
</style>
