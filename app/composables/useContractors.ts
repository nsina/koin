export interface Contractor {
  id: string
  name: string
  businessType: 'individual' | 'single_member_llc' | 'partnership' | 'corporation'
  ein: string | null
  email: string | null
  w9Received: boolean
  notes: string
  is1099Exempt: boolean
  createdAt: string
}

const contractors = ref<Contractor[]>([])

function sanitizeContractor(raw: unknown): Contractor | null {
  if (!raw || typeof raw !== 'object') return null
  const v = raw as Record<string, unknown>
  return {
    id: String(v.id ?? ''),
    name: String(v.name ?? ''),
    businessType: (['individual', 'single_member_llc', 'partnership', 'corporation'].includes(
      String(v.businessType ?? v.business_type)
    )
      ? (v.businessType ?? v.business_type)
      : 'individual') as Contractor['businessType'],
    ein: v.ein ? String(v.ein) : null,
    email: v.email ? String(v.email) : null,
    w9Received: Boolean(v.w9Received ?? v.w9_received),
    notes: String(v.notes ?? ''),
    is1099Exempt: Boolean(v.is1099Exempt ?? v.is_1099_exempt),
    createdAt: String(v.createdAt ?? v.created_at ?? new Date().toISOString())
  }
}

export function useContractors() {
  const toast = useToast()
  const store = useExpenseStore()

  async function loadContractors() {
    const rows = await $fetch<unknown[]>('/api/contractors')
    contractors.value = rows.map(sanitizeContractor).filter(Boolean) as Contractor[]
  }

  async function addContractor(draft: Omit<Contractor, 'id' | 'createdAt'>): Promise<Contractor> {
    const row = {
      ...draft,
      id: generateId(),
      createdAt: new Date().toISOString()
    }
    const created = await $fetch<unknown>('/api/contractors', { method: 'POST', body: row })
    const c = sanitizeContractor(created) ?? sanitizeContractor(row)!
    contractors.value.push(c)
    contractors.value.sort((a, b) => a.name.localeCompare(b.name))
    toast.add({ title: 'Contractor added', color: 'success' })
    return c
  }

  async function updateContractor(id: string, draft: Omit<Contractor, 'id' | 'createdAt'>) {
    const index = contractors.value.findIndex((c) => c.id === id)
    if (index < 0) return
    const updated = { ...contractors.value[index]!, ...draft }
    await $fetch(`/api/contractors/${id}`, { method: 'PUT', body: updated })
    contractors.value[index] = updated
    contractors.value.sort((a, b) => a.name.localeCompare(b.name))
    toast.add({ title: 'Contractor updated', color: 'success' })
  }

  async function deleteContractor(id: string) {
    await $fetch(`/api/contractors/${id}`, { method: 'DELETE' })
    contractors.value = contractors.value.filter((c) => c.id !== id)
    toast.add({ title: 'Contractor deleted', color: 'success' })
  }

  function getYtdSpend(contractorId: string): number {
    const year = new Date().getFullYear()
    return round2(
      store.expenses.value
        .filter(
          (e) =>
            e.contractorId === contractorId && new Date(`${e.date}T12:00:00`).getFullYear() === year
        )
        .reduce((sum, e) => sum + e.amount, 0)
    )
  }

  return {
    contractors,
    loadContractors,
    addContractor,
    updateContractor,
    deleteContractor,
    getYtdSpend
  }
}
