import { blob } from '@nuxthub/blob'

export default defineEventHandler(async () => {
  let usedBytes = 0
  let fileCount = 0
  let cursor: string | undefined

  do {
    const {
      blobs,
      hasMore,
      cursor: nextCursor
    } = await blob.list({
      prefix: 'receipts/',
      cursor,
      limit: 1000
    })

    usedBytes += blobs.reduce((total, file) => total + (file.size ?? 0), 0)
    fileCount += blobs.length
    cursor = hasMore ? nextCursor : undefined
  } while (cursor)

  return { usedBytes, fileCount }
})
