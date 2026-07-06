import type { Expense } from './useExpenseStore'
import { VENDOR_CATEGORY_RULES } from './useExpenseStore'
import { findTaxCategoryByName } from '../utils/taxRules'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MercuryPreviewRow {
  id: string
  date: string
  description: string // raw Mercury "Description" field (vendor/payee)
  bankDescription: string // Mercury "Bank Description" field (transfer context)
  vendor: string // cleaned display name
  amount: number // absolute value
  direction: 'debit' | 'credit'
  isTransfer: boolean
  paymentMethod: string
  category: string
  taxDeductible: boolean
  deductiblePct: number
  duplicate: boolean
  selected: boolean
  trackingId: string
  mercuryCategory: string
  mercuryTransactionId: string | null // Mercury transaction UUID for dashboard deep-link
}

// ─── Mercury API transaction shape (minimal fields we consume) ──────────────

export interface MercuryApiTransaction {
  id: string
  amount: number
  status: string
  kind: string
  counterpartyName: string
  counterpartyNickname: string | null
  createdAt: string
  postedAt: string | null
  bankDescription: string | null
  externalMemo: string | null
  note: string | null
  mercuryCategory: string | null
  categoryData: { id: string; name: string } | null
  dashboardLink: string
}

// ─── Transfer detection patterns ─────────────────────────────────────────────

const TRANSFER_BANK_DESCRIPTIONS = [
  'transfer from mercury to another bank account',
  'transfer between your mercury accounts',
  'acctverify', // Ally/Plaid micro-deposits for account verification
]

// Mercury category names → our category names.
// Two distinct vocabularies feed this map:
//   1. The live API returns `mercuryCategory` as a fixed PascalCase enum
//      (e.g. "Software", "Advertising"). Verified against
//      https://docs.mercury.com/reference/listtransactions (MercuryCategory enum).
//   2. The CSV export's "Mercury Category" / "Category" columns use Mercury's
//      human-readable UI labels (e.g. "Marketing & Advertising").
// Both are keyed here so API and CSV imports get the same Tier-1 categorization.
const MERCURY_CATEGORY_MAP: Record<string, string> = {
  // ── API `mercuryCategory` enum values ──
  Software: 'Software & Subscriptions',
  Memberships: 'Software & Subscriptions',
  Advertising: 'Advertising & Marketing',
  Legal: 'Legal, CPA & Professional',
  ProfessionalServices: 'Legal, CPA & Professional',
  Insurance: 'Business Insurance',
  OfficeSupplies: 'Office Supplies',
  Electronics: 'Equipment & Hardware',
  Restaurants: 'Meals & Coffee (Business)',
  FoodDelivery: 'Meals & Coffee (Business)',
  AlcoholAndBars: 'Meals & Coffee (Business)',
  Entertainment: 'Meals & Coffee (Business)',
  Airlines: 'Travel & Lodging',
  Lodging: 'Travel & Lodging',
  CarRental: 'Travel & Lodging',
  OtherTravel: 'Travel & Lodging',
  GroundTransportation: 'Travel & Lodging',
  RideshareAndTaxis: 'Travel & Lodging',
  FuelAndGas: 'Vehicle & Gas',
  VehicleExpenses: 'Vehicle & Gas',
  Parking: 'Vehicle & Gas',
  InternetAndTelephone: 'Phone & Internet',
  Utilities: 'Office Rent & Coworking',
  FacilitiesExpenses: 'Office Rent & Coworking',
  Taxes: 'Business Taxes & Licenses',
  GovernmentServices: 'Business Taxes & Licenses',
  Fees: 'Bank & Wire Fees',
  Education: 'Education & Courses',
  Conferences: 'Education & Courses',
  BooksAndNewspaper: 'Education & Courses',
  // Personal/non-business-leaning enums default to misc; user reviews in preview
  Charity: 'Other / Misc Business',
  Medical: 'Other / Misc Business',
  Shipping: 'Other / Misc Business',
  Retail: 'Other / Misc Business',
  Grocery: 'Other / Misc Business',
  Clothing: 'Other / Misc Business',
  Gambling: 'Other / Misc Business',
  Political: 'Other / Misc Business',
  Other: 'Other / Misc Business',

  // ── CSV "Mercury Category" / "Category" display labels ──
  'Software & Subscriptions': 'Software & Subscriptions',
  'Marketing & Advertising': 'Advertising & Marketing',
  'Legal & Professional Services': 'Legal, CPA & Professional',
  'Office Supplies & Equipment': 'Office Supplies',
  'Travel & Transportation': 'Travel & Lodging',
  'Payment Processing Fees': 'Platform Fees & Commissions',
  'Rent & Utilities': 'Office Rent & Coworking',
  Payroll: 'Contractors & Freelancers',
  COGS: 'Other / Misc Business',
  'Shipping & Postage': 'Other / Misc Business',
  'Employee Benefits': 'Other / Misc Business',
  'Inventory & Materials': 'Other / Misc Business',
  'Credit & Loan Payments': 'Other / Misc Business',
  // Income/transfer categories — flagged as non-expense by transfer detection upstream
  'Financing Proceeds': "Owner's Draw / Personal Transfer",
  'Interest Earned': 'Other / Misc Business',
  Transfer: "Owner's Draw / Personal Transfer",
  Revenue: 'Other / Misc Business',
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useMercuryImport() {
  const { getTaxDefaultsForCategory, hasDuplicateExpense } = useExpenseStore()

  /**
   * Parse a Mercury bank CSV export and return classified preview rows.
   *
   * Mercury CSV column reference (actual export format):
   *   Date (UTC)        MM-DD-YYYY
   *   Description       Vendor/payee name (often messy)
   *   Amount            Negative = debit (outgoing). Positive = credit (incoming).
   *   Status            Sent | Failed
   *   Source Account    Which Mercury account
   *   Bank Description  Critical for transfer detection
   *   Note              User-added note from Mercury
   *   Mercury Category  High-level: Revenue, Transfer, Software, etc.
   *   Category          Detailed: Software & Subscriptions, etc.
   *   Tracking ID       For duplicate detection
   */
  function parseMercuryCsv(csvText: string): MercuryPreviewRow[] {
    const rows = parseCsvRows(csvText)
    if (rows.length < 2) return []

    const headers = (rows[0] ?? []).map((h) => h.toLowerCase().trim())

    const col = (names: string[]) => headers.findIndex((h) => names.includes(h))

    const dateIdx = col(['date (utc)', 'date', 'posted date'])
    const descIdx = col(['description', 'merchant', 'memo', 'name'])
    const amountIdx = col(['amount', 'amount usd', 'amount (usd)'])
    const statusIdx = col(['status'])
    const bankDescIdx = col(['bank description'])
    const noteIdx = col(['note'])
    const mercuryCatIdx = col(['mercury category'])
    const categoryIdx = col(['category'])
    const trackingIdx = col(['tracking id', 'tracking_id', 'reference'])

    const result: MercuryPreviewRow[] = []

    for (const row of rows.slice(1)) {
      const status = (row[statusIdx] ?? '').trim()
      if (status.toLowerCase() === 'failed') continue

      const rawDate = (row[dateIdx] ?? '').trim()
      const rawDescription = (row[descIdx] ?? '').trim()
      if (!rawDescription) continue

      const rawAmount = row[amountIdx] ?? ''
      const signedAmount = parseCurrencyNumber(rawAmount)
      if (signedAmount === 0) continue

      const direction: 'debit' | 'credit' = signedAmount < 0 ? 'debit' : 'credit'
      const amount = Math.abs(signedAmount)

      const bankDescription = (row[bankDescIdx] ?? '').trim()
      const note = (row[noteIdx] ?? '').trim()
      const mercuryCategory = (row[mercuryCatIdx] ?? '').trim()
      const mercuryDetailedCategory = (row[categoryIdx] ?? '').trim()
      const trackingId = (row[trackingIdx] ?? '').trim()

      const isTransfer = detectTransfer(direction, bankDescription, mercuryCategory)

      const date = toISODate(rawDate)
      const vendor = inferVendor(rawDescription)
      const category = suggestCategory(
        vendor,
        rawDescription,
        mercuryDetailedCategory,
        mercuryCategory,
      )
      const defaults = getTaxDefaultsForCategory(category)
      const duplicate = hasDuplicateExpense(date, vendor, amount)

      // Pre-select: debits that are not transfers and not duplicates
      const selected = direction === 'debit' && !isTransfer && !duplicate

      const description = note || rawDescription

      result.push({
        id: generateId(),
        date,
        description,
        bankDescription,
        vendor,
        amount,
        direction,
        isTransfer,
        paymentMethod: direction === 'credit' ? 'Mercury ACH' : 'Mercury Debit',
        category,
        taxDeductible: defaults.taxDeductible,
        deductiblePct: defaults.deductiblePct,
        duplicate,
        selected,
        trackingId,
        mercuryCategory,
        mercuryTransactionId: null, // CSV imports don't carry the Mercury transaction UUID
      })
    }

    return result
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function detectTransfer(
    direction: 'debit' | 'credit',
    bankDescription: string,
    mercuryCategory: string,
    kind?: string,
  ): boolean {
    // API: transaction kind is the most reliable signal
    if (kind === 'internalTransfer' || kind === 'externalTransfer' || kind === 'treasuryTransfer')
      return true

    const lowerBank = bankDescription.toLowerCase()
    const lowerCat = mercuryCategory.toLowerCase()

    // Explicit transfer bank descriptions
    if (TRANSFER_BANK_DESCRIPTIONS.some((p) => lowerBank.includes(p))) return true

    // Mercury marks credits as Revenue or Transfer
    if (direction === 'credit') {
      if (lowerCat === 'transfer' || lowerCat === 'revenue') return true
    }

    // Debit flagged as transfer by Mercury
    if (lowerCat === 'transfer') return true

    return false
  }

  function suggestCategory(
    vendor: string,
    description: string,
    ...categoryHints: string[]
  ): string {
    // Try each Mercury-provided category hint in priority order (e.g. a custom
    // category name first, then the API enum). First hint that maps to one of
    // our categories wins.
    for (const hint of categoryHints) {
      if (!hint) continue
      const mapped = MERCURY_CATEGORY_MAP[hint]
      if (mapped) return mapped
      const direct = findTaxCategoryByName(hint)
      if (direct) return direct.name
    }

    // Keyword matching on vendor + description
    const normalized = `${vendor} ${description}`.toLowerCase()
    for (const [cat, keywords] of Object.entries(VENDOR_CATEGORY_RULES)) {
      if (keywords.some((kw) => normalized.includes(kw))) return cat
    }

    return 'Other / Misc Business'
  }

  function inferVendor(description: string): string {
    let text = description

    // Strip parenthetical account info: "(Chase - Checking xx7168)"
    text = text.replace(/\s*\([^)]*\)\s*/g, '').trim()

    // Take first part if semicolon-delimited (e.g. "STRIPE; TRANSFER; KOPPLA LLC")
    if (text.includes(';')) {
      text = text.split(';')[0]?.trim() ?? text
    }

    // Strip leading digits/slashes (check deposits like "1/LEROY A STEELE...")
    text = text.replace(/^\d+\//, '').trim()

    // Convert ALL-CAPS to title case for readability
    if (text.length > 1 && text === text.toUpperCase()) {
      text = text.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    }

    return text.slice(0, 80).trim() || 'Unknown Vendor'
  }

  function parseCsvRows(content: string): string[][] {
    const rows: string[][] = []
    let cell = ''
    let row: string[] = []
    let inQuotes = false

    for (let i = 0; i < content.length; i++) {
      const ch = content[i]
      const next = content[i + 1]

      if (ch === '"') {
        if (inQuotes && next === '"') {
          cell += '"'
          i++
        } else inQuotes = !inQuotes
        continue
      }
      if (ch === ',' && !inQuotes) {
        row.push(cell)
        cell = ''
        continue
      }
      if ((ch === '\n' || ch === '\r') && !inQuotes) {
        if (ch === '\r' && next === '\n') i++
        row.push(cell)
        if (row.some((c) => c.trim())) rows.push(row)
        row = []
        cell = ''
        continue
      }
      cell += ch
    }

    row.push(cell)
    if (row.some((c) => c.trim())) rows.push(row)
    return rows
  }

  function parseCurrencyNumber(value: string): number {
    const cleaned = String(value ?? '').trim()
    if (!cleaned) return 0
    const isNegative = cleaned.startsWith('-') || (cleaned.includes('(') && cleaned.includes(')'))
    const normalized = cleaned.replace(/[$,()\s]/g, '')
    const parsed = Number(normalized)
    if (!Number.isFinite(parsed)) return 0
    return isNegative ? -Math.abs(parsed) : Math.abs(parsed)
  }

  function mercuryApiToPreviewRows(transactions: MercuryApiTransaction[]): MercuryPreviewRow[] {
    const result: MercuryPreviewRow[] = []

    for (const tx of transactions) {
      // Server pre-filters to status=sent; guard defensively against any other
      // status (pending, cancelled, failed, reversed, blocked) reaching here.
      if (tx.status !== 'sent') continue

      const direction: 'debit' | 'credit' = tx.amount < 0 ? 'debit' : 'credit'
      const amount = Math.abs(tx.amount)
      if (amount === 0) continue

      const rawName = tx.counterpartyName || ''
      if (!rawName) continue

      const bankDescription = tx.bankDescription || ''
      const note = tx.note || ''
      const mercuryCategory = tx.mercuryCategory || ''
      const detailedCategory = tx.categoryData?.name || mercuryCategory

      const isTransfer = detectTransfer(direction, bankDescription, detailedCategory, tx.kind)

      const dateStr = tx.postedAt || tx.createdAt
      const date = dateStr ? dateStr.slice(0, 10) : ''
      if (!date) continue

      const vendor = inferVendor(rawName)
      // Prefer the user's custom category name, then fall back to Mercury's enum.
      // Unmatched payments stay 'Other / Misc Business' for conscious review rather
      // than being guessed into a category (a blind contractor default mislabels
      // rent, reimbursements, and owner's draws as 100%-deductible contract labor).
      const category = suggestCategory(
        vendor,
        rawName,
        tx.categoryData?.name || '',
        mercuryCategory,
      )
      const defaults = getTaxDefaultsForCategory(category)
      const duplicate = hasDuplicateExpense(date, vendor, amount, tx.id)

      const selected = direction === 'debit' && !isTransfer && !duplicate
      const description = note || tx.externalMemo || rawName

      // outgoingPayment = ACH send-money; all other debits come from the debit card
      const paymentMethod =
        direction === 'credit' || tx.kind === 'outgoingPayment' ? 'Mercury ACH' : 'Mercury Debit'

      result.push({
        id: generateId(),
        date,
        description,
        bankDescription,
        vendor,
        amount,
        direction,
        isTransfer,
        paymentMethod,
        category,
        taxDeductible: defaults.taxDeductible,
        deductiblePct: defaults.deductiblePct,
        duplicate,
        selected,
        trackingId: tx.id,
        mercuryCategory,
        mercuryTransactionId: tx.id,
      })
    }

    return result
  }

  return { parseMercuryCsv, mercuryApiToPreviewRows }
}

// ─── Utility: build expense payload from selected preview rows ────────────────

export function mercuryRowToExpense(
  row: MercuryPreviewRow,
): Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    date: row.date,
    vendor: row.vendor,
    amount: row.amount,
    category: row.category,
    description: row.description,
    paymentMethod: row.paymentMethod,
    clientBillable: false,
    taxDeductible: row.taxDeductible,
    deductiblePct: row.deductiblePct,
    receipts: [],
    source: 'mercury',
    mercuryTransactionId: row.mercuryTransactionId,
    contractorId: null,
    section179: false,
    businessUsePct: 100,
  }
}
