export interface RecurringTemplate {
  id: string
  vendor: string
  amount: number
  category: string
  paymentMethod: string
  description: string
  clientBillable: boolean
  taxDeductible: boolean
  deductiblePct: number
  frequency: 'monthly' | 'quarterly' | 'annually'
  nextDueDate: string
  endDate: string | null
  autoAdd: boolean
  active: boolean
  createdAt: string
}

const recurringTemplates = ref<RecurringTemplate[]>([])

function sanitizeTemplate(raw: unknown): RecurringTemplate | null {
  if (!raw || typeof raw !== 'object') return null
  const v = raw as Record<string, unknown>
  return {
    id: String(v.id ?? ''),
    vendor: String(v.vendor ?? ''),
    amount: Number(v.amount ?? 0),
    category: String(v.category ?? ''),
    paymentMethod: String(v.paymentMethod ?? v.payment_method ?? ''),
    description: String(v.description ?? ''),
    clientBillable: Boolean(v.clientBillable ?? v.client_billable),
    taxDeductible:
      v.taxDeductible === undefined && v.tax_deductible === undefined
        ? true
        : Boolean(v.taxDeductible ?? v.tax_deductible),
    deductiblePct: Number(v.deductiblePct ?? v.deductible_pct ?? 100),
    frequency: (['monthly', 'quarterly', 'annually'].includes(String(v.frequency))
      ? v.frequency
      : 'monthly') as RecurringTemplate['frequency'],
    nextDueDate: String(v.nextDueDate ?? v.next_due_date ?? ''),
    endDate: v.endDate ? String(v.endDate) : v.end_date ? String(v.end_date) : null,
    autoAdd: Boolean(v.autoAdd ?? v.auto_add),
    active: v.active === undefined ? true : Boolean(v.active),
    createdAt: String(v.createdAt ?? v.created_at ?? new Date().toISOString())
  }
}

export function useRecurring() {
  const toast = useToast()
  const store = useExpenseStore()

  async function loadRecurring() {
    const rows = await $fetch<unknown[]>('/api/recurring')
    recurringTemplates.value = rows.map(sanitizeTemplate).filter(Boolean) as RecurringTemplate[]
  }

  async function addTemplate(draft: Omit<RecurringTemplate, 'id' | 'createdAt'>) {
    const row = { ...draft, id: generateId(), createdAt: new Date().toISOString() }
    const created = await $fetch<unknown>('/api/recurring', { method: 'POST', body: row })
    const t = sanitizeTemplate(created)
    if (t) recurringTemplates.value.push(t)
  }

  async function updateTemplate(id: string, draft: Partial<RecurringTemplate>) {
    const index = recurringTemplates.value.findIndex((t) => t.id === id)
    if (index < 0) return
    const updated = { ...recurringTemplates.value[index]!, ...draft }
    await $fetch(`/api/recurring/${id}`, { method: 'PUT', body: updated })
    recurringTemplates.value[index] = updated
  }

  async function deleteTemplate(id: string) {
    await $fetch(`/api/recurring/${id}`, { method: 'DELETE' })
    recurringTemplates.value = recurringTemplates.value.filter((t) => t.id !== id)
    toast.add({ title: 'Recurring template deleted', color: 'success' })
  }

  async function processAutoAdd(): Promise<number> {
    const today = getTodayISO()
    let count = 0
    const toProcess = recurringTemplates.value.filter(
      (t) =>
        t.active &&
        t.autoAdd &&
        t.nextDueDate <= today &&
        (!t.endDate || t.nextDueDate <= t.endDate)
    )
    for (const t of toProcess) {
      await store.addExpense({
        date: t.nextDueDate,
        vendor: t.vendor,
        amount: t.amount,
        category: t.category,
        description: t.description,
        paymentMethod: t.paymentMethod,
        clientBillable: t.clientBillable,
        taxDeductible: t.taxDeductible,
        deductiblePct: t.deductiblePct,
        receiptKeys: [],
        contractorId: null,
        section179: false,
        businessUsePct: 100,
        isRecurring: false,
        recurringFrequency: 'monthly',
        recurringAutoAdd: false
      })
      const nextDate = advanceDate(t.nextDueDate, t.frequency)
      await updateTemplate(t.id, { nextDueDate: nextDate })
      count++
    }
    if (count > 0) {
      toast.add({
        title: `${count} recurring expense${count !== 1 ? 's' : ''} added automatically`,
        color: 'success'
      })
    }
    return count
  }

  const dueToday = computed(() => {
    const today = getTodayISO()
    return recurringTemplates.value.filter((t) => t.active && !t.autoAdd && t.nextDueDate <= today)
  })

  return {
    recurringTemplates,
    loadRecurring,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    processAutoAdd,
    dueToday
  }
}
