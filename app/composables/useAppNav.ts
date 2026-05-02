import type { NavigationMenuItem } from '@nuxt/ui'

export type AppTab = 'expenses' | 'dashboard' | 'mileage' | 'mercury' | 'tax'

const activeTab = ref<AppTab>('expenses')

export function useAppNav() {
  const navItems = computed<NavigationMenuItem[]>(() => [
    {
      label: 'Expenses',
      icon: 'i-lucide-credit-card',
      active: activeTab.value === 'expenses',
      onClick: () => (activeTab.value = 'expenses'),
    },
    {
      label: 'Mileage',
      icon: 'i-lucide-car',
      active: activeTab.value === 'mileage',
      onClick: () => (activeTab.value = 'mileage'),
    },
    {
      label: 'Dashboard',
      icon: 'i-lucide-layout-dashboard',
      active: activeTab.value === 'dashboard',
      onClick: () => (activeTab.value = 'dashboard'),
    },
    {
      label: 'Tax Report',
      icon: 'i-lucide-receipt-text',
      active: activeTab.value === 'tax',
      onClick: () => (activeTab.value = 'tax'),
    },
    {
      label: 'Mercury Import',
      icon: 'i-lucide-file-spreadsheet',
      active: activeTab.value === 'mercury',
      onClick: () => (activeTab.value = 'mercury'),
    },
  ])

  return { activeTab, navItems }
}
