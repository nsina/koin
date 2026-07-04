import { db } from '@nuxthub/db'
import { clientServices } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const [row] = await db
    .update(clientServices)
    .set(body)
    .where(eq(clientServices.id, id))
    .returning()
  return row
})
