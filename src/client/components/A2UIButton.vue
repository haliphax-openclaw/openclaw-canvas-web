<template>
  <button @click="onClick">{{ label }}</button>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import { wsClient } from '../services/ws-client'

function parseDeepLink(url: string): Record<string, string> | null {
  if (!url.startsWith('openclaw://')) return null
  try {
    const asHttp = url.replace('openclaw://', 'http://')
    const parsed = new URL(asHttp)
    const params: Record<string, string> = {}
    parsed.searchParams.forEach((v, k) => { params[k] = v })
    return params
  } catch { return null }
}

export default defineComponent({
  name: 'A2UIButton',
  props: {
    def: { type: Object, required: true },
    surfaceId: { type: String, required: true },
    componentId: { type: String, required: true },
  },
  setup(props) {
    const label = computed(() => {
      const t = (props.def as any).label ?? (props.def as any).text
      return t?.literalString ?? t ?? 'Button'
    })
    const href = computed(() => (props.def as any).href as string | undefined)
    const onClick = () => {
      wsClient.send({ type: 'a2ui.buttonClick', componentId: props.componentId })
      if (href.value) {
        const params = parseDeepLink(href.value)
        if (params) {
          const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
          fetch(`${base}/api/agent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
          }).catch(() => {})
        }
      }
    }
    return { label, onClick }
  },
})
</script>
