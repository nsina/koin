import { db } from '@nuxthub/db'
import { estimatedTaxPayments } from '../../db/schema'
import { eq, asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const year = Number(query.year ?? new Date().getFullYear())
  return db
    .select()
    .from(estimatedTaxPayments)
    .where(eq(estimatedTaxPayments.year, year))
    .orderBy(asc(estimatedTaxPayments.quarter))
})
