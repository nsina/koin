<script setup>
const appReady = useState('app-ready', () => false)

onMounted(async () => {
  const store = useExpenseStore()
  const { loadSettings } = useSettings()
  const { loadContractors } = useContractors()
  const { loadRecurring, processAutoAdd } = useRecurring()

  try {
    await Promise.all([store.initStore(), loadSettings(), loadContractors(), loadRecurring()])
    await processAutoAdd()
  } catch (e) {
    console.error('App init failed:', e)
  }
  appReady.value = true
})

useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: {
    lang: 'en',
  },
})

const title = 'Koin'
const description = 'Internal expense tracker with mileage, Mercury CSV import, and tax reporting.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImage: '/favicon.ico',
  twitterImage: '/favicon.ico',
  twitterCard: 'summary_large_image',
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <ConfirmModal />
  </UApp>
</template>
