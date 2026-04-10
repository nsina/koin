import { db } from '@nuxthub/db'
import { contractors } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const [row] = await db.insert(contractors).values(body).returning()
  return row
})
