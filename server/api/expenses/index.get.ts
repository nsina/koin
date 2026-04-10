import { db } from '@nuxthub/db'
import { expenses } from '../../db/schema'
import { desc } from 'drizzle-orm'

export default defineEventHandler(async () => {
  return db.select().from(expenses).orderBy(desc(expenses.date))
})
