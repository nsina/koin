import { db } from '@nuxthub/db'
import { mileageTrips } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const [row] = await db.insert(mileageTrips).values(body).returning()
  return row
})
