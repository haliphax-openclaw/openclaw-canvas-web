import { computed } from 'vue'
import { useStore } from 'vuex'
import { computeAggregate } from '../services/filter-engine'

export function useDataSource(props: { def: Record<string, unknown>; surfaceId: string }) {
  const store = useStore()
  const binding = computed(() => (props.def as any).dataSource as { source: string; map?: Record<string, string>; aggregate?: { fn: string; field?: string }; columns?: string[] } | undefined)

  const filteredRows = computed(() => {
    if (!binding.value) return null
    return store.getters['a2ui/filteredSource'](props.surfaceId, binding.value.source) ?? []
  })

  const aggregatedValue = computed(() => {
    if (!binding.value?.aggregate || !filteredRows.value) return null
    return computeAggregate(binding.value.aggregate as any, filteredRows.value)
  })

  const mappedProps = computed(() => {
    if (!binding.value?.map) return {}
    const result: Record<string, unknown> = {}
    for (const [prop, field] of Object.entries(binding.value.map)) {
      if (field === '$value') {
        result[prop] = aggregatedValue.value
      } else if (filteredRows.value && filteredRows.value.length > 0) {
        result[prop] = filteredRows.value[0][field]
      }
    }
    return result
  })

  return { filteredRows, aggregatedValue, mappedProps, binding }
}
