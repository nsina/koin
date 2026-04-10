import { db } from '@nuxthub/db'
import { estimatedTaxPayments } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const [row] = await db.insert(estimatedTaxPayments).values(body).returning()
  return row
})
