import { db } from '@nuxthub/db'
import { estimatedTaxPayments } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const [row] = await db.update(estimatedTaxPayments).set(body).where(eq(estimatedTaxPayments.id, id)).returning()
  return row
})
