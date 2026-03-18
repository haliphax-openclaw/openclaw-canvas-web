<template>
  <button ref="btnRef" @click="onClick">{{ displayLabel }}</button>
</template>

<script lang="ts">
import { defineComponent, computed, ref } from 'vue'
import { wsClient } from '../services/ws-client'
import { parseOpenClawUrl } from '../utils/url-schemes'

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
    const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
    const sentFlash = ref(false)
    const btnRef = ref<HTMLButtonElement | null>(null)
    const displayLabel = computed(() => sentFlash.value ? 'Sent!' : label.value)

    let flashTimer: ReturnType<typeof setTimeout> | null = null

    const flashSent = () => {
      if (flashTimer) clearTimeout(flashTimer)
      sentFlash.value = true
      btnRef.value?.blur()
      flashTimer = setTimeout(() => {
        sentFlash.value = false
        btnRef.value?.blur()
      }, 3000)
    }

    const onClick = () => {
      wsClient.send({ type: 'a2ui.buttonClick', componentId: props.componentId })
      if (!href.value) return
      const parsed = parseOpenClawUrl(href.value)
      if (!parsed) return
      if (parsed.type === 'agent') {
        fetch(`${base}/api/agent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.params),
        }).then(flashSent).catch(() => {})
      } else if (parsed.type === 'cron') {
        fetch(`${base}/api/cron-trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.params),
        }).then(flashSent).catch(() => {})
      }
    }
    return { displayLabel, onClick, btnRef }
  },
})
</script>
