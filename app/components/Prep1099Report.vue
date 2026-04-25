<script setup lang="ts">
import { findTaxCategoryByName } from '~/utils/taxRules'

const props = defineProps<{
  from: string
  to: string
}>()

const store = useExpenseStore()
const { contractors } = useContractors()

const open = ref(false)

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  individual: 'Individual',
  single_member_llc: 'Single-member LLC',
  partnership: 'Partnership',
  corporation: 'Corporation'
}

const rows = computed(() => {
  // Sum contractor expenses within the tax range
  const spendMap = new Map<string, number>()
  for (const e of store.expenses.value) {
    if (!e.contractorId) continue
    if (!isDateWithinRange(e.date, props.from, props.to)) continue
    if (findTaxCategoryByName(e.category)?.specialHandling !== 'contractor') continue
    spendMap.set(e.contractorId, (spendMap.get(e.contractorId) ?? 0) + e.amount)
  }

  return contractors.value
    .map((c) => ({
      contractor: c,
      ytdPaid: round2(spendMap.get(c.id) ?? 0),
      requires1099: !c.is1099Exempt && (spendMap.get(c.id) ?? 0) >= 600,
      status: c.is1099Exempt
        ? 'Exempt'
        : (spendMap.get(c.id) ?? 0) >= 600
          ? c.w9Received
            ? 'Ready'
            : 'Needs W-9'
          : (spendMap.get(c.id) ?? 0) >= 500
            ? 'Collect W-9'
            : 'Monitor'
    }))
    .filter((r) => r.ytdPaid > 0 || contractors.value.length > 0)
})

function exportCsv() {
  const headers = [
    'Contractor',
    'Business Type',
    'YTD Paid',
    'W-9 Received',
    '1099 Required',
    'Status'
  ]
  const data = rows.value.map((r) => [
    r.contractor.name,
    BUSINESS_TYPE_LABELS[r.contractor.businessType] ?? r.contractor.businessType,
    r.ytdPaid.toFixed(2),
    r.contractor.w9Received ? 'Yes' : 'No',
    r.contractor.is1099Exempt ? 'Exempt' : r.requires1099 ? 'Yes' : 'No',
    r.status
  ])
  const csv =
    [headers, ...data].map((line) => line.map(escapeCsv).join(',')).join('\n') +
    '\n\nThis report is for preparation only. Use Track1099, Tax1099, or your CPA to file 1099-NEC forms with the IRS.'
  downloadFile('1099-prep-report.csv', csv, 'text/csv;charset=utf-8;')
}

function statusColor(status: string) {
  if (status === 'Ready') return 'success'
  if (status === 'Needs W-9') return 'error'
  if (status === 'Collect W-9') return 'warning'
  if (status === 'Exempt') return 'neutral'
  return 'neutral'
}
</script>

<template>
  <UCollapsible v-model:open="open">
    <button class="flex w-full items-center justify-between py-2 text-left">
      <span class="font-semibold">1099-NEC Prep Report</span>
      <UIcon
        :name="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        class="size-4 text-muted"
      />
    </button>

    <template #content>
      <div class="mt-3 space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-sm text-muted">
            Contractors paid via "Contractors & Freelancers" expenses in the selected range.
          </p>
          <UButton
            icon="i-lucide-download"
            label="Export CSV"
            color="neutral"
            variant="outline"
            size="sm"
            @click="exportCsv"
          />
        </div>

        <div
          v-if="rows.length === 0"
          class="rounded-xl border border-dashed border-muted px-4 py-8 text-center text-muted"
        >
          No contractor expenses found in this date range. Add contractors in the Expenses tab.
        </div>

        <div v-else class="overflow-x-auto rounded-xl border border-default">
          <table class="min-w-full">
            <thead>
              <tr class="table-header-row">
                <th class="px-4 py-3">Contractor</th>
                <th class="px-4 py-3">Type</th>
                <th class="px-4 py-3 text-right">YTD Paid</th>
                <th class="px-4 py-3 text-center">W-9</th>
                <th class="px-4 py-3 text-center">1099 Required</th>
                <th class="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in rows"
                :key="r.contractor.id"
                class="border-b border-muted last:border-0"
              >
                <td class="px-4 py-3 font-semibold">{{ r.contractor.name }}</td>
                <td class="px-4 py-3 text-sm text-muted">
                  {{ BUSINESS_TYPE_LABELS[r.contractor.businessType] }}
                </td>
                <td class="px-4 py-3 text-right font-semibold tabular-nums">
                  {{ formatCurrency(r.ytdPaid) }}
                </td>
                <td class="px-4 py-3 text-center">
                  <UIcon
                    :name="r.contractor.w9Received ? 'i-lucide-check-circle' : 'i-lucide-circle'"
                    :class="r.contractor.w9Received ? 'size-4 text-success' : 'size-4 text-dimmed'"
                  />
                </td>
                <td class="px-4 py-3 text-center">
                  <UBadge
                    v-if="r.contractor.is1099Exempt"
                    label="Exempt"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                  />
                  <UBadge
                    v-else-if="r.requires1099"
                    label="Yes"
                    :color="r.contractor.w9Received ? 'neutral' : 'error'"
                    variant="subtle"
                    size="sm"
                  />
                  <span v-else class="text-sm text-dimmed">No</span>
                </td>
                <td class="px-4 py-3 text-center">
                  <UBadge
                    :label="r.status"
                    :color="statusColor(r.status)"
                    variant="subtle"
                    size="sm"
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <p class="border-t border-default px-4 py-2 text-xs text-muted">
            This report is for preparation only. Use Track1099, Tax1099, or your CPA to file
            1099-NEC forms with the IRS.
          </p>
        </div>
      </div>
    </template>
  </UCollapsible>
</template>
