import { db } from '@nuxthub/db'
import { expenses } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const [row] = await db.insert(expenses).values(body).returning()
  return row
})
