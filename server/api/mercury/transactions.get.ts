// Mercury "List all transactions" endpoint.
// Docs: https://docs.mercury.com/reference/listtransactions
// Response shape: { transactions: [...], page: { nextPage, previousPage } }
const MERCURY_TRANSACTIONS_URL = 'https://api.mercury.com/api/v1/transactions'

// Mercury caps `limit` at 1000. We page with the `nextPage` cursor until exhausted.
// Cloudflare Workers allow ~50 outbound subrequests per invocation, so cap the
// number of pages well under that (1 page = 1 subrequest) to stay safe.
const PAGE_LIMIT = 1000
const MAX_PAGES = 40

interface MercuryTransactionsPage {
  transactions?: unknown[]
  page?: { nextPage?: string | null; previousPage?: string | null }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const start = String(query.start || '')
  const end = String(query.end || '')

  // Read the token once before the loop — avoids a KV round-trip per page.
  const token = await useStorage('kv').getItem<string>('mercury_api_token')

  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Mercury API token not configured' })
  }

  const transactions: unknown[] = []
  let cursor: string | null = null

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams()
    if (start) params.set('start', start)
    if (end) params.set('end', end)
    params.append('status[]', 'sent')
    params.set('limit', String(PAGE_LIMIT))
    params.set('order', 'desc')
    if (cursor) params.set('start_after', cursor)

    let data: MercuryTransactionsPage
    try {
      data = await $fetch<MercuryTransactionsPage>(`${MERCURY_TRANSACTIONS_URL}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch (error) {
      const status =
        error instanceof Error && 'status' in error
          ? (error as { status?: number }).status
          : undefined
      if (status === 401) {
        throw createError({ statusCode: 401, statusMessage: 'Invalid Mercury token' })
      }
      throw createError({ statusCode: 502, statusMessage: 'Mercury API error' })
    }

    const batch = data.transactions ?? []
    transactions.push(...batch)

    // The API returns the next-page cursor; stop when there are no more pages.
    cursor = data.page?.nextPage ?? null
    if (!cursor || batch.length === 0) break
  }

  return transactions
})
