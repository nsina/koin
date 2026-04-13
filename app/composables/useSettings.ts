const irsRatePerMile = ref(0.725)
const companyName = ref('')
const defaultPaymentMethod = ref('Mercury Debit')
const fiscalYearStart = ref('01-01')
const mercuryApiToken = ref('')

export function useSettings() {
  const toast = useToast()

  async function loadSettings() {
    const rows = await $fetch<{ key: string; value: string | null }[]>('/api/settings')
    for (const row of rows) {
      if (row.value === null) continue
      if (row.key === 'irsRatePerMile') irsRatePerMile.value = Number(row.value)
      if (row.key === 'companyName') companyName.value = row.value
      if (row.key === 'defaultPaymentMethod') defaultPaymentMethod.value = row.value
      if (row.key === 'fiscalYearStart') fiscalYearStart.value = row.value
      if (row.key === 'mercury_api_token') mercuryApiToken.value = row.value
    }
  }

  async function saveSetting(key: string, value: string, silent = false) {
    await $fetch('/api/settings', { method: 'PUT', body: { key, value } })
    if (key === 'irsRatePerMile') irsRatePerMile.value = Number(value)
    if (key === 'companyName') companyName.value = value
    if (key === 'defaultPaymentMethod') defaultPaymentMethod.value = value
    if (key === 'fiscalYearStart') fiscalYearStart.value = value
    if (key === 'mercury_api_token') mercuryApiToken.value = value
    if (!silent) toast.add({ title: 'Setting saved', color: 'success' })
  }

  return {
    irsRatePerMile,
    companyName,
    defaultPaymentMethod,
    fiscalYearStart,
    mercuryApiToken,
    loadSettings,
    saveSetting
  }
}
