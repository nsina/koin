import { db } from '@nuxthub/db'
import { settings } from '../../db/schema'

const MASKED_KEYS = ['mercury_api_token']

export default defineEventHandler(async () => {
  const rows = await db.select().from(settings)
  return rows.map((row) =>
    MASKED_KEYS.includes(row.key) && row.value
      ? { ...row, value: '••••' + row.value.slice(-4) }
      : row
  )
})
