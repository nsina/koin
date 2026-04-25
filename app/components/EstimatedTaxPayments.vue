<script setup lang="ts">
interface TaxPayment {
  id: string
  quarter: string
  year: number
  dueDate: string
  amountPaid: number | null
  datePaid: string | null
  confirmationNumber: string
}

const open = ref(true)
const payments = ref<TaxPayment[]>([])

onMounted(async () => {
  const year = new Date().getFullYear()
  const QUARTERLY_DUES = [
    { quarter: 'Q1', dueDate: `${year}-04-15` },
    { quarter: 'Q2', dueDate: `${year}-06-15` },
    { quarter: 'Q3', dueDate: `${year}-09-15` },
    { quarter: 'Q4', dueDate: `${year + 1}-01-15` }
  ]
  const rows = await $fetch<TaxPayment[]>(`/api/estimated-taxes?year=${year}`)
  if (rows.length === 0) {
    // Seed the 4 quarters
    for (const q of QUARTERLY_DUES) {
      const created = await $fetch<TaxPayment>('/api/estimated-taxes', {
        method: 'POST',
        body: {
          id: generateId(),
          quarter: q.quarter,
          year,
          dueDate: q.dueDate,
          amountPaid: null,
          datePaid: null,
          confirmationNumber: ''
        }
      })
      payments.value.push(created)
    }
  } else {
    payments.value = rows
  }
})

async function savePayment(p: TaxPayment) {
  await $fetch(`/api/estimated-taxes/${p.id}`, { method: 'PUT', body: p })
}

const totalPaid = computed(() => payments.value.reduce((sum, p) => sum + (p.amountPaid ?? 0), 0))

function statusColor(p: TaxPayment): 'success' | 'error' | 'neutral' {
  if (p.amountPaid) return 'success'
  if (p.dueDate < getTodayISO()) return 'error'
  return 'neutral'
}

function statusLabel(p: TaxPayment): string {
  if (p.amountPaid) return 'Paid'
  if (p.dueDate < getTodayISO()) return 'Overdue'
  return 'Pending'
}
</script>

<template>
  <UCollapsible v-model:open="open">
    <button class="flex w-full items-center justify-between py-2 text-left">
      <span class="font-semibold">Quarterly Estimated Tax Payments</span>
      <UIcon
        :name="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        class="size-4 text-muted"
      />
    </button>

    <template #content>
      <div class="mt-3 overflow-x-auto rounded-xl border border-default">
        <table class="min-w-full">
          <thead>
            <tr class="table-header-row">
              <th class="px-4 py-3">Quarter</th>
              <th class="px-4 py-3">Period</th>
              <th class="px-4 py-3">IRS Due</th>
              <th class="px-4 py-3 text-right">Amount Paid</th>
              <th class="px-4 py-3">Date Paid</th>
              <th class="px-4 py-3">Confirmation #</th>
              <th class="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in payments" :key="p.id" class="border-b border-muted last:border-0">
              <td class="px-4 py-3 font-semibold">{{ p.quarter }} {{ p.year }}</td>
              <td class="px-4 py-3 text-sm text-muted">
                <span v-if="p.quarter === 'Q1'">Jan 1 – Mar 31</span>
                <span v-else-if="p.quarter === 'Q2'">Apr 1 – May 31</span>
                <span v-else-if="p.quarter === 'Q3'">Jun 1 – Aug 31</span>
                <span v-else>Sep 1 – Dec 31</span>
              </td>
              <td class="px-4 py-3 text-sm">{{ formatDateLong(p.dueDate) }}</td>
              <td class="px-4 py-3 text-right">
                <UInputNumber
                  :model-value="p.amountPaid ?? undefined"
                  :min="0"
                  :step="0.01"
                  :increment="false"
                  :decrement="false"
                  placeholder="0.00"
                  class="w-32"
                  @update:model-value="
                    (v) => {
                      p.amountPaid = v ?? null
                    }
                  "
                  @blur="savePayment(p)"
                />
              </td>
              <td class="px-4 py-3">
                <AppDatePicker
                  :model-value="p.datePaid ?? undefined"
                  @update:model-value="
                    (v) => {
                      p.datePaid = v || null
                      savePayment(p)
                    }
                  "
                />
              </td>
              <td class="px-4 py-3">
                <UInput
                  v-model="p.confirmationNumber"
                  placeholder="Optional"
                  class="w-36"
                  @blur="savePayment(p)"
                />
              </td>
              <td class="px-4 py-3 text-center">
                <UBadge
                  :label="statusLabel(p)"
                  :color="statusColor(p)"
                  variant="subtle"
                  size="sm"
                />
              </td>
            </tr>
            <tr class="border-t-2 border-default bg-muted font-semibold">
              <td colspan="3" class="px-4 py-3">Total estimated taxes paid</td>
              <td class="px-4 py-3 text-right tabular-nums">{{ formatCurrency(totalPaid) }}</td>
              <td colspan="3" />
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </UCollapsible>
</template>
