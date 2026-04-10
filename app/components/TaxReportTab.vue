<script setup lang="ts">
import { TAX_CATEGORIES, findTaxCategoryByName } from '~/utils/taxRules'

const store = useExpenseStore()
const { irsRatePerMile, fiscalYearStart } = useSettings()
function fiscalYear() {
  const year = new Date().getFullYear()
  const from = `${year}-${fiscalYearStart.value}`
  const end = new Date(from)
  end.setFullYear(end.getFullYear() + 1)
  end.setDate(end.getDate() - 1)
  const to = end.toISOString().slice(0, 10)
  return { from, to }
}
const taxRange = reactive({ from: '', to: '' })

onMounted(() => {
  const range = fiscalYear()
  taxRange.from = range.from
  taxRange.to = range.to
})

const viewMode = ref<'app' | 'scheduleC'>('app')

const viewItems = [
  { label: 'App Categories', value: 'app' },
  { label: 'Schedule C Lines', value: 'scheduleC' }
]

const deductibleExpenses = computed(() =>
  store.expenses.value
    .filter((e) => e.taxDeductible && isDateWithinRange(e.date, taxRange.from, taxRange.to))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
)

const mileageDeductionInRange = computed(() =>
  round2(
    store.mileageTrips.value.reduce((sum, t) => {
      if (!isDateWithinRange(t.date, taxRange.from, taxRange.to)) return sum
      return sum + t.miles * irsRatePerMile.value
    }, 0)
  )
)

const expenseTotal = computed(() =>
  deductibleExpenses.value.reduce((sum, e) => sum + store.getNetDeductible(e), 0)
)

const grandTotal = computed(() => round2(expenseTotal.value + mileageDeductionInRange.value))

// ── Schedule C label helpers ──────────────────────────────────────────────────

function lineLabel(group: { irsName: string; founderCategories: string[] }): string {
  if (group.founderCategories.length > 1) {
    return `${group.irsName} (${group.founderCategories.join(', ')})`
  }
  return group.irsName
}

// Schedule C grouped view
// lineOrder now sorts by the numeric part of each line string
const scheduleCGroups = computed(() => {
  const lineOrder = TAX_CATEGORIES.map((c) => c.scheduleCLine)
    .filter((line, idx, all): line is string => Boolean(line) && all.indexOf(line) === idx)
    .sort((a, b) => {
      const num = (s: string) => parseInt(s.match(/\d+/)?.[0] ?? '0', 10)
      return num(a) - num(b)
    })

  const map = new Map<
    string,
    {
      line: string
      irsName: string
      founderCategories: string[]
      founderCategorySet: Set<string>
      expenses: typeof deductibleExpenses.value
      subtotal: number
    }
  >()

  for (const cat of TAX_CATEGORIES) {
    if (!cat.scheduleCLine) continue
    if (!map.has(cat.scheduleCLine)) {
      map.set(cat.scheduleCLine, {
        line: cat.scheduleCLine,
        irsName: cat.irsName,
        founderCategories: [],
        founderCategorySet: new Set<string>(),
        expenses: [],
        subtotal: 0
      })
    }
  }

  for (const e of deductibleExpenses.value) {
    const cat = findTaxCategoryByName(e.category)
    const line = cat?.scheduleCLine
    if (!line || !map.has(line)) continue
    const group = map.get(line)!
    group.expenses.push(e)
    group.founderCategorySet.add(cat.name)
    group.subtotal = round2(group.subtotal + store.getNetDeductible(e))
  }

  return lineOrder
    .filter(
      (line) => map.has(line) && (map.get(line)!.subtotal > 0 || map.get(line)!.expenses.length > 0)
    )
    .map((line) => {
      const group = map.get(line)!
      return {
        ...group,
        founderCategories: Array.from(group.founderCategorySet)
      }
    })
})

// Section 179 breakdown — only valid elections (businessUsePct > 50)
const section179Expenses = computed(() =>
  deductibleExpenses.value.filter(
    (e) =>
      findTaxCategoryByName(e.category)?.specialHandling === 'equipment' &&
      e.section179 &&
      e.businessUsePct > 50
  )
)
const section179Total = computed(() =>
  round2(section179Expenses.value.reduce((sum, e) => sum + store.getNetDeductible(e), 0))
)

// Expenses where section179 is set but businessUsePct <= 50 — IRS non-compliant
const s179ExcludedExpenses = computed(() =>
  deductibleExpenses.value.filter(
    (e) =>
      findTaxCategoryByName(e.category)?.specialHandling === 'equipment' &&
      e.section179 &&
      e.businessUsePct <= 50
  )
)

// Subtotal driven by Schedule C group sums (excludes non-scheduled categories like Owner's Draw)
const scheduleCSubtotal = computed(() =>
  round2(scheduleCGroups.value.reduce((sum, g) => sum + g.subtotal, 0))
)
const scheduleCGrandTotal = computed(() =>
  round2(scheduleCSubtotal.value + mileageDeductionInRange.value)
)

function exportCsv() {
  if (viewMode.value === 'scheduleC') {
    const headers = [
      'Schedule C Line',
      'Date',
      'Vendor',
      'Category',
      'Amount',
      'Ded. %',
      'Net Deductible'
    ]
    const rows: string[][] = []
    for (const group of scheduleCGroups.value) {
      for (const e of group.expenses) {
        rows.push([
          group.line,
          e.date,
          e.vendor,
          e.category,
          e.amount.toFixed(2),
          e.deductiblePct.toFixed(0),
          store.getNetDeductible(e).toFixed(2)
        ])
      }
    }
    if (mileageDeductionInRange.value > 0) {
      rows.push([
        'Line 9',
        taxRange.to,
        'Mileage Log',
        'Vehicle/Mileage',
        mileageDeductionInRange.value.toFixed(2),
        '100',
        mileageDeductionInRange.value.toFixed(2)
      ])
    }
    const csv = [headers, ...rows].map((line) => line.map(escapeCsv).join(',')).join('\n')
    downloadFile(
      `schedule-c-report-${taxRange.from}-to-${taxRange.to}.csv`,
      csv,
      'text/csv;charset=utf-8;'
    )
  } else {
    const headers = ['Date', 'Vendor', 'Category', 'Amount', 'Ded. %', 'Net Deductible', 'Receipt']
    const rows = deductibleExpenses.value.map((e) => [
      e.date,
      e.vendor,
      e.category,
      e.amount.toFixed(2),
      e.deductiblePct.toFixed(0),
      store.getNetDeductible(e).toFixed(2),
      e.receipts.length > 0 ? 'Y' : 'N'
    ])
    if (mileageDeductionInRange.value > 0) {
      rows.push([
        taxRange.to,
        'Mileage Log',
        'Vehicle & Gas',
        mileageDeductionInRange.value.toFixed(2),
        '100',
        mileageDeductionInRange.value.toFixed(2),
        'N'
      ])
    }
    const csv = [headers, ...rows].map((line) => line.map(escapeCsv).join(',')).join('\n')
    downloadFile(
      `tax-report-${taxRange.from}-to-${taxRange.to}.csv`,
      csv,
      'text/csv;charset=utf-8;'
    )
  }
}

function print() {
  if (!import.meta.client) return
  window.setTimeout(() => window.print(), 30)
}
</script>

<template>
  <div class="space-y-5">
    <!-- Controls -->
    <div
      class="no-print flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center"
    >
      <div class="flex flex-wrap items-center gap-3">
        <UFormField label="Date Range">
          <AppDatePicker v-model:from="taxRange.from" v-model:to="taxRange.to" range />
        </UFormField>

        <UFormField label="View">
          <UTabs
            v-model="viewMode"
            :items="viewItems"
            :content="false"
            color="primary"
            variant="pill"
            size="sm"
          />
        </UFormField>
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton
          icon="i-lucide-printer"
          label="Print"
          color="neutral"
          variant="outline"
          @click="print"
        />
        <UButton
          icon="i-lucide-download"
          label="Export CSV"
          color="neutral"
          variant="solid"
          @click="exportCsv"
        />
      </div>
    </div>

    <!-- Summary KPIs -->
    <div class="grid gap-4 lg:grid-cols-3">
      <UCard>
        <p class="text-sm text-muted">Total Deductible Expenses</p>
        <p class="mt-2 text-4xl font-bold tracking-tight tabular-nums">
          {{ formatCurrency(expenseTotal) }}
        </p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">Mileage Deduction (Line 9)</p>
        <p class="mt-2 text-4xl font-bold tracking-tight tabular-nums">
          {{ formatCurrency(mileageDeductionInRange) }}
        </p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">Grand Total Deduction</p>
        <p class="mt-2 text-4xl font-bold tracking-tight text-success tabular-nums">
          {{ formatCurrency(grandTotal) }}
        </p>
      </UCard>
    </div>

    <!-- App Categories view -->
    <UCard v-if="viewMode === 'app'">
      <div class="overflow-x-auto">
        <table class="min-w-full">
          <thead>
            <tr class="table-header-row">
              <th class="px-4 py-4">Date</th>
              <th class="px-4 py-4">Vendor</th>
              <th class="px-4 py-4">Category</th>
              <th class="px-4 py-4 text-right">Amount</th>
              <th class="px-4 py-4 text-right">Ded. %</th>
              <th class="px-4 py-4 text-right">Net Deductible</th>
              <th class="px-4 py-4 text-center">Receipt</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="deductibleExpenses.length === 0" class="text-muted">
              <td colspan="7" class="px-4 py-16 text-center text-2xl">
                No deductible expenses in this range.
              </td>
            </tr>
            <tr
              v-for="expense in deductibleExpenses"
              :key="expense.id"
              class="border-b border-muted"
            >
              <td class="px-4 py-3">{{ formatDateLong(expense.date) }}</td>
              <td class="px-4 py-3 font-medium">{{ expense.vendor }}</td>
              <td class="px-4 py-3">{{ expense.category }}</td>
              <td class="px-4 py-3 text-right font-semibold">
                {{ formatCurrency(expense.amount) }}
              </td>
              <td class="px-4 py-3 text-right">{{ expense.deductiblePct }}%</td>
              <td class="px-4 py-3 text-right font-semibold">
                {{ formatCurrency(store.getNetDeductible(expense)) }}
              </td>
              <td class="px-4 py-3 text-center">
                <UIcon
                  v-if="expense.receipts.length > 0"
                  name="i-lucide-paperclip"
                  class="size-4 text-muted"
                />
                <span v-else class="text-dimmed">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Schedule C Lines view -->
    <div v-else class="space-y-4">
      <UCard>
        <template #header>
          <h3 class="font-semibold">
            Schedule C Summary — Tax Year {{ taxRange.from.slice(0, 4) }}
          </h3>
        </template>
        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead>
              <tr class="table-header-row">
                <th class="w-28 px-4 py-3">Line</th>
                <th class="px-4 py-3">Category</th>
                <th class="px-4 py-3 text-right">Net Deductible</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="scheduleCGroups.length === 0" class="text-muted">
                <td colspan="3" class="px-4 py-16 text-center text-2xl">
                  No deductible expenses in this range.
                </td>
              </tr>
              <template v-for="group in scheduleCGroups" :key="group.line">
                <tr class="border-b border-muted bg-muted/30 font-semibold">
                  <td class="px-4 py-2 font-mono text-sm text-muted">{{ group.line }}</td>
                  <td class="px-4 py-2">{{ lineLabel(group) }}</td>
                  <td class="px-4 py-2 text-right tabular-nums">
                    <span class="inline-flex items-center justify-end gap-1.5">
                      {{ formatCurrency(group.subtotal) }}
                      <UTooltip
                        v-if="group.line === 'Line 13' && s179ExcludedExpenses.length > 0"
                        :text="`${s179ExcludedExpenses.length} equipment expense${s179ExcludedExpenses.length !== 1 ? 's were' : ' was'} excluded from Section 179 — business use ≤50%.`"
                      >
                        <UIcon name="i-lucide-triangle-alert" class="size-3.5 text-warning" />
                      </UTooltip>
                    </span>
                  </td>
                </tr>
                <!-- Section 179 detail under Line 13 -->
                <template v-if="group.line === 'Line 13' && section179Expenses.length > 0">
                  <tr
                    v-for="e in section179Expenses"
                    :key="e.id"
                    class="border-b border-muted/50 text-sm"
                  >
                    <td class="px-8 py-1.5 text-xs text-dimmed">§179</td>
                    <td class="px-4 py-1.5 text-muted">
                      {{ e.vendor }} — {{ formatDateLong(e.date) }}
                    </td>
                    <td class="px-4 py-1.5 text-right text-muted tabular-nums">
                      {{ formatCurrency(e.amount) }} × {{ e.businessUsePct }}% =
                      {{ formatCurrency(store.getNetDeductible(e)) }}
                    </td>
                  </tr>
                  <tr class="border-b border-muted text-sm font-medium">
                    <td class="px-8 py-1.5" />
                    <td class="px-4 py-1.5 text-muted">Total Section 179 Deduction</td>
                    <td class="px-4 py-1.5 text-right tabular-nums">
                      {{ formatCurrency(section179Total) }}
                    </td>
                  </tr>
                </template>
              </template>
              <tr class="border-t border-muted">
                <td class="px-4 py-3 font-semibold" />
                <td class="px-4 py-3 font-semibold">Subtotal — Schedule C Expenses</td>
                <td class="px-4 py-3 text-right font-semibold tabular-nums">
                  {{ formatCurrency(scheduleCSubtotal) }}
                </td>
              </tr>
              <tr v-if="mileageDeductionInRange > 0">
                <td class="px-4 py-2 font-mono text-sm text-muted">Line 9</td>
                <td class="px-4 py-2 text-muted">
                  + Mileage Deduction ({{ formatRate(irsRatePerMile) }}/mi)
                </td>
                <td class="px-4 py-2 text-right tabular-nums">
                  {{ formatCurrency(mileageDeductionInRange) }}
                </td>
              </tr>
              <tr class="border-t-2 border-default bg-muted font-bold">
                <td class="px-4 py-3" />
                <td class="px-4 py-3">TOTAL DEDUCTIBLE EXPENSES</td>
                <td class="px-4 py-3 text-right text-success tabular-nums">
                  {{ formatCurrency(scheduleCGrandTotal) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </div>

    <!-- 1099 Prep Report -->
    <UCard class="no-print">
      <Prep1099Report :from="taxRange.from" :to="taxRange.to" />
    </UCard>

    <!-- Estimated Tax Payments -->
    <UCard>
      <EstimatedTaxPayments />
    </UCard>

    <!-- Important Dates -->
    <UCard>
      <ImportantDatesPanel />
    </UCard>
  </div>
</template>
