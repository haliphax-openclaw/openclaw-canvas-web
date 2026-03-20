<template>
  <component :is="tag" :class="{ 'a2ui-text--stroked': strokeWidth }" :style="strokeWidth ? `--text-stroke-width: ${strokeWidth}` : undefined">{{ displayText }}</component>
</template>

<script lang="ts">
import { defineComponent, computed, inject, type ComputedRef } from 'vue'
import { useDataSource, formatString, A2UI_REPEAT_FMT_KEY, type RepeatFmtContext } from '@haliphax-openclaw/a2ui-sdk'

const hintMap: Record<string, string> = { h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6', body: 'p', label: 'span' }

export default defineComponent({
  name: 'A2UIText',
  props: {
    def: { type: Object, required: true },
    surfaceId: { type: String, required: true },
    componentId: { type: String, required: true },
  },
  setup(props) {
    const repeatFmtRef = inject(A2UI_REPEAT_FMT_KEY, undefined) as ComputedRef<RepeatFmtContext> | undefined
    const { aggregatedValue, compoundAggregates, filteredRows, mappedProps, binding } = useDataSource(props as any)
    const tag = computed(() => hintMap[(props.def as any).variant] ?? 'p')
    const strokeWidth = computed(() => (props.def as any).strokeWidth ?? null)
    const displayText = computed(() => {
      if (binding.value) {
        if (mappedProps.value.text != null) return mappedProps.value.text
        const t = (props.def as any).text
        const raw = t?.literalString ?? t ?? ''
        if (typeof raw === 'string' && raw.includes('${')) {
          const aggs = compoundAggregates.value
          const allKeys: Record<string, unknown> = { ...aggs }
          if (aggregatedValue.value != null) allKeys['$value'] = aggregatedValue.value
          const row = filteredRows.value && filteredRows.value.length > 0 ? filteredRows.value[0] : null
          return formatString(raw, { ...allKeys, ...(row ?? {}) })
        }
        if (aggregatedValue.value != null) return aggregatedValue.value
      }
      const t = (props.def as any).text
      const fallback = t?.literalString ?? t ?? ''
      if (typeof fallback === 'string' && fallback.includes('${')) {
        const repeatCtx = repeatFmtRef?.value
        if (repeatCtx) {
          return formatString(fallback, { ...repeatCtx.row }, { transforms: repeatCtx.transforms, allRows: repeatCtx.allRows })
        }
      }
      return fallback
    })
    return { tag, displayText, strokeWidth }
  },
})
</script>

<style scoped>
.a2ui-text--stroked {
  -webkit-text-stroke: var(--text-stroke-width) black;
  text-stroke: var(--text-stroke-width) black;
  paint-order: stroke fill;
}
</style>
