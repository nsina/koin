// IRS filing deadlines are rule-derivable, so we generate them instead of hardcoding.
// A statutory date that lands on a weekend or legal holiday rolls to the next
// business day (IRC §7503). We model US federal holidays plus Emancipation Day
// (a DC holiday the IRS observes — the reason April 15 sometimes slips to the 17th/18th).

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

/** Day of week for an ISO date, computed in a tz-safe way (0 = Sun … 6 = Sat). */
function dowOf(isoDate: string): number {
  return new Date(`${isoDate}T12:00:00`).getDay()
}

/** nth weekday of a month, e.g. nthWeekday(2026, 1, 1, 3) = 3rd Monday of January. */
function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  const firstDow = new Date(`${iso(year, month, 1)}T12:00:00`).getDay()
  const offset = (weekday - firstDow + 7) % 7
  return iso(year, month, 1 + offset + (n - 1) * 7)
}

/** Last given weekday of a month, e.g. last Monday of May (Memorial Day). */
function lastWeekday(year: number, month: number, weekday: number): string {
  const lastDay = new Date(year, month, 0).getDate()
  const lastDow = new Date(`${iso(year, month, lastDay)}T12:00:00`).getDay()
  return iso(year, month, lastDay - ((lastDow - weekday + 7) % 7))
}

/** Observed date for a fixed-date holiday: Sat → preceding Fri, Sun → following Mon. */
function observed(year: number, month: number, day: number): string {
  const dow = dowOf(iso(year, month, day))
  if (dow === 6) return addDays(iso(year, month, day), -1)
  if (dow === 0) return addDays(iso(year, month, day), 1)
  return iso(year, month, day)
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`)
  d.setDate(d.getDate() + days)
  return iso(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

/** Set of ISO dates the IRS treats as non-business days for a given year. */
function federalHolidays(year: number): Set<string> {
  return new Set([
    observed(year, 1, 1), // New Year's Day
    nthWeekday(year, 1, 1, 3), // MLK Jr. Day — 3rd Mon Jan
    nthWeekday(year, 2, 1, 3), // Washington's Birthday — 3rd Mon Feb
    observed(year, 4, 16), // Emancipation Day (DC) — shifts the April filing deadline
    lastWeekday(year, 5, 1), // Memorial Day — last Mon May
    observed(year, 6, 19), // Juneteenth
    observed(year, 7, 4), // Independence Day
    nthWeekday(year, 9, 1, 1), // Labor Day — 1st Mon Sep
    nthWeekday(year, 10, 1, 2), // Columbus Day — 2nd Mon Oct
    observed(year, 11, 11), // Veterans Day
    nthWeekday(year, 11, 4, 4), // Thanksgiving — 4th Thu Nov
    observed(year, 12, 25), // Christmas Day
  ])
}

/** Roll an ISO date forward to the next weekday that isn't a federal holiday. */
export function nextBusinessDay(isoDate: string): string {
  let date = isoDate
  let holidays = federalHolidays(Number(date.slice(0, 4)))
  let guard = 0
  while ((dowOf(date) === 0 || dowOf(date) === 6 || holidays.has(date)) && guard < 10) {
    date = addDays(date, 1)
    if (date.slice(5) === '01-01') holidays = federalHolidays(Number(date.slice(0, 4)))
    guard++
  }
  return date
}

/**
 * The four quarterly 1040-ES due dates for a tax year, adjusted for weekends/holidays.
 * Q4 is due in January of the following calendar year.
 */
export function getEstimatedTaxDueDates(taxYear: number): { quarter: string; dueDate: string }[] {
  return [
    { quarter: 'Q1', dueDate: nextBusinessDay(iso(taxYear, 4, 15)) },
    { quarter: 'Q2', dueDate: nextBusinessDay(iso(taxYear, 6, 15)) },
    { quarter: 'Q3', dueDate: nextBusinessDay(iso(taxYear, 9, 15)) },
    { quarter: 'Q4', dueDate: nextBusinessDay(iso(taxYear + 1, 1, 15)) },
  ]
}

export interface ImportantTaxDate {
  date: string
  event: string
  note: string
}

/** Statutory deadlines for a filing calendar year, before business-day adjustment. */
interface DeadlineRule {
  month: number
  day: number
  /** Label may reference the filing year to derive the relevant tax year. */
  event: (filingYear: number) => string
  note?: string
}

const DEADLINE_RULES: DeadlineRule[] = [
  { month: 1, day: 15, event: (y) => `Q4 ${y - 1} estimated tax due`, note: 'Form 1040-ES' },
  { month: 1, day: 31, event: () => '1099-NEC due to recipients & IRS' },
  { month: 1, day: 31, event: () => '1099-MISC due to recipients', note: 'Feb 15 for box 8 or 10' },
  { month: 1, day: 31, event: () => 'W-2 forms due to employees & SSA' },
  {
    month: 1,
    day: 31,
    event: () => 'Form 941 (Q4) & Form 940 FUTA due',
    note: 'Employer payroll tax',
  },
  { month: 2, day: 28, event: () => '1099-MISC paper filing due to IRS' },
  { month: 4, day: 30, event: () => 'Form 941 (Q1) due', note: 'Employer payroll tax' },
  { month: 7, day: 31, event: () => 'Form 941 (Q2) due', note: 'Employer payroll tax' },
  { month: 10, day: 31, event: () => 'Form 941 (Q3) due', note: 'Employer payroll tax' },
  { month: 3, day: 15, event: () => 'S-Corp (1120-S) & Partnership (1065) returns due' },
  { month: 3, day: 15, event: () => 'S-Corp/Partnership extension deadline (Form 7004)' },
  { month: 3, day: 31, event: () => '1099-MISC e-filing deadline with IRS' },
  { month: 4, day: 15, event: (y) => `Individual return (Form 1040) due — Tax Year ${y - 1}` },
  { month: 4, day: 15, event: (y) => `Q1 ${y} estimated tax due`, note: 'Form 1040-ES' },
  { month: 4, day: 15, event: () => 'C-Corp (Form 1120) return due' },
  { month: 6, day: 15, event: (y) => `Q2 ${y} estimated tax due`, note: 'Form 1040-ES' },
  { month: 9, day: 15, event: (y) => `Q3 ${y} estimated tax due`, note: 'Form 1040-ES' },
  { month: 9, day: 15, event: () => 'Extended S-Corp/Partnership return deadline' },
  { month: 10, day: 15, event: () => 'Extended individual return deadline (Form 1040)' },
  { month: 10, day: 15, event: () => 'Extended C-Corp return deadline (Form 1120)' },
  {
    month: 12,
    day: 15,
    event: () => 'C-Corp Q4 estimated tax due',
    note: 'Calendar-year corporations',
  },
]

/** Generate the important IRS dates across the given inclusive range of filing years. */
export function getImportantTaxDates(fromYear: number, throughYear: number): ImportantTaxDate[] {
  const dates: ImportantTaxDate[] = []
  for (let year = fromYear; year <= throughYear; year++) {
    for (const rule of DEADLINE_RULES) {
      const statutory = iso(year, rule.month, rule.day)
      const adjusted = nextBusinessDay(statutory)
      const note = adjusted !== statutory ? bumpNote(statutory, rule.note) : (rule.note ?? '')
      dates.push({ date: adjusted, event: rule.event(year), note })
    }
  }
  return dates.sort((a, b) => a.date.localeCompare(b.date))
}

/** Explain why an adjusted date differs from its statutory date, preserving any form note. */
function bumpNote(statutory: string, note?: string): string {
  const weekday = new Date(`${statutory}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' })
  const reason = `${statutory.slice(5)} fell on a ${weekday}/holiday`
  return note ? `${note} · ${reason}` : reason
}
