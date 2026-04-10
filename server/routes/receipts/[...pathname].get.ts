import { blob } from '@nuxthub/blob'

export default defineEventHandler(async (event) => {
  const pathname = getRouterParam(event, 'pathname')
  if (!pathname) throw createError({ statusCode: 404 })
  return blob.serve(event, `receipts/${pathname}`)
})
