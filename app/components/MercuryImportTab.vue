<script setup lang="ts">
import type { MercuryPreviewRow, MercuryApiTransaction } from '~/composables/useMercuryImport'
import { mercuryRowToExpense } from '~/composables/useMercuryImport'
import { TAX_CATEGORIES } from '~/utils/taxRules'

const store = useExpenseStore()
const { parseMercuryCsv, mercuryApiToPreviewRows } = useMercuryImport()
const toast = useToast()

const csvFile = ref<File | null>(null)
const rows = ref<MercuryPreviewRow[]>([])
const syncing = ref(false)

const syncStart = ref('')
const syncEnd = ref('')

onMounted(() => {
  const today = new Date().toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  syncStart.value = thirtyDaysAgo
  syncEnd.value = today
})

async function fetchFromApi() {
  syncing.value = true
  try {
    const transactions = await $fetch<MercuryApiTransaction[]>(`/api/mercury/transactions`, {
      query: { start: syncStart.value, end: syncEnd.value },
    })
    rows.value = mercuryApiToPreviewRows(transactions)
    if (rows.value.length === 0) {
      toast.add({
        title: 'No transactions found',
        description: 'Try a different date range.',
        color: 'warning',
      })
      return
    }
    toast.add({
      title: 'Transactions fetched',
      description: `${rows.value.length} rows from Mercury API.`,
      color: 'success',
    })
  } catch (err: unknown) {
    const e = err as { statusCode?: number; data?: { statusMessage?: string } }
    const msg =
      e?.statusCode === 401
        ? 'Mercury API token not configured. Add it in Settings.'
        : e?.data?.statusMessage || 'Failed to fetch from Mercury API.'
    toast.add({ title: 'Sync failed', description: msg, color: 'error' })
  } finally {
    syncing.value = false
  }
}

const categoryItems = TAX_CATEGORIES.map((c) => c.name)

function onCategoryChange(row: MercuryPreviewRow, category: string) {
  const defaults = store.getTaxDefaultsForCategory(category)
  row.category = category
  row.taxDeductible = defaults.taxDeductible
  row.deductiblePct = defaults.deductiblePct
}

const transferCount = computed(
  () => rows.value.filter((r) => r.isTransfer || r.direction === 'credit').length,
)
const duplicateCount = computed(() => rows.value.filter((r) => r.duplicate).length)
const selectedCount = computed(() => rows.value.filter((r) => r.selected).length)

async function onFilePicked(file: File | null | undefined) {
  if (!file) return

  const text = await file.text()
  rows.value = parseMercuryCsv(text)

  if (rows.value.length === 0) {
    toast.add({
      title: 'No rows parsed',
      description: 'Check that this is a Mercury CSV export.',
      color: 'warning',
    })
    return
  }
  toast.add({
    title: 'CSV loaded',
    description: `${rows.value.length} rows parsed.`,
    color: 'success',
  })
}

function selectAllDebits() {
  rows.value.forEach((r) => {
    if (r.direction === 'debit' && !r.isTransfer && !r.duplicate) {
      r.selected = true
    }
  })
}

function importSelected() {
  const toImport = rows.value.filter((r) => r.selected)
  if (toImport.length === 0) {
    toast.add({ title: 'No rows selected', color: 'warning' })
    return
  }
  store.importExpenses(toImport.map(mercuryRowToExpense))
  rows.value = []
  csvFile.value = null
}

function clear() {
  rows.value = []
  csvFile.value = null
}

function rowBadgeLabel(row: MercuryPreviewRow) {
  if (row.isTransfer || row.direction === 'credit') return 'Revenue / Transfer'
  return 'Expense'
}
</script>

<template>
  <div class="space-y-5">
    <!-- API Sync -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-refresh-cw" />
          <span class="font-semibold">Sync from Mercury API</span>
        </div>
      </template>
      <div class="flex flex-wrap items-end gap-3">
        <UFormField label="Start Date">
          <AppDatePicker v-model="syncStart" />
        </UFormField>
        <UFormField label="End Date">
          <AppDatePicker v-model="syncEnd" />
        </UFormField>
        <UButton
          label="Fetch Transactions"
          icon="i-lucide-download-cloud"
          color="neutral"
          variant="solid"
          :loading="syncing"
          @click="fetchFromApi"
        />
      </div>
    </UCard>

    <USeparator label="or upload CSV" />

    <!-- Upload dropzone -->
    <UFileUpload
      v-model="csvFile"
      variant="area"
      accept=".csv,text/csv"
      icon="i-lucide-file-spreadsheet"
      label="Drop your Mercury CSV here"
      description="Debits are pre-selected; credits and transfers are excluded."
      color="neutral"
      :preview="false"
      class="no-print w-full"
      @update:model-value="onFilePicked"
    />

    <!-- Preview table -->
    <UCard v-if="rows.length > 0">
      <template #header>
        <p class="text-sm text-default">
          <span class="text-muted">{{ rows.length }} rows</span>
          <span class="mx-2 text-muted">&middot;</span>
          <UIcon name="i-lucide-check-circle" class="mb-0.5 inline size-3.5 text-success" />
          <span class="ml-1 font-semibold"
            >{{ selectedCount }} expense{{ selectedCount !== 1 ? 's' : '' }} selected</span
          >
          <span class="mx-2 text-muted">&middot;</span>
          <UIcon name="i-lucide-ban" class="mb-0.5 inline size-3.5 text-muted" />
          <span class="ml-1 text-muted">{{ transferCount }} revenue / transfers excluded</span>
          <template v-if="duplicateCount > 0">
            <span class="mx-2 text-muted">&middot;</span>
            <UIcon name="i-lucide-copy-x" class="mb-0.5 inline size-3.5 text-warning" />
            <span class="ml-1 text-warning"
              >{{ duplicateCount }} duplicate{{ duplicateCount !== 1 ? 's' : '' }}</span
            >
          </template>
        </p>
      </template>

      <div class="overflow-x-auto">
        <table class="min-w-full">
          <thead>
            <tr class="table-header-row">
              <th class="px-3 py-3">Import</th>
              <th class="px-3 py-3">Type</th>
              <th class="px-3 py-3">Date</th>
              <th class="px-3 py-3">Vendor</th>
              <th class="px-3 py-3">Description</th>
              <th class="px-3 py-3 text-right">Amount</th>
              <th class="px-3 py-3">Category</th>
              <th class="px-3 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.id"
              class="border-b border-muted align-top"
              :class="row.isTransfer || row.direction === 'credit' ? 'opacity-50' : ''"
            >
              <td class="px-3 py-3">
                <UCheckbox
                  v-model="row.selected"
                  :disabled="row.duplicate || row.isTransfer || row.direction === 'credit'"
                />
              </td>
              <td class="px-3 py-3">
                <UBadge :label="rowBadgeLabel(row)" color="neutral" variant="subtle" size="sm" />
              </td>
              <td class="px-3 py-3 text-sm">
                {{ formatDateShort(row.date) }}
              </td>
              <td class="px-3 py-3">
                <UInput v-model="row.vendor" size="sm" class="w-40" />
              </td>
              <td class="max-w-xs px-3 py-3 text-sm text-default">
                <p class="truncate">
                  {{ row.description }}
                </p>
                <p v-if="row.bankDescription" class="truncate text-xs text-muted">
                  {{ row.bankDescription }}
                </p>
              </td>
              <td class="px-3 py-3 text-right font-semibold">
                {{ formatCurrency(row.amount) }}
              </td>
              <td class="px-3 py-3">
                <USelect
                  :model-value="row.category"
                  :items="categoryItems"
                  size="sm"
                  class="w-56"
                  @update:model-value="onCategoryChange(row, $event as string)"
                />
              </td>
              <td class="px-3 py-3 text-center">
                <UBadge
                  v-if="row.duplicate"
                  label="Duplicate"
                  color="warning"
                  variant="subtle"
                  size="sm"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <template #footer>
        <div class="no-print flex flex-wrap gap-2">
          <UButton
            label="Select All Debits"
            icon="i-lucide-check-check"
            color="neutral"
            variant="outline"
            @click="selectAllDebits"
          />
          <UButton
            :label="`Import ${selectedCount} Selected`"
            icon="i-lucide-download"
            color="neutral"
            variant="solid"
            @click="importSelected"
          />
          <UButton label="Clear" icon="i-lucide-x" color="neutral" variant="soft" @click="clear" />
        </div>
      </template>
    </UCard>
  </div>
</template>
