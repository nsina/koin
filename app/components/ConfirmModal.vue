<script setup lang="ts">
const { open, options, handleConfirm, handleCancel } = useConfirm()
</script>

<template>
  <UModal
    v-model:open="open"
    :title="options.title"
    :description="options.description"
    :dismissible="false"
    :close="false"
    :ui="{ overlay: 'z-200', content: 'z-200' }"
  >
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="handleCancel">
          {{ options.cancelLabel ?? 'Cancel' }}
        </UButton>
        <UButton :color="options.color ?? 'error'" @click="handleConfirm">
          {{ options.confirmLabel ?? 'Delete' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
