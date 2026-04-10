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
  'acctverify' // Ally/Plaid micro-deposits for account verification
]

// Mercury "Category" column → our category names
const MERCURY_CATEGORY_MAP: Record<string, string> = {
  // Software
  'Software & Subscriptions': 'Software & Subscriptions',
  Software: 'Software & Subscriptions',
  // Advertising
  'Advertising & Marketing': 'Advertising & Marketing',
  'Marketing & Advertising': 'Advertising & Marketing',
  Marketing: 'Advertising & Marketing',
  Advertising: 'Advertising & Marketing',
  // Contractors
  'Contractor / Freelancer': 'Contractors & Freelancers',
  'Contractors & Freelancers': 'Contractors & Freelancers',
  Contractors: 'Contractors & Freelancers',
  ContractorFreelancer: 'Contractors & Freelancers',
  // Equipment
  'Equipment & Technology': 'Equipment & Hardware',
  'Equipment & Hardware': 'Equipment & Hardware',
  Equipment: 'Equipment & Hardware',
  Technology: 'Equipment & Hardware',
  Hardware: 'Equipment & Hardware',
  // Insurance
  'Business Insurance': 'Business Insurance',
  Insurance: 'Business Insurance',
  // Legal / Professional
  'Professional Services': 'Legal, CPA & Professional',
  'Legal & Professional Services': 'Legal, CPA & Professional',
  'Legal, CPA & Professional': 'Legal, CPA & Professional',
  ProfessionalServices: 'Legal, CPA & Professional',
  Legal: 'Legal, CPA & Professional',
  // Office
  OfficeSupplies: 'Office Supplies',
  'Office Supplies': 'Office Supplies',
  // Travel
  'Business Travel': 'Travel & Lodging',
  'Travel & Lodging': 'Travel & Lodging',
  Travel: 'Travel & Lodging',
  // Meals
  'Meals & Entertainment': 'Meals & Coffee (Business)',
  'Meals & Coffee (Business)': 'Meals & Coffee (Business)',
  Meals: 'Meals & Coffee (Business)',
  'Food & Drink': 'Meals & Coffee (Business)',
  // Phone / Internet
  'Phone & Internet': 'Phone & Internet',
  Utilities: 'Phone & Internet',
  // Education
  'Education & Training': 'Education & Courses',
  'Education & Courses': 'Education & Courses',
  Education: 'Education & Courses',
  // Bank fees
  'Bank & Transaction Fees': 'Bank & Wire Fees',
  'Bank & Wire Fees': 'Bank & Wire Fees',
  BankFees: 'Bank & Wire Fees',
  // Commissions / platform fees
  'Commissions & Platform Fees': 'Platform Fees & Commissions',
  'Platform Fees & Commissions': 'Platform Fees & Commissions',
  Commissions: 'Platform Fees & Commissions',
  // Taxes & licenses
  'Business Taxes & Licenses': 'Business Taxes & Licenses',
  Taxes: 'Business Taxes & Licenses',
  // Rent
  'Rent / Coworking Space': 'Office Rent & Coworking',
  'Office Rent & Coworking': 'Office Rent & Coworking',
  Rent: 'Office Rent & Coworking'
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
        mercuryDetailedCategory || mercuryCategory
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
        mercuryTransactionId: null // CSV imports don't carry the Mercury transaction UUID
      })
    }

    return result
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function detectTransfer(
    direction: 'debit' | 'credit',
    bankDescription: string,
    mercuryCategory: string,
    kind?: string
  ): boolean {
    // API: transaction kind is the most reliable signal
    if (kind === 'internalTransfer' || kind === 'externalTransfer') return true

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

  function suggestCategory(vendor: string, description: string, mercuryCategory: string): string {
    // Use Mercury's detailed category if it maps to one of ours
    if (mercuryCategory) {
      const mapped = MERCURY_CATEGORY_MAP[mercuryCategory]
      if (mapped) return mapped
      // Direct match with our categories
      const direct = findTaxCategoryByName(mercuryCategory)
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
      if (tx.status === 'failed' || tx.status === 'cancelled') continue

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
      let category = suggestCategory(vendor, rawName, detailedCategory)
      // Outgoing ACH payments that didn't match any known vendor are likely
      // contractor payments default to contractor category over generic "other"
      if (category === 'Other / Misc Business' && tx.kind === 'outgoingPayment') {
        category = 'Contractors & Freelancers'
      }
      const defaults = getTaxDefaultsForCategory(category)
      const duplicate = hasDuplicateExpense(date, vendor, amount)

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
        mercuryTransactionId: tx.id
      })
    }

    return result
  }

  return { parseMercuryCsv, mercuryApiToPreviewRows }
}

// ─── Utility: build expense payload from selected preview rows ────────────────

export function mercuryRowToExpense(
  row: MercuryPreviewRow
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
    businessUsePct: 100
  }
}
