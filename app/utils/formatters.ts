export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

export function formatRate(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  }).format(value)
}

export function formatDateLong(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export function formatDateShort(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

export function round2(value: number) {
  return Math.round(value * 100) / 100
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function getTodayISO() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Converts various date formats to ISO YYYY-MM-DD.
 * Handles:
 *   - Already ISO: YYYY-MM-DD
 *   - Mercury export format: MM-DD-YYYY (e.g. 03-25-2026)
 *   - Slash format: MM/DD/YY or MM/DD/YYYY
 */
export function toISODate(value: string): string {
  const trimmed = value.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  // Mercury: MM-DD-YYYY
  const mercury = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (mercury) {
    return `${mercury[3]}-${mercury[1]}-${mercury[2]}`
  }

  // MM/DD/YY or MM/DD/YYYY
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (slash) {
    const month = (slash[1] ?? '').padStart(2, '0')
    const day = (slash[2] ?? '').padStart(2, '0')
    const year = slash[3]?.length === 2 ? `20${slash[3]}` : (slash[3] ?? '')
    return `${year}-${month}-${day}`
  }

  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  return getTodayISO()
}

export function generateId() {
  return `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function escapeCsv(value: string | number) {
  const s = String(value ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replaceAll('"', '""')}"`
  }
  return s
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

export function isDateInCurrentYear(dateStr: string, now = new Date()) {
  return new Date(`${dateStr}T12:00:00`).getFullYear() === now.getFullYear()
}

export function isDateInCurrentMonth(dateStr: string, now = new Date()) {
  const d = new Date(`${dateStr}T12:00:00`)
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

export function isDateWithinRange(date: string, from?: string, to?: string) {
  if (!from && !to) return true
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

export function getPresetDateRange(preset: string): { from: string; to: string } {
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth() // 0-indexed
  const q = Math.floor(m / 3) // 0-indexed quarter

  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = (yr: number, mo: number, day: number) => `${yr}-${pad(mo + 1)}-${pad(day)}`
  const lastDayOf = (yr: number, mo: number) => new Date(yr, mo + 1, 0).getDate()

  switch (preset) {
    case 'this-month':
      return { from: iso(y, m, 1), to: iso(y, m, lastDayOf(y, m)) }
    case 'this-quarter': {
      const qs = q * 3
      return { from: iso(y, qs, 1), to: iso(y, qs + 2, lastDayOf(y, qs + 2)) }
    }
    case 'this-year':
      return { from: iso(y, 0, 1), to: iso(y, 11, 31) }
    case 'last-month': {
      const lm = m === 0 ? 11 : m - 1
      const ly = m === 0 ? y - 1 : y
      return { from: iso(ly, lm, 1), to: iso(ly, lm, lastDayOf(ly, lm)) }
    }
    case 'last-quarter': {
      const lq = q === 0 ? 3 : q - 1
      const lqy = q === 0 ? y - 1 : y
      const lqs = lq * 3
      return { from: iso(lqy, lqs, 1), to: iso(lqy, lqs + 2, lastDayOf(lqy, lqs + 2)) }
    }
    case 'last-year':
      return { from: iso(y - 1, 0, 1), to: iso(y - 1, 11, 31) }
    default: // 'all-time'
      return { from: '', to: '' }
  }
}

export function getQuarterInfo(preset: 'this' | 'last'): { q: number; year: number } {
  const today = new Date()
  const m = today.getMonth()
  const y = today.getFullYear()
  const q = Math.floor(m / 3) + 1 // 1-indexed
  if (preset === 'this') return { q, year: y }
  const lq = q === 1 ? 4 : q - 1
  return { q: lq, year: q === 1 ? y - 1 : y }
}

export function advanceDate(
  isoDate: string,
  frequency: 'monthly' | 'quarterly' | 'annually'
): string {
  const d = new Date(`${isoDate}T12:00:00`)
  if (frequency === 'monthly') {
    d.setMonth(d.getMonth() + 1)
  } else if (frequency === 'quarterly') {
    d.setMonth(d.getMonth() + 3)
  } else {
    d.setFullYear(d.getFullYear() + 1)
  }
  return d.toISOString().slice(0, 10)
}

export function downloadFile(fileName: string, data: string, mimeType: string) {
  if (!import.meta.client) return
  const blob = new Blob([data], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
