import { db } from '@nuxthub/db'
import { recurringTemplates } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const [row] = await db.update(recurringTemplates).set(body).where(eq(recurringTemplates.id, id)).returning()
  return row
})
