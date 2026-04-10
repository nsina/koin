<script setup lang="ts">
const { activeTab } = useAppNav()
const appReady = useState('app-ready')

const activeTabComponent = computed(() => {
  if (activeTab.value === 'expenses') return resolveComponent('ExpensesTab')
  if (activeTab.value === 'dashboard') return resolveComponent('DashboardTab')
  if (activeTab.value === 'mileage') return resolveComponent('MileageTab')
  if (activeTab.value === 'mercury') return resolveComponent('MercuryImportTab')
  return resolveComponent('TaxReportTab')
})
</script>

<template>
  <div class="print-area mx-auto w-full max-w-410 space-y-7 px-6 py-8 md:px-10">
    <template v-if="appReady">
      <KeepAlive>
        <component :is="activeTabComponent" />
      </KeepAlive>
    </template>

    <div v-else class="flex flex-col items-center justify-center gap-6 py-32">
      <UIcon name="i-lucide-loader" class="size-8 animate-spin text-muted" />
      <p class="text-sm text-muted">Loading...</p>
    </div>
  </div>
</template>
