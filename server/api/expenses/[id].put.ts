import { blob } from '@nuxthub/blob'
import { db } from '@nuxthub/db'
import { expenses } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  if (body.receipts !== undefined) {
    const [old] = await db.select({ receipts: expenses.receipts }).from(expenses).where(eq(expenses.id, id))
    const oldKeys: string[] = old?.receipts ?? []
    const newKeys: string[] = body.receipts
    const removed = oldKeys.filter((k) => !newKeys.includes(k))
    if (removed.length > 0) await blob.del(removed)
  }
  const [row] = await db.update(expenses).set(body).where(eq(expenses.id, id)).returning()
  return row
})
