import { db } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { settings } from '../../db/schema'

export default defineEventHandler(async () => {
  const [tokenRow] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, 'mercury_api_token'))

  if (!tokenRow?.value) {
    throw createError({ statusCode: 400, statusMessage: 'Mercury API token not configured' })
  }

  try {
    await $fetch('https://api.mercury.com/api/v1/accounts', {
      headers: { Authorization: `Bearer ${tokenRow.value}` }
    })
    return { valid: true }
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 401) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid token' })
    }
    throw createError({
      statusCode: 503,
      statusMessage: 'Mercury API unavailable'
    })
  }
})
