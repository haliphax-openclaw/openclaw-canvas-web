<template>
  <div class="a2ui-table-wrapper">
    <table class="a2ui-table" :class="{ sortable }">
    <thead v-if="headers.length">
      <tr>
        <th v-for="(h, i) in headers" :key="i" @click="sortable && cycleSort(h)">{{ sortIndicator(h) }}{{ h }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, ri) in displayRows" :key="ri">
        <td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td>
      </tr>
    </tbody>
  </table>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import { useDataSource } from '../composables/useDataSource'
import { useSortable } from '../composables/useSortable'

const builtinFormatters: Record<string, (v: unknown) => string> = {
  boolean: (v) => v ? '✅' : '❌',
}

export default defineComponent({
  name: 'A2UITable',
  props: {
    def: { type: Object, required: true },
    surfaceId: { type: String, required: true },
    componentId: { type: String, required: true },
  },
  setup(props) {
    const { filteredRows, binding } = useDataSource(props as any)
    const sortable = computed(() => !!(props.def as any).sortable)
    const formatters = computed(() => (props.def as any).formatters as Record<string, string> | undefined)

    const headers = computed(() => {
      if (binding.value) {
        if (binding.value.columns) return binding.value.columns
        if (filteredRows.value?.length) return Object.keys(filteredRows.value[0])
      }
      return (props.def as any).headers ?? []
    })

    const rawRows = computed(() => {
      if (binding.value && filteredRows.value) {
        return filteredRows.value as Record<string, unknown>[]
      }
      return [] as Record<string, unknown>[]
    })

    const { sortField, sortDirection, sortedRows, cycleSort } = useSortable(rawRows)

    function formatCell(column: string, value: unknown): unknown {
      const fmt = formatters.value?.[column]
      if (fmt && builtinFormatters[fmt]) return builtinFormatters[fmt](value)
      return value
    }

    const displayRows = computed(() => {
      if (binding.value && filteredRows.value) {
        const cols = headers.value
        return sortedRows.value.map((r: any) => cols.map((c: string) => formatCell(c, r[c])))
      }
      return (props.def as any).rows ?? []
    })

    function sortIndicator(header: string): string {
      if (!sortable.value || sortField.value !== header) return ''
      return sortDirection.value === 'asc' ? '⬆ ' : '⬇ '
    }

    return { headers, displayRows, sortable, cycleSort, sortIndicator }
  },
})
</script>

<style scoped>
.a2ui-table { border-collapse: collapse; width: 100%; color: #e0e0e0; }
.a2ui-table-wrapper { overflow-x: auto; width: 100%; }
.a2ui-table-wrapper .a2ui-table { width: max-content; min-width: 100%; }
.a2ui-table th, .a2ui-table td { border: 1px solid #444; padding: 6px 10px; text-align: left; }
.a2ui-table th { background: #16213e; }
.a2ui-table.sortable th { cursor: pointer; }
.a2ui-table tr:nth-child(even) { background: rgba(255,255,255,0.03); }
</style>
