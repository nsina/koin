import { TAX_CATEGORIES, findTaxCategoryByName } from '../utils/taxRules'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Expense {
  id: string
  date: string
  vendor: string
  amount: number
  category: string
  description: string
  paymentMethod: string
  clientBillable: boolean
  taxDeductible: boolean
  deductiblePct: number
  receipts: string[]
  source: 'manual' | 'mercury'
  mercuryTransactionId: string | null
  contractorId: string | null
  section179: boolean
  businessUsePct: number
  createdAt: string
  updatedAt: string
}

export interface MileageTrip {
  id: string
  date: string
  from: string
  to: string
  miles: number
  purpose: string
  createdAt: string
}

export interface ExpenseDraft {
  date: string
  vendor: string
  amount: number
  category: string
  description: string
  paymentMethod: string
  clientBillable: boolean
  taxDeductible: boolean
  deductiblePct: number
  receiptKeys: string[]
  contractorId: string | null
  section179: boolean
  businessUsePct: number
  isRecurring: boolean
  recurringFrequency: 'monthly' | 'quarterly' | 'annually'
  recurringAutoAdd: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const PAYMENT_METHODS = ['Mercury Debit', 'Mercury ACH', 'Credit Card', 'Cash']

export const DEFAULT_CATEGORY = TAX_CATEGORIES[0]!.name
export const DEFAULT_PAYMENT_METHOD = PAYMENT_METHODS[0]!

export const VENDOR_CATEGORY_RULES: Record<string, string[]> = {
  'Software & Subscriptions': [
    'adobe',
    'figma',
    'notion',
    'slack',
    'openai',
    'cursor',
    'github',
    'zoom',
    'google workspace',
    'dropbox',
    'linear',
    'anthropic',
    'claude',
    'perplexity',
    'vercel',
    'cloudflare',
    'supabase',
    'webflow',
    'framer',
    'loom',
    'granola',
    'cleanshot',
    'paddle',
    'mtw'
  ],
  'Advertising & Marketing': [
    'meta',
    'facebook',
    'google ads',
    'linkedin',
    'x ads',
    'mailchimp',
    'hubspot',
    'sticker mule'
  ],
  'Platform Fees & Commissions': ['stripe fee', 'paypal fee', 'gumroad', 'lemon squeezy'],
  'Contractors & Freelancers': [
    'upwork',
    'fiverr',
    'contractor',
    'freelancer',
    'send money',
    'gusto',
    'deel'
  ],
  'Equipment & Hardware': ['apple', 'dell', 'bestbuy', 'amazon', 'newegg', 'b&h', 'adorama'],
  'Business Insurance': ['hiscox', 'next insurance', 'embroker', 'coalition'],
  'Legal, CPA & Professional': [
    'attorney',
    'legal',
    'cpa',
    'bookkeeper',
    'accounting',
    'mcpherson',
    'law'
  ],
  'Office Supplies': ['staples', 'office depot', 'officemax'],
  'Meals & Coffee (Business)': ['uber eats', 'doordash', 'grubhub', 'restaurant', 'cafe'],
  'Travel & Lodging': ['uber', 'lyft', 'airbnb', 'hilton', 'delta', 'united', 'southwest'],
  'Phone & Internet': ['verizon', 'att', 't-mobile', 'comcast', 'xfinity'],
  'Bank & Wire Fees': ['stripe fee', 'wire fee', 'monthly fee', 'bank fee']
}

// ─── Singleton state (module-level — shared across all composable usages) ─────

const expenses = ref<Expense[]>([])
const mileageTrips = ref<MileageTrip[]>([])
// Initialized once on first client mount; null during SSR so time-dependent
// computeds return neutral values rather than capturing a stale prerender timestamp.
const _clientNow = ref<Date | null>(null)

// ─── Composable ───────────────────────────────────────────────────────────────

export function useExpenseStore() {
  const toast = useToast()

  // ── Helpers ──────────────────────────────────────────────────────────────

  function getTaxDefaultsForCategory(category: string) {
    const match = findTaxCategoryByName(category)
    if (!match || match.defaultPct === null) {
      return { taxDeductible: true, deductiblePct: 100, deductiblePctLocked: false }
    }
    return {
      taxDeductible: match.defaultPct > 0,
      deductiblePct: match.defaultPct,
      deductiblePctLocked: match.isLocked
    }
  }

  function getNetDeductible(expense: Expense) {
    if (!expense.taxDeductible) return 0
    // Equipment: businessUsePct is always the controlling multiplier (personal use is never deductible)
    if (findTaxCategoryByName(expense.category)?.specialHandling === 'equipment') {
      return round2(expense.amount * (expense.businessUsePct / 100))
    }
    return round2(expense.amount * (expense.deductiblePct / 100))
  }

  function hasDuplicateExpense(date: string, vendor: string, amount: number) {
    return expenses.value.some(
      (e) =>
        e.date === date &&
        e.vendor.toLowerCase().trim() === vendor.toLowerCase().trim() &&
        Math.abs(e.amount - amount) < 0.01
    )
  }

  // ── Sanitizers ───────────────────────────────────────────────────────────

  function sanitizeExpense(raw: unknown): Expense | null {
    if (!raw || typeof raw !== 'object') return null
    const v = raw as Record<string, unknown>
    const category = typeof v.category === 'string' && v.category ? v.category : DEFAULT_CATEGORY
    const defaults = getTaxDefaultsForCategory(category)
    const amount = Number(v.amount ?? 0)
    const deductiblePct = clamp(
      Number(v.deductiblePct ?? v.deductible_pct ?? defaults.deductiblePct),
      0,
      100
    )
    const paymentMethod =
      typeof v.paymentMethod === 'string' && PAYMENT_METHODS.includes(v.paymentMethod)
        ? v.paymentMethod
        : typeof v.payment_method === 'string' &&
            PAYMENT_METHODS.includes(v.payment_method as string)
          ? (v.payment_method as string)
          : DEFAULT_PAYMENT_METHOD
    return {
      id: String(v.id ?? generateId()),
      date: toISODate(String(v.date ?? getTodayISO())),
      vendor: String(v.vendor ?? '').trim(),
      amount: Number.isFinite(amount) ? round2(Math.abs(amount)) : 0,
      category,
      description: String(v.description ?? ''),
      paymentMethod,
      clientBillable: Boolean(v.clientBillable ?? v.client_billable),
      taxDeductible:
        typeof v.taxDeductible === 'boolean'
          ? v.taxDeductible
          : typeof v.tax_deductible === 'boolean'
            ? v.tax_deductible
            : defaults.taxDeductible,
      deductiblePct,
      receipts: Array.isArray(v.receipts) ? (v.receipts as unknown[]).map(String) : [],
      source: v.source === 'mercury' ? 'mercury' : 'manual',
      mercuryTransactionId:
        typeof v.mercuryTransactionId === 'string'
          ? v.mercuryTransactionId
          : typeof v.mercury_transaction_id === 'string'
            ? v.mercury_transaction_id
            : null,
      contractorId:
        typeof v.contractorId === 'string'
          ? v.contractorId
          : typeof v.contractor_id === 'string'
            ? v.contractor_id
            : null,
      section179: Boolean(v.section179 ?? v.section_179),
      businessUsePct:
        typeof v.businessUsePct === 'number'
          ? v.businessUsePct
          : typeof v.business_use_pct === 'number'
            ? v.business_use_pct
            : 100,
      createdAt: String(v.createdAt ?? v.created_at ?? new Date().toISOString()),
      updatedAt: String(v.updatedAt ?? v.updated_at ?? new Date().toISOString())
    }
  }

  function sanitizeMileage(raw: unknown): MileageTrip | null {
    if (!raw || typeof raw !== 'object') return null
    const v = raw as Record<string, unknown>
    const miles = Number(v.miles ?? 0)
    return {
      id: String(v.id ?? generateId()),
      date: toISODate(String(v.date ?? getTodayISO())),
      from: String(v.from ?? v.from_location ?? '').trim(),
      to: String(v.to ?? v.to_location ?? '').trim(),
      miles: Number.isFinite(miles) ? round2(Math.max(miles, 0)) : 0,
      purpose: String(v.purpose ?? ''),
      createdAt: String(v.createdAt ?? v.created_at ?? new Date().toISOString())
    }
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  async function initStore() {
    _clientNow.value = new Date()
    const [expensesData, mileageData] = await Promise.all([
      $fetch<unknown[]>('/api/expenses'),
      $fetch<unknown[]>('/api/mileage')
    ])
    expenses.value = expensesData.map(sanitizeExpense).filter(Boolean) as Expense[]
    mileageTrips.value = mileageData.map(sanitizeMileage).filter(Boolean) as MileageTrip[]
  }

  // ── Expense CRUD ─────────────────────────────────────────────────────────

  async function addExpense(draft: ExpenseDraft) {
    const nowISO = new Date().toISOString()
    const row = {
      id: generateId(),
      date: toISODate(draft.date),
      vendor: draft.vendor.trim(),
      amount: round2(Math.abs(Number(draft.amount))),
      category: draft.category,
      description: draft.description.trim(),
      paymentMethod: draft.paymentMethod,
      clientBillable: draft.clientBillable,
      taxDeductible: draft.taxDeductible,
      deductiblePct: clamp(Number(draft.deductiblePct), 0, 100),
      source: 'manual' as const,
      mercuryTransactionId: null,
      contractorId: draft.contractorId ?? null,
      section179: draft.section179,
      businessUsePct: draft.businessUsePct,
      receipts: draft.receiptKeys,
      createdAt: nowISO,
      updatedAt: nowISO
    }
    await $fetch('/api/expenses', { method: 'POST', body: row })
    expenses.value.unshift(row)
    toast.add({ title: 'Expense added', color: 'success' })
  }

  async function updateExpense(id: string, draft: ExpenseDraft) {
    const index = expenses.value.findIndex((e) => e.id === id)
    if (index < 0) return
    const prev = expenses.value[index]!
    const updated: Expense = {
      id,
      date: toISODate(draft.date),
      vendor: draft.vendor.trim(),
      amount: round2(Math.abs(Number(draft.amount))),
      category: draft.category,
      description: draft.description.trim(),
      paymentMethod: draft.paymentMethod,
      clientBillable: draft.clientBillable,
      taxDeductible: draft.taxDeductible,
      deductiblePct: clamp(Number(draft.deductiblePct), 0, 100),
      source: prev.source,
      mercuryTransactionId: prev.mercuryTransactionId,
      contractorId: draft.contractorId ?? null,
      section179: draft.section179,
      businessUsePct: draft.businessUsePct,
      receipts: draft.receiptKeys,
      createdAt: prev.createdAt,
      updatedAt: new Date().toISOString()
    }
    await $fetch(`/api/expenses/${id}`, {
      method: 'PUT',
      body: updated
    })
    expenses.value[index] = updated
    toast.add({ title: 'Expense updated', color: 'success' })
  }

  async function deleteExpense(expense: Expense) {
    await $fetch(`/api/expenses/${expense.id}`, { method: 'DELETE' })
    expenses.value = expenses.value.filter((e) => e.id !== expense.id)
    toast.add({ title: 'Expense deleted', color: 'success' })
  }

  async function bulkDeleteExpenses(ids: string[]) {
    if (ids.length === 0) return
    await $fetch('/api/expenses/bulk', { method: 'POST', body: { action: 'delete', ids } })
    const idSet = new Set(ids)
    expenses.value = expenses.value.filter((e) => !idSet.has(e.id))
    toast.add({
      title: `${ids.length} expense${ids.length !== 1 ? 's' : ''} deleted`,
      color: 'success'
    })
  }

  async function bulkUpdateExpenses(
    ids: string[],
    patch: Partial<Pick<Expense, 'clientBillable' | 'taxDeductible' | 'category'>>
  ) {
    if (ids.length === 0) return
    await $fetch('/api/expenses/bulk', { method: 'POST', body: { action: 'update', ids, patch } })
    const idSet = new Set(ids)
    const updatedAt = new Date().toISOString()
    for (const e of expenses.value) {
      if (idSet.has(e.id)) Object.assign(e, patch, { updatedAt })
    }
    toast.add({
      title: `${ids.length} expense${ids.length !== 1 ? 's' : ''} updated`,
      color: 'success'
    })
  }

  async function attachReceipt(expenseId: string, pathname: string) {
    const expense = expenses.value.find((e) => e.id === expenseId)
    if (!expense) return
    const updated = [...expense.receipts, pathname]
    await $fetch(`/api/expenses/${expenseId}`, {
      method: 'PUT',
      body: { receipts: updated }
    })
    expense.receipts = updated
  }

  async function importExpenses(rows: Array<Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>>) {
    const nowISO = new Date().toISOString()
    const imported = rows.map((row) => ({
      ...row,
      id: generateId(),
      createdAt: nowISO,
      updatedAt: nowISO
    }))
    await $fetch('/api/expenses/bulk', {
      method: 'POST',
      body: {
        action: 'insert',
        rows: imported
      }
    })
    expenses.value = [...imported, ...expenses.value]
    toast.add({
      title: 'Import complete',
      description: `${imported.length} expenses imported.`,
      color: 'success'
    })
  }

  // ── Mileage CRUD ─────────────────────────────────────────────────────────

  async function addMileageTrip(draft: {
    date: string
    from: string
    to: string
    miles: number
    purpose: string
  }) {
    const trip = {
      id: generateId(),
      date: toISODate(draft.date),
      from: draft.from.trim(),
      to: draft.to.trim(),
      miles: round2(draft.miles),
      purpose: draft.purpose.trim() || 'Business',
      createdAt: new Date().toISOString()
    }
    await $fetch('/api/mileage', { method: 'POST', body: trip })
    mileageTrips.value.unshift(trip)
    toast.add({ title: 'Mileage trip logged', color: 'success' })
  }

  async function deleteMileageTrip(trip: MileageTrip) {
    await $fetch(`/api/mileage/${trip.id}`, { method: 'DELETE' })
    mileageTrips.value = mileageTrips.value.filter((t) => t.id !== trip.id)
    toast.add({ title: 'Mileage trip deleted', color: 'success' })
  }

  // ── Backup / Restore ─────────────────────────────────────────────────────

  function exportBackup() {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      expenses: expenses.value,
      mileageTrips: mileageTrips.value
    }
    downloadFile(
      `koin-backup-${getTodayISO()}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    )
    toast.add({ title: 'Backup exported', color: 'success' })
  }

  async function restoreBackup(file: File) {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const restoredExpenses = Array.isArray(parsed.expenses)
        ? (parsed.expenses.map(sanitizeExpense).filter(Boolean) as Expense[])
        : []
      const restoredMileage = Array.isArray(parsed.mileageTrips)
        ? (parsed.mileageTrips.map(sanitizeMileage).filter(Boolean) as MileageTrip[])
        : []
      const allIds = expenses.value.map((e) => e.id)
      if (allIds.length > 0) {
        await $fetch('/api/expenses/bulk', {
          method: 'POST',
          body: { action: 'delete', ids: allIds }
        })
      }
      for (const trip of mileageTrips.value) {
        await $fetch(`/api/mileage/${trip.id}`, { method: 'DELETE' })
      }
      if (restoredExpenses.length > 0) {
        await $fetch('/api/expenses/bulk', {
          method: 'POST',
          body: {
            action: 'insert',
            rows: restoredExpenses
          }
        })
      }
      for (const trip of restoredMileage) {
        await $fetch('/api/mileage', { method: 'POST', body: trip })
      }
      expenses.value = restoredExpenses
      mileageTrips.value = restoredMileage
      toast.add({
        title: 'Restore complete',
        description: `${restoredExpenses.length} expenses and ${restoredMileage.length} trips loaded.`,
        color: 'success'
      })
    } catch {
      toast.add({
        title: 'Restore failed',
        description: 'Could not parse backup file.',
        color: 'error'
      })
    }
  }

  // ── Computed aggregates ───────────────────────────────────────────────────

  const monthSpend = computed(() => {
    const now = _clientNow.value
    if (!now) return 0
    return expenses.value.reduce(
      (sum, e) => sum + (isDateInCurrentMonth(e.date, now) ? e.amount : 0),
      0
    )
  })
  const ytdSpend = computed(() => {
    const now = _clientNow.value
    if (!now) return 0
    return expenses.value.reduce(
      (sum, e) => sum + (isDateInCurrentYear(e.date, now) ? e.amount : 0),
      0
    )
  })
  const ytdTaxDeductible = computed(() => {
    const now = _clientNow.value
    if (!now) return 0
    return expenses.value.reduce((sum, e) => {
      if (!isDateInCurrentYear(e.date, now) || !e.taxDeductible) return sum
      return sum + getNetDeductible(e)
    }, 0)
  })
  const ytdBillable = computed(() => {
    const now = _clientNow.value
    if (!now) return 0
    return expenses.value.reduce((sum, e) => {
      if (!isDateInCurrentYear(e.date, now) || !e.clientBillable) return sum
      return sum + e.amount
    }, 0)
  })
  const categorySpendYtd = computed(() => {
    const now = _clientNow.value
    if (!now) return []
    const map = new Map<string, number>()
    for (const e of expenses.value) {
      if (!isDateInCurrentYear(e.date, now)) continue
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    }
    return Array.from(map.entries())
      .map(([category, total]) => ({ category, total: round2(total) }))
      .sort((a, b) => b.total - a.total)
  })
  const topVendorsYtd = computed(() => {
    const now = _clientNow.value
    if (!now) return []
    const map = new Map<string, number>()
    for (const e of expenses.value) {
      if (!isDateInCurrentYear(e.date, now)) continue
      map.set(e.vendor, (map.get(e.vendor) ?? 0) + e.amount)
    }
    return Array.from(map.entries())
      .map(([vendor, total]) => ({ vendor, total: round2(total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  })
  const vendorSuggestions = computed(() =>
    [...new Set(expenses.value.map((e) => e.vendor).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    )
  )
  const totalMilesYtd = computed(() => {
    const now = _clientNow.value
    if (!now) return 0
    return mileageTrips.value.reduce(
      (sum, t) => sum + (isDateInCurrentYear(t.date, now) ? t.miles : 0),
      0
    )
  })
  const { irsRatePerMile } = useSettings()
  const mileageDeductionYtd = computed(() => round2(totalMilesYtd.value * irsRatePerMile.value))
  const monthlySpendYtd = computed(() => {
    const now = _clientNow.value
    if (!now) return []
    const currentYear = now.getFullYear()
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(currentYear, i, 1).toLocaleString('en-US', { month: 'short' }),
      total: 0
    }))
    for (const e of expenses.value) {
      if (!isDateInCurrentYear(e.date, now)) continue
      const idx = new Date(`${e.date}T12:00:00`).getMonth()
      months[idx]!.total = round2(months[idx]!.total + e.amount)
    }
    return months
  })

  return {
    // State
    expenses,
    mileageTrips,
    // Init
    initStore,
    // Expense CRUD
    addExpense,
    updateExpense,
    deleteExpense,
    bulkDeleteExpenses,
    bulkUpdateExpenses,
    importExpenses,
    attachReceipt,
    // Mileage CRUD
    addMileageTrip,
    deleteMileageTrip,
    // Backup
    exportBackup,
    restoreBackup,
    // Aggregates
    monthSpend,
    ytdSpend,
    ytdTaxDeductible,
    ytdBillable,
    categorySpendYtd,
    topVendorsYtd,
    vendorSuggestions,
    totalMilesYtd,
    mileageDeductionYtd,
    monthlySpendYtd,
    // Helpers exposed for components
    getTaxDefaultsForCategory,
    getNetDeductible,
    hasDuplicateExpense
  }
}
