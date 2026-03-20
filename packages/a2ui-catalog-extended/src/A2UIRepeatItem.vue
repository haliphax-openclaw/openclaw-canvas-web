<template>
  <component
    :is="itemComponent"
    :def="itemDef"
    :component-id="childComponentId"
    :surface-id="surfaceId"
  />
</template>

<script lang="ts">
import { defineComponent, provide, computed, type PropType, type Component } from 'vue'
import { A2UI_REPEAT_FMT_KEY, type RepeatFmtContext } from '@haliphax-openclaw/a2ui-sdk'

export default defineComponent({
  name: 'A2UIRepeatItem',
  props: {
    itemComponent: { type: Object as PropType<Component>, required: true },
    itemDef: { type: Object, required: true },
    childComponentId: { type: String, required: true },
    surfaceId: { type: String, required: true },
    row: { type: Object as PropType<Record<string, unknown>>, required: true },
    repeatTransforms: {
      type: Object as PropType<Record<string, { fn: string; field?: string }>>,
      default: () => ({}),
    },
    repeatAllRows: {
      type: Array as PropType<Record<string, unknown>[]>,
      required: true,
    },
  },
  setup(props) {
    provide(
      A2UI_REPEAT_FMT_KEY,
      computed(
        (): RepeatFmtContext => ({
          row: props.row,
          transforms: props.repeatTransforms,
          allRows: props.repeatAllRows,
        }),
      ),
    )
    return {}
  },
})
</script>
