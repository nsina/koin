import { db } from '@nuxthub/db'
import { clients } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const [row] = await db.insert(clients).values(body).returning()
  return row
})
