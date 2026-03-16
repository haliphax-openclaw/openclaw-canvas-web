<template>
  <div
    ref="canvasRoot"
    class="canvas-view"
    :class="{ 'canvas-hidden': !visible }"
    :style="panelStyle"
  >
    <A2UIRenderer v-if="hasA2UISurface" :surface-id="activeSurfaceId" />
    <template v-else>
      <iframe
        v-if="externalUrl"
        :src="externalUrl"
        class="canvas-frame"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
      <iframe
        v-else-if="iframeSrc"
        ref="iframe"
        :src="iframeSrc"
        class="canvas-frame"
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
      <div v-else class="canvas-loading">Loading…</div>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, ref, watch, onMounted, onUnmounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { wsClient } from '../services/ws-client'
import A2UIRenderer from '../components/A2UIRenderer.vue'
import domtoimage from 'dom-to-image-more'

const GEOMETRY_KEY = 'openclaw-canvas-geometry'

function loadGeometry(): { width: string; height: string } {
  try {
    const raw = localStorage.getItem(GEOMETRY_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { width: '100%', height: '100%' }
}

function saveGeometry(g: { width: string; height: string }) {
  try { localStorage.setItem(GEOMETRY_KEY, JSON.stringify(g)) } catch { /* ignore */ }
}

export default defineComponent({
  name: 'CanvasView',
  components: { A2UIRenderer },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const store = useStore()
    const iframe = ref<HTMLIFrameElement | null>(null)
    const canvasRoot = ref<HTMLElement | null>(null)
    const cacheBust = ref(0)
    const visible = computed(() => store.state.panel.visible)
    const activeSurfaceId = ref('main')
    const externalUrl = ref<string | null>(null)

    const geometry = reactive(loadGeometry())
    const panelStyle = computed(() => ({ width: geometry.width, height: geometry.height }))

    const hasA2UISurface = computed(() => {
      const surface = store.state.a2ui?.surfaces?.[activeSurfaceId.value]
      return surface?.root != null
    })

    const sessionId = computed(() => route.params.sessionId as string)
    const subpath = computed(() => (route.params.path as string) || '')

    const iframeSrc = computed(() => {
      if (externalUrl.value) return null
      const base = `/canvas/${sessionId.value}/${subpath.value}`
      return cacheBust.value ? `${base}?_cb=${cacheBust.value}` : base
    })

    watch(sessionId, (s) => store.dispatch('switchSession', s), { immediate: true })

    function reload() { cacheBust.value = Date.now() }

    const onReload = () => reload()
    const onShow = (d: Record<string, unknown>) => {
      store.commit('setVisible', true)
      externalUrl.value = null
      if (d.session) router.push(`/session/${d.session}/`)
    }
    const onHide = () => store.commit('setVisible', false)
    const onNavigate = (d: Record<string, unknown>) => {
      externalUrl.value = null
      const s = (d.session as string) || sessionId.value
      const p = (d.path as string) || ''
      router.push(`/session/${s}/${p}`)
    }
    const onNavigateExternal = (d: Record<string, unknown>) => {
      const url = d.url as string
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        externalUrl.value = url
      }
    }
    const onEval = (d: Record<string, unknown>) => {
      try {
        iframe.value?.contentWindow?.postMessage({ type: 'canvas.eval', js: d.js }, '*')
      } catch { /* cross-origin */ }
    }
    const onSnapshot = async (d: Record<string, unknown>) => {
      try {
        const el = canvasRoot.value
        if (!el) throw new Error('No canvas root element')
        const image = await domtoimage.toPng(el, { bgcolor: '#000000' })
        wsClient.send({ type: 'canvas.snapshotResult', id: d.id, image })
      } catch (err) {
        wsClient.send({ type: 'canvas.snapshotResult', id: d.id, error: String(err) })
      }
    }
    const onGeometry = (d: Record<string, unknown>) => {
      if (d.width) geometry.width = d.width as string
      if (d.height) geometry.height = d.height as string
      saveGeometry(geometry)
    }

    const onSurfaceUpdate = (d: Record<string, unknown>) => {
      store.commit('a2ui/upsertSurface', { surfaceId: d.surfaceId, components: d.components })
    }
    const onBeginRendering = (d: Record<string, unknown>) => {
      store.commit('a2ui/setRoot', { surfaceId: d.surfaceId, root: d.root })
      activeSurfaceId.value = d.surfaceId as string
    }
    const onDataModelUpdate = (d: Record<string, unknown>) => {
      store.commit('a2ui/updateDataModel', { surfaceId: d.surfaceId, data: d.data })
    }
    const onDeleteSurface = (d: Record<string, unknown>) => {
      store.commit('a2ui/deleteSurface', { surfaceId: d.surfaceId })
    }
    const onClearAll = () => store.commit('a2ui/clearAll')

    const handlers: [string, (d: Record<string, unknown>) => void][] = [
      ['reload', onReload],
      ['canvas.show', onShow],
      ['canvas.hide', onHide],
      ['canvas.navigate', onNavigate],
      ['canvas.navigateExternal', onNavigateExternal],
      ['canvas.eval', onEval],
      ['canvas.snapshot', onSnapshot],
      ['canvas.geometry', onGeometry],
      ['a2ui.surfaceUpdate', onSurfaceUpdate],
      ['a2ui.beginRendering', onBeginRendering],
      ['a2ui.dataModelUpdate', onDataModelUpdate],
      ['a2ui.deleteSurface', onDeleteSurface],
      ['a2ui.clearAll', onClearAll],
    ]

    onMounted(() => { for (const [t, h] of handlers) wsClient.on(t, h) })
    onUnmounted(() => { for (const [t, h] of handlers) wsClient.off(t, h) })

    return { iframeSrc, iframe, canvasRoot, visible, reload, hasA2UISurface, activeSurfaceId, panelStyle, externalUrl }
  },
})
</script>

<style scoped>
.canvas-view {
  width: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.canvas-view.canvas-hidden {
  opacity: 0;
  pointer-events: none;
  transform: scale(0.98);
}
.canvas-frame { flex: 1; border: none; width: 100%; height: 100%; }
.canvas-loading { flex: 1; display: flex; align-items: center; justify-content: center; color: #888; }
</style>
