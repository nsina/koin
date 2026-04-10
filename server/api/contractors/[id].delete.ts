import { db } from '@nuxthub/db'
import { contractors } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  await db.delete(contractors).where(eq(contractors.id, id))
  return { ok: true }
})
