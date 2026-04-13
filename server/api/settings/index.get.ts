const MASKED_KEYS = ['mercury_api_token']
const SETTING_KEYS = [
  'irsRatePerMile',
  'companyName',
  'defaultPaymentMethod',
  'fiscalYearStart',
  'mercury_api_token'
]

export default defineEventHandler(async () => {
  const store = useStorage('kv')
  const rows = await Promise.all(
    SETTING_KEYS.map(async (key) => {
      const value = await store.getItem<string>(key)
      return { key, value }
    })
  )
  return rows.map((row) =>
    MASKED_KEYS.includes(row.key) && row.value
      ? { ...row, value: '••••' + row.value.slice(-4) }
      : row
  )
})
