import { db } from '@nuxthub/db'
import { blob } from '@nuxthub/blob'
import {
  contractors,
  estimatedTaxPayments,
  expenses,
  mileageTrips,
  recurringTemplates
} from '../../db/schema'

const DELETE_CONFIRMATION = 'DELETE'

type WipePayload = {
  confirmation?: string
}

async function deleteAllBlobs() {
  let cursor: string | undefined

  do {
    const { blobs, hasMore, cursor: nextCursor } = await blob.list({ cursor, limit: 1000 })
    if (blobs.length > 0) {
      await blob.del(blobs.map((file) => file.pathname))
    }
    cursor = hasMore ? nextCursor : undefined
  } while (cursor)
}

export default defineEventHandler(async (event) => {
  const body = await readBody<WipePayload>(event)

  if (body?.confirmation !== DELETE_CONFIRMATION) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid confirmation. Type DELETE to continue.'
    })
  }

  await db.delete(expenses)
  await db.delete(mileageTrips)
  await db.delete(contractors)
  await db.delete(recurringTemplates)
  await db.delete(estimatedTaxPayments)
  await useStorage('kv').clear()

  await deleteAllBlobs()

  return { ok: true }
})
