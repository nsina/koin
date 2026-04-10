import { db } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { settings } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const start = String(query.start || '')
  const end = String(query.end || '')

  const [tokenRow] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, 'mercury_api_token'))

  if (!tokenRow?.value) {
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
    headers: { Authorization: `Bearer ${tokenRow.value}` }
  })

  return data.transactions ?? []
})
