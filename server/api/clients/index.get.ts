import { db } from '@nuxthub/db'
import { clients } from '../../db/schema'
import { asc } from 'drizzle-orm'

export default defineEventHandler(async () => {
  return db.select().from(clients).orderBy(asc(clients.name))
})
