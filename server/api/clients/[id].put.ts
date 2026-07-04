import { db } from '@nuxthub/db'
import { clients } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const [row] = await db.update(clients).set(body).where(eq(clients.id, id)).returning()
  return row
})
