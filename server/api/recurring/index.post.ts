import { db } from '@nuxthub/db'
import { recurringTemplates } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const [row] = await db.insert(recurringTemplates).values(body).returning()
  return row
})
