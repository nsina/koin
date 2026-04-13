export default defineEventHandler(async () => {
  const token = await useStorage('kv').getItem<string>('mercury_api_token')

  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Mercury API token not configured' })
  }

  try {
    await $fetch('https://api.mercury.com/api/v1/accounts', {
      headers: { Authorization: `Bearer ${token}` }
    })
    return { valid: true }
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 401) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid token' })
    }
    throw createError({
      statusCode: 503,
      statusMessage: 'Mercury API unavailable'
    })
  }
})
