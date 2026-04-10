export default defineNuxtPlugin(async () => {
  const store = useExpenseStore()
  const { loadSettings } = useSettings()
  const { loadContractors } = useContractors()
  const { loadRecurring, processAutoAdd } = useRecurring()

  await Promise.all([store.initStore(), loadSettings(), loadContractors(), loadRecurring()])
  await processAutoAdd()
})
