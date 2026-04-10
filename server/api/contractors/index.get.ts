import { db } from '@nuxthub/db'
import { contractors } from '../../db/schema'
import { asc } from 'drizzle-orm'

export default defineEventHandler(async () => {
  return db.select().from(contractors).orderBy(asc(contractors.name))
})
