<template>
  <label class="a2ui-textfield form-control w-full">
    <span v-if="label" class="label-text">{{ label }}</span>
    <textarea
      v-if="variant === 'longText'"
      class="textarea textarea-bordered w-full"
      :placeholder="placeholder"
      :value="value"
      @input="onInput"
    />
    <input
      v-else
      class="input input-bordered w-full"
      :type="inputType"
      :placeholder="placeholder"
      :value="value"
      :pattern="validationRegexp || undefined"
      @input="onInput"
    />
  </label>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import { sendEvent, useFilterBind } from '@haliphax-openclaw/a2ui-sdk'

export default defineComponent({
  name: 'A2UITextField',
  props: {
    def: { type: Object, required: true },
    surfaceId: { type: String, required: true },
    componentId: { type: String, required: true },
  },
  setup(props) {
    const label = computed(() => {
      const l = (props.def as any).label
      return l?.literalString ?? l ?? ''
    })
    const value = computed(() => {
      const v = (props.def as any).value
      return v?.literalString ?? v ?? ''
    })
    const variant = computed(() => (props.def as any).variant ?? 'shortText')
    const placeholder = computed(() => (props.def as any).placeholder ?? '')
    const validationRegexp = computed(() => (props.def as any).validationRegexp ?? '')

    const inputType = computed(() => {
      switch (variant.value) {
        case 'number': return 'number'
        case 'obscured': return 'password'
        default: return 'text'
      }
    })

    const { updateFilter, maybeEmit } = useFilterBind(props as any, { op: 'eq', nullValue: '' })

    const onInput = (e: Event) => {
      const val = (e.target as HTMLInputElement | HTMLTextAreaElement).value
      sendEvent('a2ui.textFieldChange', { componentId: props.componentId, value: val })
      updateFilter(val)
      maybeEmit(val)
    }

    return { label, value, variant, placeholder, validationRegexp, inputType, onInput }
  },
})
</script>

<style scoped>
.a2ui-textfield { color: var(--a2ui-text, inherit); }
.label-text { display: block; margin-bottom: 4px; font-size: 0.85em; }
</style>
