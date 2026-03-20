<template>
  <div class="a2ui-repeat">
    <div v-if="sortable" class="a2ui-repeat-sort">
      <select v-model="sortDir" class="select select-sm">
        <option value="">Unsorted</option>
        <option value="asc">Ascending</option>
        <option value="desc">Descending</option>
      </select>
    </div>
    <div v-if="resolvedItems.length" class="a2ui-repeat-items">
      <component
        v-for="(item, idx) in resolvedItems"
        :key="idx"
        :is="item.component"
        :def="item.def"
        :component-id="componentId + ':' + idx"
        :surface-id="surfaceId"
      />
    </div>
    <span v-else-if="def.emptyText">{{ def.emptyText }}</span>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, ref, watch, toRaw } from 'vue'
import { useDataSource, useSortable, deepInterpolate, formatString, type SortDirection } from '@haliphax-openclaw/a2ui-sdk'
import A2UIProgressBar from './A2UIProgressBar.vue'
import A2UIText from './A2UIText.vue'
import A2UIBadge from './A2UIBadge.vue'

const templateComponents: Record<string, ReturnType<typeof defineComponent>> = {
  ProgressBar: A2UIProgressBar,
  Text: A2UIText,
  Badge: A2UIBadge,
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
    const sortable = computed(() => !!(props.def as any).sortable)
    const sortFieldName = computed(() => (props.def as any).sortField as string | undefined)

    const rawRows = computed(() => (filteredRows.value ?? []) as Record<string, unknown>[])
    const { sortedRows, setSort } = useSortable(rawRows)

    const sortDir = ref<'' | 'asc' | 'desc'>('')
    watch(sortDir, (v) => {
      setSort(sortFieldName.value ?? null, (v || null) as SortDirection)
    })

    const resolvedItems = computed(() => {
      const rows = sortedRows.value
      const template = (props.def as any).template
      if (!template || !rows.length) return []
      const transforms = (props.def as any).transforms ?? {}
      const typeName = Object.keys(template)[0]
      const comp = templateComponents[typeName]
      if (!comp) return []
      const innerDef = template[typeName]
      const fmtOpts = { transforms, allRows: rows.map((r) => ({ ...toRaw(r) })) }
      return rows.map((row: Record<string, unknown>) => {
        const plainRow = { ...toRaw(row) }
        const interpolated = deepInterpolate(innerDef, plainRow, fmtOpts) as Record<string, unknown>
        for (const k of ['label', 'value', 'text'] as const) {
          const v = interpolated[k]
          if (typeof v === 'string' && v.includes('${')) {
            interpolated[k] = formatString(v, plainRow, fmtOpts)
          }
        }
        return {
          component: comp,
          def: interpolated,
        }
      })
    })

    return { resolvedItems, sortable, sortDir }
  },
})
</script>

<style scoped>
.a2ui-repeat { margin-bottom: 16px; }
.a2ui-repeat-sort { margin-bottom: 8px; }
.a2ui-repeat-sort-select { background: var(--a2ui-bg-surface); color: var(--a2ui-text); border: 1px solid var(--a2ui-border); padding: 4px 8px; border-radius: 4px; }
.a2ui-repeat-items { display: flex; flex-direction: column; gap: 12px; }
</style>
