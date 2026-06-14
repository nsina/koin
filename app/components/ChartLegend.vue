<script setup lang="ts">
// Aligned legend list for donut charts: color dot · label · amount · share.
// Columns line up across rows via a fixed-width grid (Carbon legend guidance).
export interface ChartLegendItem {
  label: string
  total: number
  pct: number
  color: string
}

defineProps<{ items: ChartLegendItem[] }>()

// Whole-dollar currency keeps the dense value column tight (no cents).
function wholeDollars(value: number) {
  return `$${Math.round(value).toLocaleString('en-US')}`
}
</script>

<template>
  <ul class="w-full space-y-3">
    <li
      v-for="item in items"
      :key="item.label"
      class="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 text-sm"
    >
      <span class="size-2.5 rounded-full" :style="{ backgroundColor: item.color }" />
      <span class="min-w-0 truncate" :title="item.label">{{ item.label }}</span>
      <span class="w-16 text-right font-medium tabular-nums">{{ wholeDollars(item.total) }}</span>
      <span class="w-10 text-right text-xs text-dimmed tabular-nums">{{ item.pct }}%</span>
    </li>
  </ul>
</template>
