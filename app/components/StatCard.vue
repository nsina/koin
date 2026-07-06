<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  icon?: string
  valueClass?: string
}>()
</script>

<template>
  <UCard :ui="{ root: 'flex flex-col', body: 'flex-1 flex flex-col gap-3' }">
    <div class="flex items-start justify-between gap-2">
      <p class="text-sm text-muted">{{ label }}</p>
      <slot name="action">
        <UIcon v-if="icon" :name="icon" class="size-4 shrink-0 text-dimmed" />
      </slot>
    </div>
    <p
      class="text-4xl font-bold tracking-tight tabular-nums"
      :class="valueClass ?? 'text-highlighted'"
    >
      {{ value }}
    </p>
    <div v-if="$slots.meta" class="mt-auto text-sm text-muted"><slot name="meta" /></div>
  </UCard>
</template>
