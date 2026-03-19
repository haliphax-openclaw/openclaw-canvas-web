<template>
  <button :class="variantClass" :disabled="sentFlash" @click="onClick">{{ displayLabel }}</button>
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
    const variant = computed(() => (props.def as any).variant ?? 'default')
    const variantClass = computed(() => variant.value !== 'default' ? `a2ui-btn--${variant.value}` : undefined)
    const href = computed(() => (props.def as any).href as string | undefined)
    const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
    const sentFlash = ref(false)
    const displayLabel = computed(() => sentFlash.value ? 'Sent!' : label.value)

    let flashTimer: ReturnType<typeof setTimeout> | null = null

    const flashSent = () => {
      if (flashTimer) clearTimeout(flashTimer)
      sentFlash.value = true
      flashTimer = setTimeout(() => {
        sentFlash.value = false
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
      } else if (parsed.type === 'fileprompt') {
        fetch(`${base}/api/file-spawn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: parsed.path, ...parsed.params }),
        }).then(flashSent).catch(() => {})
      }
    }
    return { displayLabel, variantClass, onClick, sentFlash }
  },
})
</script>

<style scoped>
.a2ui-btn--primary { background: var(--a2ui-primary); color: #fff; border-color: var(--a2ui-primary); }
.a2ui-btn--primary:hover:not(:disabled) { background: var(--a2ui-primary-hover); border-color: var(--a2ui-primary-hover); }
.a2ui-btn--borderless { background: transparent; border: none; color: var(--a2ui-primary); }
.a2ui-btn--borderless:hover:not(:disabled) { text-decoration: underline; }
</style>
