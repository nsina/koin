import { db } from '@nuxthub/db'
import { recurringTemplates } from '../../db/schema'
import { asc } from 'drizzle-orm'

export default defineEventHandler(async () => {
  return db.select().from(recurringTemplates).orderBy(asc(recurringTemplates.nextDueDate))
})
