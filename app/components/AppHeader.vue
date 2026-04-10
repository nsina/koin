<script setup lang="ts">
const { companyName } = useSettings()
const { navItems } = useAppNav()
</script>

<template>
  <UHeader>
    <template #title>
      <ClientOnly>
        <span class="font-extrabold tracking-tight">{{ companyName || 'Koin' }}</span>
        <template #fallback>
          <span class="font-extrabold tracking-tight">Koin</span>
        </template>
      </ClientOnly>
    </template>

    <UNavigationMenu :items="navItems" />

    <template #right>
      <UColorModeButton />
      <UButton
        icon="i-lucide-settings"
        color="neutral"
        variant="ghost"
        class="no-print"
        aria-label="Settings"
        @click="navigateTo('/settings')"
      />
    </template>

    <template #body>
      <UNavigationMenu :items="navItems" orientation="vertical" class="-mx-2.5" />
    </template>
  </UHeader>
</template>
