import { db } from '@nuxthub/db'
import { mileageTrips } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  await db.delete(mileageTrips).where(eq(mileageTrips.id, id))
  return { ok: true }
})
