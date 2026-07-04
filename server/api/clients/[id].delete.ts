import { db } from '@nuxthub/db'
import { clientServices, clients } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  await db.delete(clientServices).where(eq(clientServices.clientId, id))
  await db.delete(clients).where(eq(clients.id, id))
  return { ok: true }
})
