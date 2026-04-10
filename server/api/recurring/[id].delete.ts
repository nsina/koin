import { db } from '@nuxthub/db'
import { recurringTemplates } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  await db.delete(recurringTemplates).where(eq(recurringTemplates.id, id))
  return { ok: true }
})
