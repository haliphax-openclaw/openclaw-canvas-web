<template>
  <table class="a2ui-table">
    <thead v-if="headers.length">
      <tr><th v-for="(h, i) in headers" :key="i">{{ h }}</th></tr>
    </thead>
    <tbody>
      <tr v-for="(row, ri) in rows" :key="ri">
        <td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td>
      </tr>
    </tbody>
  </table>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'

export default defineComponent({
  name: 'A2UITable',
  props: {
    def: { type: Object, required: true },
    surfaceId: { type: String, required: true },
    componentId: { type: String, required: true },
  },
  setup(props) {
    const headers = computed(() => (props.def as any).headers ?? [])
    const rows = computed(() => (props.def as any).rows ?? [])
    return { headers, rows }
  },
})
</script>

<style scoped>
.a2ui-table { border-collapse: collapse; width: 100%; color: #e0e0e0; }
.a2ui-table th, .a2ui-table td { border: 1px solid #444; padding: 6px 10px; text-align: left; }
.a2ui-table th { background: #16213e; }
.a2ui-table tr:nth-child(even) { background: rgba(255,255,255,0.03); }
</style>
