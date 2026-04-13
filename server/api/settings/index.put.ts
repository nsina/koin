export default defineEventHandler(async (event) => {
  const body = await readBody(event) as { key: string; value: string }
  await useStorage('kv').setItem(body.key, body.value)
  return { key: body.key, value: body.value }
})
