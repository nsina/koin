import { blob } from '@nuxthub/blob'
import { db } from '@nuxthub/db'
import { expenses } from '../../db/schema'
import { inArray } from 'drizzle-orm'

type BulkPayload =
  | { action: 'insert'; rows: (typeof expenses.$inferInsert)[] }
  | { action: 'delete'; ids: string[] }
  | {
      action: 'update'
      ids: string[]
      patch: { clientBillable?: boolean; taxDeductible?: boolean; category?: string }
    }

export default defineEventHandler(async (event) => {
  const body = await readBody<BulkPayload>(event)

  if (body.action === 'insert') {
    if (body.rows.length === 0) return []
    // D1 limits 100 bound params per query; 18 columns → max 5 rows per insert
    const results = []
    for (let i = 0; i < body.rows.length; i += 5) {
      const rows = await db
        .insert(expenses)
        .values(body.rows.slice(i, i + 5))
        .returning()
      results.push(...rows)
    }
    return results
  }

  if (body.action === 'delete') {
    if (body.ids.length === 0) return { ok: true }
    // D1 limits 100 bound params; chunk IDs to stay under
    for (let i = 0; i < body.ids.length; i += 80) {
      const chunk = body.ids.slice(i, i + 80)
      const rows = await db
        .select({ receipts: expenses.receipts })
        .from(expenses)
        .where(inArray(expenses.id, chunk))
      const pathnames = rows.flatMap((r) => r.receipts ?? [])
      if (pathnames.length > 0) await blob.del(pathnames)
      await db.delete(expenses).where(inArray(expenses.id, chunk))
    }
    return { ok: true }
  }

  if (body.action === 'update') {
    if (body.ids.length === 0) return { ok: true }
    const updatedAt = new Date().toISOString()
    // D1 limits 100 bound params; chunk IDs to stay under
    for (let i = 0; i < body.ids.length; i += 80) {
      const chunk = body.ids.slice(i, i + 80)
      await db
        .update(expenses)
        .set({ ...body.patch, updatedAt })
        .where(inArray(expenses.id, chunk))
    }
    return { ok: true }
  }

  throw createError({ statusCode: 400, message: 'Invalid bulk action' })
})
