<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import { CalendarDate } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'
import type { ColumnDef, HeaderContext, RowSelectionState, SortingState } from '@tanstack/vue-table'
import type { Expense } from '~/composables/useExpenseStore'
import { PAYMENT_METHODS } from '~/composables/useExpenseStore'
import { TAX_CATEGORIES } from '~/utils/taxRules'

const store = useExpenseStore()
const { confirm } = useConfirm()
const { dueToday, recurringTemplates } = useRecurring()
const { contractors, getYtdSpend } = useContractors()

// ── Quick receipt attach (from table) ─────────────────────────────────────────

const quickUploadInput = ref<HTMLInputElement | null>(null)
const quickUploadExpense = ref<Expense | null>(null)

function triggerQuickUpload(expense: Expense) {
  quickUploadExpense.value = expense
  quickUploadInput.value?.click()
}

async function onQuickFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !quickUploadExpense.value) return
  try {
    const form = new FormData()
    form.append('files', file)
    const blobs = await $fetch<{ pathname: string }[]>('/api/receipts/upload', {
      method: 'POST',
      body: form
    })
    if (blobs[0]) await store.attachReceipt(quickUploadExpense.value.id, blobs[0].pathname)
  } catch {
    useToast().add({ title: 'Upload failed', color: 'error' })
  } finally {
    quickUploadExpense.value = null
    ;(event.target as HTMLInputElement).value = ''
  }
}

// ── Local UI state ────────────────────────────────────────────────────────────

const modalOpen = ref(false)
const editingExpense = ref<Expense | null>(null)
const recurringOpen = ref(false)
const contractorOpen = ref(false)
const dueBannerDismissed = ref(false)
const dismissedW9Ids = ref<string[]>([])

const searchTerm = ref('')
const sorting = ref<SortingState>([{ id: 'date', desc: true }])
const rowSelection = ref<RowSelectionState>({})

// Filters — from/to are empty until onMounted applies the default preset
// (avoids hydration mismatch on prerendered route)
const filters = reactive({
  category: [] as string[],
  paymentMethod: 'all',
  billable: 'all',
  deductible: 'all',
  from: '',
  to: ''
})

const categoryListboxItems = TAX_CATEGORIES.map((c) => ({ label: c.name, value: c.name }))

// ── Date preset state ─────────────────────────────────────────────────────────

const datePreset = ref('this-year')
const showCustomPicker = ref(false)
const datePopoverOpen = ref(false)

// Quarter info — zero-initialized; populated in onMounted (client-only)
// to avoid prerender/hydration mismatch from new Date() in root scope
const _qYear = ref(0)
const _qNum = ref(0)
const _lqNum = ref(0)
const _lqYear = ref(0)

const DISMISSED_W9_KEY = 'koin:dismissed_w9_alerts'

function readDismissedIds(): string[] {
  if (!import.meta.client) return []
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_W9_KEY) ?? '[]')
  } catch {
    return []
  }
}

function dismissThresholdBanner() {
  const ids = contractorsNeedingW9.value.map((c) => c.id)
  dismissedW9Ids.value = ids
  if (import.meta.client) localStorage.setItem(DISMISSED_W9_KEY, JSON.stringify(ids))
}

onMounted(() => {
  dismissedW9Ids.value = readDismissedIds()
  const tq = getQuarterInfo('this')
  const lq = getQuarterInfo('last')
  _qYear.value = tq.year
  _qNum.value = tq.q
  _lqNum.value = lq.q
  _lqYear.value = lq.year
  // Apply the default date preset now that we're on the client
  const range = getPresetDateRange(datePreset.value)
  filters.from = range.from
  filters.to = range.to
})

const datePresetOptions = computed(() => [
  { label: 'This month', value: 'this-month' },
  {
    label: _qYear.value ? `This quarter (Q${_qNum.value} ${_qYear.value})` : 'This quarter',
    value: 'this-quarter'
  },
  {
    label: _qYear.value ? `This year (${_qYear.value})` : 'This year',
    value: 'this-year'
  },
  { label: 'Last month', value: 'last-month' },
  {
    label: _lqYear.value ? `Last quarter (Q${_lqNum.value} ${_lqYear.value})` : 'Last quarter',
    value: 'last-quarter'
  },
  {
    label: _qYear.value ? `Last year (${_qYear.value - 1})` : 'Last year',
    value: 'last-year'
  },
  { label: 'All time', value: 'all-time' },
  { label: 'Custom...', value: 'custom' }
])

// ── Filter options ────────────────────────────────────────────────────────────

const paymentMethodFilterItems = [
  { label: 'All methods', value: 'all' },
  ...PAYMENT_METHODS.map((m) => ({ label: m, value: m }))
]
const boolFilterItems = [
  { label: 'All', value: 'all' },
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' }
]
const categoryNames = TAX_CATEGORIES.map((c) => c.name)

// ── Computed ──────────────────────────────────────────────────────────────────

const filteredExpenses = computed(() => {
  const query = searchTerm.value.trim().toLowerCase()
  return store.expenses.value.filter((e) => {
    if (query && !`${e.vendor} ${e.description}`.toLowerCase().includes(query)) return false
    if (filters.category.length > 0 && !filters.category.includes(e.category)) return false
    if (filters.paymentMethod !== 'all' && e.paymentMethod !== filters.paymentMethod) return false
    if (filters.billable !== 'all' && e.clientBillable !== (filters.billable === 'yes'))
      return false
    if (filters.deductible !== 'all' && e.taxDeductible !== (filters.deductible === 'yes'))
      return false
    if (filters.from && e.date < filters.from) return false
    if (filters.to && e.date > filters.to) return false
    return true
  })
})

const filteredTotal = computed(() => filteredExpenses.value.reduce((sum, e) => sum + e.amount, 0))

const selectedExpenses = computed(() =>
  filteredExpenses.value.filter((e) => rowSelection.value[e.id])
)

const selectedTotal = computed(() => selectedExpenses.value.reduce((sum, e) => sum + e.amount, 0))

const selectedIds = computed(() => selectedExpenses.value.map((e) => e.id))

const activeFilterCount = computed(() => {
  let n = 0
  if (filters.category.length > 0) n++
  if (filters.paymentMethod !== 'all') n++
  if (filters.billable !== 'all') n++
  if (filters.deductible !== 'all') n++
  return n
})

const dateBtnLabel = computed(() => {
  if (datePreset.value === 'all-time') return 'All time'
  if (datePreset.value === 'custom') {
    if (filters.from && filters.to)
      return `${formatDateShort(filters.from)} – ${formatDateShort(filters.to)}`
    if (filters.from) return `From ${formatDateShort(filters.from)}`
    return 'Custom range'
  }
  return datePresetOptions.value.find((o) => o.value === datePreset.value)?.label ?? 'Date'
})

const showDueBanner = computed(() => dueToday.value.length > 0 && !dueBannerDismissed.value)

// ── Toolbar badge counts & status dots ───────────────────────────────────────

const activeRecurringCount = computed(() => recurringTemplates.value.filter((t) => t.active).length)

// Orange dot: active non-auto-add templates overdue (due today or earlier)
const hasRecurringDue = computed(() => dueToday.value.length > 0)

// Red dot + banner: contractor crossed $600 but W-9 not yet collected
const contractorsNeedingW9 = computed(() =>
  contractors.value.filter((c) => !c.is1099Exempt && getYtdSpend(c.id) >= 600 && !c.w9Received)
)
const hasContractorAlert = computed(() => contractorsNeedingW9.value.length > 0)
const showThresholdBanner = computed(() => {
  if (contractorsNeedingW9.value.length === 0) return false
  // Show if any currently-flagged contractor was not already dismissed
  return contractorsNeedingW9.value.some((c) => !dismissedW9Ids.value.includes(c.id))
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function sortHeader(label: string) {
  return ({ column }: HeaderContext<Expense, unknown>) =>
    h(UButton, {
      variant: 'ghost',
      color: 'neutral',
      label,
      icon:
        column.getIsSorted() === 'asc'
          ? 'i-lucide-arrow-up'
          : column.getIsSorted() === 'desc'
            ? 'i-lucide-arrow-down'
            : 'i-lucide-arrow-up-down',
      trailing: true,
      class: '-mx-2.5',
      onClick: () => column.toggleSorting()
    })
}

const UCheckbox = resolveComponent('UCheckbox')
const UBadge = resolveComponent('UBadge')
const UIcon = resolveComponent('UIcon')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')

// ── Category badge colors ─────────────────────────────────────────────────────

type BadgeColor = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'

const CATEGORY_BADGE_COLORS: Record<string, BadgeColor> = {
  'Meals & Coffee (Business)': 'warning',
  'Phone & Internet': 'warning',
  'Travel & Lodging': 'info',
  'Equipment & Hardware': 'info',
  'Contractors & Freelancers': 'success',
  "Owner's Draw / Personal Transfer": 'error',
  'Advertising & Marketing': 'primary',
  'Education & Courses': 'primary'
}

// ── Column definitions ────────────────────────────────────────────────────────

const CENTERED_COLUMN_CLASS = 'align-middle text-center'
const CENTERED_ICON_WRAPPER_CLASS = 'flex items-center justify-center'

const columns: ColumnDef<Expense>[] = [
  {
    id: 'select',
    header: ({ table }) =>
      h(UCheckbox, {
        modelValue: table.getIsAllPageRowsSelected(),
        indeterminate: table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (val: boolean) => table.toggleAllPageRowsSelected(val),
        'aria-label': 'Select all'
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: row.getIsSelected(),
        disabled: !row.getCanSelect(),
        'onUpdate:modelValue': (val: boolean) => row.toggleSelected(val),
        'aria-label': 'Select row'
      }),
    enableSorting: false,
    meta: { class: { th: 'w-10 align-middle', td: 'w-10 align-middle' } }
  },
  {
    accessorKey: 'date',
    header: sortHeader('Date'),
    cell: ({ row }) =>
      h('span', { class: 'font-medium tabular-nums' }, formatDateLong(row.getValue('date')))
  },
  {
    accessorKey: 'vendor',
    header: sortHeader('Vendor'),
    cell: ({ row }) => {
      const vendor = row.original.vendor
      const desc = row.original.description
      return h('div', [
        h('p', { class: 'font-semibold text-highlighted' }, vendor),
        desc ? h('p', { class: 'max-w-sm truncate text-sm text-muted' }, desc) : null
      ])
    }
  },
  {
    accessorKey: 'category',
    header: sortHeader('Category'),
    cell: ({ row }) => {
      const category = row.getValue('category') as string
      return h(UBadge, {
        label: category,
        variant: 'subtle',
        color: (CATEGORY_BADGE_COLORS[category] ?? 'neutral') as BadgeColor
      })
    }
  },
  {
    accessorKey: 'paymentMethod',
    header: 'Method',
    cell: ({ row }) =>
      h('span', { class: 'text-sm text-toned' }, row.getValue('paymentMethod') as string),
    meta: {
      class: {
        th: 'hidden xl:table-cell align-middle',
        td: 'hidden xl:table-cell align-middle'
      }
    }
  },
  {
    accessorKey: 'amount',
    header: sortHeader('Amount'),
    cell: ({ row }) =>
      h('span', { class: 'font-semibold tabular-nums' }, formatCurrency(row.getValue('amount'))),
    meta: { class: { th: 'text-right align-middle', td: 'text-right align-middle' } }
  },
  {
    id: 'taxDeductible',
    header: 'Tax',
    enableSorting: false,
    cell: ({ row }) => {
      const { taxDeductible, deductiblePct } = row.original
      const icon =
        !taxDeductible || deductiblePct === 0
          ? h(UIcon, { name: 'i-lucide-x-circle', class: 'size-4 text-error' })
          : deductiblePct < 100
            ? h(UIcon, { name: 'i-lucide-alert-triangle', class: 'size-4 text-warning' })
            : h(UIcon, { name: 'i-lucide-check-circle', class: 'size-4 text-success' })

      return h('div', { class: CENTERED_ICON_WRAPPER_CLASS }, [icon])
    },
    meta: { class: { th: CENTERED_COLUMN_CLASS, td: CENTERED_COLUMN_CLASS } }
  },
  {
    id: 'clientBillable',
    header: 'Billable',
    enableSorting: false,
    cell: ({ row }) => {
      const billable = row.original.clientBillable
      return h('div', { class: CENTERED_ICON_WRAPPER_CLASS }, [
        h(UIcon, {
          name: billable ? 'i-lucide-briefcase' : 'i-lucide-minus',
          class: billable ? 'size-4 text-info' : 'size-4 text-dimmed'
        })
      ])
    },
    meta: { class: { th: CENTERED_COLUMN_CLASS, td: CENTERED_COLUMN_CLASS } }
  },
  {
    id: 'attachment',
    header: 'Attachment',
    enableSorting: false,
    cell: ({ row }) => {
      const expense = row.original
      const receipts = expense.receipts
      const content =
        receipts.length === 1
          ? h(
              'a',
              {
                href: `/${receipts[0]}`,
                target: '_blank',
                class: 'inline-flex hover:opacity-70 transition-opacity',
                'aria-label': 'Open receipt'
              },
              [h(UIcon, { name: 'i-lucide-receipt-text', class: 'size-4 text-success' })]
            )
          : receipts.length > 1
            ? h(UButton, {
                icon: 'i-lucide-receipt-text',
                color: 'success' as const,
                variant: 'ghost',
                size: 'sm',
                'aria-label': `${receipts.length} receipts`,
                onClick: () => openEdit(expense)
              })
            : h(UButton, {
                icon: 'i-lucide-circle-plus',
                color: 'neutral' as const,
                variant: 'ghost',
                size: 'sm',
                'aria-label': 'Attach receipt',
                onClick: () => triggerQuickUpload(expense)
              })

      return h('div', { class: CENTERED_ICON_WRAPPER_CLASS }, [content])
    },
    meta: { class: { th: CENTERED_COLUMN_CLASS, td: CENTERED_COLUMN_CLASS } }
  },
  {
    id: 'actions',
    enableSorting: false,
    header: () => h('span', { class: 'sr-only' }, 'Actions'),
    cell: ({ row }) => {
      const expense = row.original
      const mercuryItem =
        expense.source === 'mercury' && expense.mercuryTransactionId
          ? [
              [
                {
                  label: 'View in Mercury',
                  icon: 'i-lucide-external-link',
                  onSelect: () => {
                    if (import.meta.client) {
                      window.open(
                        `https://mercury.com/transactions/${expense.mercuryTransactionId}`,
                        '_blank',
                        'noopener,noreferrer'
                      )
                    }
                  }
                }
              ]
            ]
          : []

      return h('div', { class: CENTERED_ICON_WRAPPER_CLASS }, [
        h(
          UDropdownMenu,
          {
            content: { align: 'end', side: 'bottom', sideOffset: 12 },
            items: [
              [
                {
                  label: 'Edit',
                  icon: 'i-lucide-pencil',
                  onSelect: () => openEdit(expense)
                }
              ],
              ...mercuryItem,
              [
                {
                  label: 'Toggle Billable',
                  icon: 'i-lucide-receipt',
                  onSelect: () =>
                    store.bulkUpdateExpenses([expense.id], {
                      clientBillable: !expense.clientBillable
                    })
                },
                {
                  label: 'Toggle Tax Deductible',
                  icon: 'i-lucide-landmark',
                  onSelect: () =>
                    store.bulkUpdateExpenses([expense.id], {
                      taxDeductible: !expense.taxDeductible
                    })
                }
              ],
              [
                {
                  label: 'Delete',
                  icon: 'i-lucide-trash-2',
                  color: 'error' as const,
                  onSelect: async () => {
                    const ok = await confirm({
                      title: `Delete expense for ${expense.vendor}?`,
                      description: 'This action cannot be undone.'
                    })
                    if (ok) store.deleteExpense(expense)
                  }
                }
              ]
            ]
          },
          {
            default: () =>
              h(UButton, {
                icon: 'i-lucide-ellipsis',
                color: 'neutral',
                variant: 'ghost',
                size: 'sm',
                'aria-label': 'Row actions'
              })
          }
        )
      ])
    },
    meta: {
      class: {
        th: `w-12 no-print ${CENTERED_COLUMN_CLASS}`,
        td: `w-12 no-print ${CENTERED_COLUMN_CLASS}`
      }
    }
  }
]

// ── Actions ───────────────────────────────────────────────────────────────────

function openNew() {
  editingExpense.value = null
  modalOpen.value = true
}

defineShortcuts({
  n: () => openNew()
})

function openEdit(expense: Expense) {
  editingExpense.value = expense
  modalOpen.value = true
}

function handleModalSubmit(draft: Parameters<typeof store.addExpense>[0], id: string | null) {
  if (id) store.updateExpense(id, draft)
  else store.addExpense(draft)
}

// ── Custom range calendar helpers ─────────────────────────────────────────────

function isoToCalendarDate(iso: string | undefined): CalendarDate | undefined {
  if (!iso) return undefined
  const parts = iso.split('-').map(Number)
  const [y, m, d] = parts
  if (!y || !m || !d) return undefined
  return new CalendarDate(y, m, d)
}

function calendarDateToISO(date: DateValue): string {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
}

const customRangeValue = computed(() => ({
  start: isoToCalendarDate(filters.from),
  end: isoToCalendarDate(filters.to)
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onCustomRangeUpdate(range: any) {
  filters.from = range?.start ? calendarDateToISO(range.start as DateValue) : ''
  filters.to = range?.end ? calendarDateToISO(range.end as DateValue) : ''
  if (range?.start && range?.end) {
    datePopoverOpen.value = false
    showCustomPicker.value = false
  }
}

function clearFilters() {
  filters.category = []
  filters.paymentMethod = 'all'
  filters.billable = 'all'
  filters.deductible = 'all'
}

function selectPreset(value: string) {
  if (value === 'custom') {
    datePreset.value = 'custom'
    showCustomPicker.value = true
    return
  }
  datePreset.value = value
  const range = getPresetDateRange(value)
  filters.from = range.from
  filters.to = range.to
  datePopoverOpen.value = false
}

async function deleteSelected() {
  const count = selectedIds.value.length
  const ok = await confirm({
    title: `Delete ${count} expense${count !== 1 ? 's' : ''}?`,
    description: 'This action cannot be undone.'
  })
  if (!ok) return
  store.bulkDeleteExpenses(selectedIds.value)
  rowSelection.value = {}
}

function markSelectedBillable(value: boolean) {
  store.bulkUpdateExpenses(selectedIds.value, { clientBillable: value })
}

function markSelectedDeductible(value: boolean) {
  store.bulkUpdateExpenses(selectedIds.value, { taxDeductible: value })
}

function setSelectedCategory(name: string) {
  store.bulkUpdateExpenses(selectedIds.value, { category: name })
}
</script>

<template>
  <div class="space-y-5">
    <!-- Due-today recurring banner -->
    <UAlert
      v-if="showDueBanner"
      color="warning"
      icon="i-lucide-clock"
      :title="`${dueToday.length} recurring expense${dueToday.length !== 1 ? 's' : ''} are due today.`"
      :description="dueToday.map((t) => t.vendor).join(', ')"
      :actions="[
        {
          label: 'Review',
          onClick: () => {
            recurringOpen = true
          }
        }
      ]"
      close
      @update:open="dueBannerDismissed = true"
    />

    <!-- $600 threshold banner -->
    <UAlert
      v-if="showThresholdBanner"
      color="error"
      variant="soft"
      icon="i-lucide-alert-triangle"
      :title="`Action required: ${contractorsNeedingW9.length} contractor${contractorsNeedingW9.length !== 1 ? 's have' : ' has'} crossed the $600 threshold but ${contractorsNeedingW9.length !== 1 ? 'are' : 'is'} missing a W-9.`"
      description="Collect W-9 forms before filing 1099-NEC. See Tax Report → 1099 Prep for details."
      :actions="[
        {
          label: 'View Contractors',
          onClick: () => {
            contractorOpen = true
          }
        }
      ]"
      close
      @update:open="dismissThresholdBanner"
    />

    <!-- Toolbar -->
    <div class="no-print flex items-center gap-2">
      <UButton
        icon="i-lucide-plus"
        label="Add Expense"
        color="neutral"
        variant="subtle"
        @click="openNew"
      >
        <template #trailing>
          <UKbd value="n" />
        </template>
      </UButton>

      <div class="mx-1 h-5 border-l border-default" />

      <UChip :show="hasRecurringDue" color="warning" size="sm" inset>
        <UButton
          icon="i-lucide-repeat"
          color="neutral"
          variant="ghost"
          @click="recurringOpen = true"
        >
          <span>Recurring</span>
          <UBadge
            v-if="activeRecurringCount > 0"
            :label="String(activeRecurringCount)"
            color="neutral"
            variant="soft"
            size="sm"
            class="ml-1"
          />
        </UButton>
      </UChip>

      <UChip :show="hasContractorAlert" color="error" size="sm" inset>
        <UButton
          icon="i-lucide-users"
          color="neutral"
          variant="ghost"
          @click="contractorOpen = true"
        >
          <span>Contractors</span>
          <UBadge
            v-if="contractors.length > 0"
            :label="String(contractors.length)"
            color="neutral"
            variant="soft"
            size="sm"
            class="ml-1"
          />
        </UButton>
      </UChip>
    </div>

    <!-- Modals triggered from toolbar -->
    <ContractorDirectory v-model:open="contractorOpen" />

    <!-- Search, Filters, Table -->
    <UCard :ui="{ body: 'p-0 sm:p-0', header: 'p-3 sm:px-4 sm:py-3' }">
      <template #header>
        <div class="no-print flex flex-col gap-3 lg:flex-row">
          <UInput
            v-model="searchTerm"
            icon="i-lucide-search"
            placeholder="Search vendor or description..."
            size="xl"
            class="flex-1"
          />

          <!-- Date filter dropdown -->
          <UPopover v-model:open="datePopoverOpen" :content="{ align: 'end' }">
            <UButton
              icon="i-lucide-calendar"
              :label="dateBtnLabel"
              :color="datePreset !== 'all-time' ? 'primary' : 'neutral'"
              variant="outline"
              size="xl"
            />
            <template #content>
              <div v-if="!showCustomPicker" class="w-56 py-1">
                <UButton
                  v-for="opt in datePresetOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :trailing-icon="datePreset === opt.value ? 'i-lucide-check' : undefined"
                  color="neutral"
                  variant="ghost"
                  block
                  class="justify-between rounded-none px-3"
                  @click="selectPreset(opt.value)"
                />
              </div>
              <div v-else class="p-3">
                <div class="mb-2 flex items-center gap-2">
                  <UButton
                    leading-icon="i-lucide-arrow-left"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    square
                    @click="showCustomPicker = false"
                  />
                  <span class="text-sm font-medium text-default">Custom range</span>
                </div>
                <UCalendar
                  range
                  :number-of-months="2"
                  :paged-navigation="true"
                  :model-value="customRangeValue"
                  @update:model-value="onCustomRangeUpdate"
                />
              </div>
            </template>
          </UPopover>

          <!-- General filters popover -->
          <UPopover :content="{ align: 'end' }">
            <UButton
              icon="i-lucide-filter"
              :label="activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'"
              :color="activeFilterCount > 0 ? 'primary' : 'neutral'"
              variant="outline"
              size="xl"
            />
            <template #content>
              <div class="w-80 p-4">
                <div class="mb-3 flex items-center justify-between">
                  <p class="text-sm font-semibold text-default">Filters</p>
                  <UButton
                    v-if="activeFilterCount > 0"
                    label="Clear all"
                    color="neutral"
                    variant="link"
                    size="xs"
                    @click="clearFilters"
                  />
                </div>

                <div class="space-y-3">
                  <UFormField label="Category">
                    <UListbox
                      v-model="filters.category"
                      :items="categoryListboxItems"
                      multiple
                      value-key="value"
                      :filter="{ placeholder: 'Search categories...' }"
                      class="max-h-48 w-full"
                    />
                    <UButton
                      v-if="filters.category.length > 0"
                      :label="`Clear (${filters.category.length} selected)`"
                      color="neutral"
                      variant="link"
                      size="xs"
                      class="mt-1"
                      @click="filters.category = []"
                    />
                  </UFormField>

                  <UFormField label="Payment Method">
                    <USelect
                      v-model="filters.paymentMethod"
                      :items="paymentMethodFilterItems"
                      class="w-full"
                    />
                  </UFormField>

                  <div class="grid grid-cols-2 gap-3">
                    <UFormField label="Billable">
                      <USelect v-model="filters.billable" :items="boolFilterItems" class="w-full" />
                    </UFormField>
                    <UFormField label="Tax Deductible">
                      <USelect
                        v-model="filters.deductible"
                        :items="boolFilterItems"
                        class="w-full"
                      />
                    </UFormField>
                  </div>
                </div>
              </div>
            </template>
          </UPopover>
        </div>
      </template>

      <UTable
        v-model:sorting="sorting"
        v-model:row-selection="rowSelection"
        :data="filteredExpenses"
        :columns="columns"
        :get-row-id="(row) => row.id"
        :row-selection-options="{ enableMultiRowSelection: true }"
        empty="No expenses yet. Add your first one above."
        :ui="{
          thead: 'bg-elevated/50 border-b border-default',
          th: 'px-4 py-3 align-middle text-xs font-semibold uppercase tracking-wider text-muted',
          td: 'px-4 py-3 align-middle',
          tr: 'hover:bg-elevated/50 transition-colors'
        }"
      />

      <template #footer>
        <p class="text-sm font-medium text-muted">
          {{ filteredExpenses.length }} expenses &middot; Total:
          <span class="font-semibold text-default">{{ formatCurrency(filteredTotal) }}</span>
        </p>
      </template>
    </UCard>

    <!-- Floating Bulk Actions Bar -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-100 translate-y-12"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-100 translate-y-8"
    >
      <div
        v-if="selectedExpenses.length > 0"
        class="no-print fixed bottom-3 left-1/2 z-50 w-[calc(100vw-1rem)] -translate-x-1/2 px-1 sm:w-fit sm:max-w-[calc(100vw-2rem)] sm:px-0"
      >
        <FloatingBulkActionsBar
          :selected-count="selectedExpenses.length"
          :selected-total="formatCurrency(selectedTotal)"
          :categories="categoryNames"
          @mark-billable="markSelectedBillable(true)"
          @mark-not-billable="markSelectedBillable(false)"
          @mark-deductible="markSelectedDeductible(true)"
          @mark-not-deductible="markSelectedDeductible(false)"
          @set-category="setSelectedCategory"
          @delete-selected="deleteSelected"
          @clear-selection="rowSelection = {}"
        />
      </div>
    </Transition>

    <!-- Modals -->
    <ExpenseModal v-model:open="modalOpen" :expense="editingExpense" @submit="handleModalSubmit" />
    <RecurringManager v-model:open="recurringOpen" />

    <!-- Hidden file input for quick receipt attach from table -->
    <input
      ref="quickUploadInput"
      type="file"
      class="hidden"
      accept="image/jpeg,image/png,application/pdf"
      @change="onQuickFileChange"
    />
  </div>
</template>
