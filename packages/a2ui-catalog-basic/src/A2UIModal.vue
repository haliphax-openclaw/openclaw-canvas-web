<template>
  <div class="a2ui-modal-wrapper">
    <div @click="open = true">
      <A2UINode v-if="trigger" :component-id="trigger" :surface-id="surfaceId" />
    </div>
    <dialog ref="dialogRef" class="modal" :class="{ 'modal-open': open }">
      <div class="modal-box">
        <A2UINode v-if="content" :component-id="content" :surface-id="surfaceId" />
        <div class="modal-action">
          <button class="btn" @click="open = false">Close</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="open = false">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, ref } from 'vue'

export default defineComponent({
  name: 'A2UIModal',
  props: {
    def: { type: Object, required: true },
    surfaceId: { type: String, required: true },
    componentId: { type: String, required: true },
  },
  setup(props) {
    const trigger = computed(() => (props.def as any).trigger ?? null)
    const content = computed(() => (props.def as any).content ?? null)
    const open = ref(false)
    const dialogRef = ref<HTMLDialogElement | null>(null)
    return { trigger, content, open, dialogRef }
  },
})
</script>

<style scoped>
.a2ui-modal-wrapper { display: inline-block; }
</style>
