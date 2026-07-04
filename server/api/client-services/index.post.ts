import { db } from '@nuxthub/db'
import { clientServices } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const [row] = await db.insert(clientServices).values(body).returning()
  return row
})
