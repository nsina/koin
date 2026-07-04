import { db } from '@nuxthub/db'
import { clientServices } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  await db.delete(clientServices).where(eq(clientServices.id, id))
  return { ok: true }
})
