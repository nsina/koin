import { db } from '@nuxthub/db'
import { mileageTrips } from '../../db/schema'
import { desc } from 'drizzle-orm'

export default defineEventHandler(async () => {
  return db.select().from(mileageTrips).orderBy(desc(mileageTrips.date))
})
