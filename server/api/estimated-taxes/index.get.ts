import { db } from '@nuxthub/db'
import { estimatedTaxPayments } from '../../db/schema'
import { eq, asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  // No year param (or year=all) returns every payment — used by full backup export.
  if (query.year === undefined || query.year === 'all') {
    return db
      .select()
      .from(estimatedTaxPayments)
      .orderBy(asc(estimatedTaxPayments.year), asc(estimatedTaxPayments.quarter))
  }
  const year = Number(query.year)
  return db
    .select()
    .from(estimatedTaxPayments)
    .where(eq(estimatedTaxPayments.year, year))
    .orderBy(asc(estimatedTaxPayments.quarter))
})
