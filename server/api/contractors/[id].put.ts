import { db } from '@nuxthub/db'
import { contractors } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const [row] = await db.update(contractors).set(body).where(eq(contractors.id, id)).returning()
  return row
})
