import { blob } from '@nuxthub/blob'
import { db } from '@nuxthub/db'
import { expenses } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const [row] = await db.select({ receipts: expenses.receipts }).from(expenses).where(eq(expenses.id, id))
  if (row?.receipts) {
    const pathnames: string[] = JSON.parse(row.receipts)
    if (pathnames.length > 0) await blob.del(pathnames)
  }
  await db.delete(expenses).where(eq(expenses.id, id))
  return { ok: true }
})
