<template>
  <div class="a2ui-tabs" :class="`a2ui-tabs--${pos}`">
    <div v-if="pos !== 'hidden'" class="a2ui-tabs-bar" :class="`a2ui-tabs-bar--${pos}`">
      <div
        v-for="(tab, i) in tabs"
        :key="i"
        class="a2ui-tab"
        :class="{ 'a2ui-tab--active': i === activeIndex }"
        @click="activeIndex = i"
      >{{ tab.label }}</div>
    </div>
    <div class="a2ui-tabs-content" :style="contentStyle">
      <div
        v-for="(tab, i) in tabs"
        :key="i"
        class="a2ui-tabs-panel"
        :class="{ 'a2ui-tabs-panel--hidden': i !== activeIndex }"
      >
        <A2UINode :component-id="tab.child" :surface-id="surfaceId" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed } from 'vue'

export default defineComponent({
  name: 'A2UITabs',
  props: {
    def: { type: Object, required: true },
    surfaceId: { type: String, required: true },
    componentId: { type: String, required: true },
  },
  setup(props) {
    const tabs = computed(() => (props.def as any).tabs ?? [])
    const pos = computed(() => (props.def as any).position ?? 'top')
    const height = computed(() => (props.def as any).height ?? 'auto')
    const activeIndex = ref((props.def as any).active ?? 0)

    const contentStyle = computed(() => {
      if (height.value !== 'auto') {
        return { height: height.value, overflow: 'auto' }
      }
      return {}
    })

    return { tabs, pos, height, activeIndex, contentStyle }
  },
})
</script>

<style scoped>
.a2ui-tabs { display: flex; flex-direction: column; gap: 12px; }
.a2ui-tabs--left { flex-direction: row; }
.a2ui-tabs--right { flex-direction: row-reverse; }
.a2ui-tabs--bottom { flex-direction: column-reverse; }

.a2ui-tabs-bar { display: flex; flex-wrap: wrap; gap: 0; border-bottom: 1px solid #444; }
.a2ui-tabs-bar--left,
.a2ui-tabs-bar--right { flex-direction: column; flex-wrap: nowrap; border-bottom: none; }
.a2ui-tabs-bar--left { border-right: 1px solid #444; }
.a2ui-tabs-bar--right { border-left: 1px solid #444; }
.a2ui-tabs-bar--bottom { border-bottom: none; border-top: 1px solid #444; }

.a2ui-tab {
  padding: 6px 14px;
  cursor: pointer;
  user-select: none;
  color: #999;
  background: transparent;
  overflow-wrap: break-word;
  word-break: break-word;
}
.a2ui-tab:hover { color: #ccc; background: #2a2a2a; }
.a2ui-tab--active { color: #e0e0e0; background: #16213e; border-bottom: 2px solid #e0e0e0; }

.a2ui-tabs-bar--bottom .a2ui-tab--active { border-bottom: none; border-top: 2px solid #e0e0e0; }
.a2ui-tabs-bar--left .a2ui-tab--active { border-bottom: none; border-right: 2px solid #e0e0e0; }
.a2ui-tabs-bar--right .a2ui-tab--active { border-bottom: none; border-left: 2px solid #e0e0e0; }

.a2ui-tabs-content { position: relative; }
.a2ui-tabs-panel--hidden { visibility: hidden; position: absolute; top: 0; left: 0; right: 0; pointer-events: none; }
</style>
