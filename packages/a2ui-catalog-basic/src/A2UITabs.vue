<template>
  <div class="a2ui-tabs">
    <div
      v-if="pos !== 'hidden'"
      class="tabs tabs-border"
      :class="pos === 'bottom' ? 'tabs-bottom' : 'tabs-top'"
      role="tablist"
    >
      <a
        v-for="(tab, i) in tabs"
        :key="i"
        role="tab"
        class="tab"
        :class="{ 'tab-active': i === activeIndex }"
        @click="activeIndex = i"
      >{{ tab.label }}</a>
      <div
        class="tab-content a2ui-tabs-content"
        :class="{ 'a2ui-tabs-content--fixed': height !== 'auto' }"
        :style="height !== 'auto' ? `--tabs-content-height: ${height}` : undefined"
      >
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
    <div
      v-else
      class="a2ui-tabs-content"
      :class="{ 'a2ui-tabs-content--fixed': height !== 'auto' }"
      :style="height !== 'auto' ? `--tabs-content-height: ${height}` : undefined"
    >
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
    const tabs = computed(() => {
      const raw = (props.def as any).tabs ?? []
      return raw.map((t: any) => ({
        label: t.label ?? '',
        child: t.child ?? (Array.isArray(t.children) ? t.children[0] : null),
      }))
    })
    const pos = computed(() => (props.def as any).position ?? 'top')
    const height = computed(() => (props.def as any).height ?? 'auto')
    const activeIndex = ref((props.def as any).active ?? 0)

    return { tabs, pos, height, activeIndex }
  },
})
</script>

<style scoped>
.a2ui-tabs-content { position: relative; display: grid; }
.a2ui-tabs-content--fixed { height: var(--tabs-content-height); overflow: auto; }
.a2ui-tabs-panel { grid-area: 1 / 1; }
.a2ui-tabs-panel--hidden { visibility: hidden; pointer-events: none; }
</style>
