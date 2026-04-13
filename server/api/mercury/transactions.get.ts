export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const start = String(query.start || '')
  const end = String(query.end || '')

  const token = await useStorage('kv').getItem<string>('mercury_api_token')

  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Mercury API token not configured' })
  }

  const params = new URLSearchParams()
  if (start) params.set('start', start)
  if (end) params.set('end', end)
  params.append('status[]', 'sent')
  params.set('limit', '1000')
  params.set('order', 'desc')

  const url = `https://api.mercury.com/api/v1/transactions?${params.toString()}`

  const data = await $fetch<{ transactions: unknown[] }>(url, {
    headers: { Authorization: `Bearer ${token}` }
  })

  return data.transactions ?? []
})
