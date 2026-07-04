import { db } from '@nuxthub/db'
import { clientServices } from '../../db/schema'
import { asc } from 'drizzle-orm'

export default defineEventHandler(async () => {
  return db.select().from(clientServices).orderBy(asc(clientServices.startDate))
})
