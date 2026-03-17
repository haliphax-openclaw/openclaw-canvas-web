<template>
  <template v-if="resolvedItems.length">
    <component
      v-for="(item, idx) in resolvedItems"
      :key="idx"
      :is="item.component"
      :def="item.def"
      :component-id="componentId + ':' + idx"
      :surface-id="surfaceId"
    />
  </template>
  <span v-else-if="def.emptyText">{{ def.emptyText }}</span>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import { useDataSource } from '../composables/useDataSource'
import A2UIProgressBar from './A2UIProgressBar.vue'
import A2UIText from './A2UIText.vue'
import A2UIBadge from './A2UIBadge.vue'

const templateComponents: Record<string, ReturnType<typeof defineComponent>> = {
  ProgressBar: A2UIProgressBar,
  Text: A2UIText,
  Badge: A2UIBadge,
}

function resolveTemplate(template: string, row: Record<string, unknown>, transforms: Record<string, any>, allRows: Record<string, unknown>[]): string {
  return template.replace(/\{\{(\w+)(?:\s*\|\s*(\w+))?\}\}/g, (_, field, transformName) => {
    let val = row[field]
    if (transformName && transforms?.[transformName]) {
      const t = transforms[transformName]
      if (t.fn === 'percentOfMax') {
        const f = t.field || field
        const max = Math.max(...allRows.map(r => Number(r[f]) || 0))
        val = max ? ((Number(row[f]) || 0) / max) * 100 : 0
      }
    }
    return String(val ?? '')
  })
}

function deepResolve(obj: unknown, row: Record<string, unknown>, transforms: Record<string, any>, allRows: Record<string, unknown>[]): unknown {
  if (typeof obj === 'string') return resolveTemplate(obj, row, transforms, allRows)
  if (Array.isArray(obj)) return obj.map(v => deepResolve(v, row, transforms, allRows))
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) out[k] = deepResolve(v, row, transforms, allRows)
    return out
  }
  return obj
}

export default defineComponent({
  name: 'A2UIRepeat',
  props: {
    def: { type: Object, required: true },
    surfaceId: { type: String, required: true },
    componentId: { type: String, required: true },
  },
  setup(props) {
    const { filteredRows } = useDataSource({ def: props.def as any, surfaceId: props.surfaceId })

    const resolvedItems = computed(() => {
      const rows = filteredRows.value ?? []
      const template = (props.def as any).template
      if (!template || !rows.length) return []
      const transforms = (props.def as any).transforms ?? {}
      const typeName = Object.keys(template)[0]
      const comp = templateComponents[typeName]
      if (!comp) return []
      const innerDef = template[typeName]
      return rows.map((row: Record<string, unknown>) => ({
        component: comp,
        def: deepResolve(innerDef, row, transforms, rows) as Record<string, unknown>,
      }))
    })

    return { resolvedItems }
  },
})
</script>
