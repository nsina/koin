import { blob } from '@nuxthub/blob'

export default defineEventHandler(async (event) => {
  return blob.handleUpload(event, {
    ensure: {
      maxSize: '8MB',
      types: ['image/jpeg', 'image/png', 'application/pdf']
    },
    put: { prefix: 'receipts/', addRandomSuffix: true }
  })
})
