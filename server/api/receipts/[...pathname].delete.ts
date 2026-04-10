import { blob } from '@nuxthub/blob'

export default defineEventHandler(async (event) => {
  const pathname = getRouterParam(event, 'pathname')
  if (!pathname) throw createError({ statusCode: 404 })
  await blob.delete(pathname)
  return { ok: true }
})
