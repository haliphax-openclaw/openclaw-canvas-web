<template>
  <svg
    v-if="pathData"
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    :viewBox="'0 0 24 24'"
    role="img"
    aria-hidden="true"
  >
    <path :d="pathData" :fill="color" />
  </svg>
</template>

<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue'
import { iconMap } from './icon-map'

export default defineComponent({
  name: 'A2UIIcon',
  props: {
    icon: {
      type: [String, Object] as PropType<string | { path: string }>,
      required: true,
    },
    size: {
      type: Number,
      default: 24,
    },
    color: {
      type: String,
      default: 'currentColor',
    },
  },
  setup(props) {
    const pathData = computed(() => {
      if (typeof props.icon === 'object' && props.icon?.path) {
        return props.icon.path
      }
      if (typeof props.icon === 'string') {
        return iconMap[props.icon] ?? null
      }
      return null
    })

    return { pathData }
  },
})
</script>
