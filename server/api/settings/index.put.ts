import { db } from '@nuxthub/db'
import { settings } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as { key: string; value: string }
  const [row] = await db
    .insert(settings)
    .values(body)
    .onConflictDoUpdate({ target: settings.key, set: { value: body.value } })
    .returning()
  return row
})
