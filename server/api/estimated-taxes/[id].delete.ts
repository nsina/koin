import { db } from '@nuxthub/db'
import { estimatedTaxPayments } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  await db.delete(estimatedTaxPayments).where(eq(estimatedTaxPayments.id, id))
  return { ok: true }
})
