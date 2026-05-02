<script setup lang="ts">
import type { SelectMenuItem } from '@nuxt/ui'
import type { Expense, ExpenseDraft } from '~/composables/useExpenseStore'
import { PAYMENT_METHODS } from '~/composables/useExpenseStore'
import { TAX_CATEGORIES, findTaxCategoryByName } from '~/utils/taxRules'

const props = defineProps<{
  open: boolean
  expense: Expense | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [draft: ExpenseDraft, id: string | null]
}>()

const { getTaxDefaultsForCategory, vendorSuggestions } = useExpenseStore()
const { defaultPaymentMethod } = useSettings()
const { contractors, addContractor } = useContractors()
const { addTemplate } = useRecurring()
const toast = useToast()

// ── Inline contractor creation ────────────────────────────────────────────────

const quickCreateOpen = ref(false)
const quickName = ref('')
const quickCreating = ref(false)

function openQuickCreate() {
  quickName.value = draft.vendor.trim()
  quickCreateOpen.value = true
}

async function submitQuickCreate() {
  if (!quickName.value.trim()) return
  quickCreating.value = true
  try {
    const created = await addContractor({
      name: quickName.value.trim(),
      businessType: 'individual',
      ein: null,
      email: null,
      w9Received: false,
      notes: '',
      is1099Exempt: false,
    })
    draft.contractorId = created.id
    quickCreateOpen.value = false
  } finally {
    quickCreating.value = false
  }
}

const SPECIAL_CATEGORY_ICONS: Record<string, string> = {
  'Contractors & Freelancers': 'i-lucide-user-check',
  'Equipment & Hardware': 'i-lucide-monitor',
  'Meals & Coffee (Business)': 'i-lucide-utensils',
}

const categoryItems: SelectMenuItem[] = [
  { type: 'label', label: 'Requires extra info' },
  ...TAX_CATEGORIES.filter((c) => c.name in SPECIAL_CATEGORY_ICONS).map((c) => ({
    label: c.name,
    value: c.name,
    icon: SPECIAL_CATEGORY_ICONS[c.name],
  })),
  { type: 'separator' },
  ...TAX_CATEGORIES.filter((c) => !(c.name in SPECIAL_CATEGORY_ICONS)).map((c) => ({
    label: c.name,
    value: c.name,
  })),
]
const paymentMethodItems = PAYMENT_METHODS

const contractorItems = computed(() => [
  { label: 'None', value: null },
  ...contractors.value.map((c) => ({ label: c.name, value: c.id })),
])

const pendingFiles = ref<File[] | null>(null)
const uploading = ref(false)
const descriptionRef = ref<{ autoResize: () => void } | null>(null)

function makeDraft(): ExpenseDraft {
  if (props.expense) {
    return {
      date: props.expense.date,
      vendor: props.expense.vendor,
      amount: props.expense.amount,
      category: props.expense.category,
      description: props.expense.description,
      paymentMethod: props.expense.paymentMethod,
      clientBillable: props.expense.clientBillable,
      taxDeductible: props.expense.taxDeductible,
      deductiblePct: props.expense.deductiblePct,
      receiptKeys: [...(props.expense.receipts ?? [])],
      contractorId: props.expense.contractorId ?? null,
      section179: props.expense.section179,
      businessUsePct: props.expense.businessUsePct,
      isRecurring: false,
      recurringFrequency: 'monthly',
      recurringAutoAdd: false,
    }
  }
  const category = TAX_CATEGORIES[0]!.name
  const defaults = getTaxDefaultsForCategory(category)
  return {
    date: getTodayISO(),
    vendor: '',
    amount: 0,
    category,
    description: '',
    paymentMethod: defaultPaymentMethod.value,
    clientBillable: false,
    taxDeductible: defaults.taxDeductible,
    deductiblePct: defaults.deductiblePct,
    receiptKeys: [],
    contractorId: null,
    section179: false,
    businessUsePct: 100,
    isRecurring: false,
    recurringFrequency: 'monthly',
    recurringAutoAdd: false,
  }
}

const draft = reactive<ExpenseDraft>(makeDraft())

function normalizeName(value: string) {
  return value.trim().toLowerCase()
}

watch(
  () => [props.open, props.expense] as const,
  ([open, expense], prev) => {
    const wasOpen = prev?.[0] ?? false
    const expenseChanged = prev !== undefined && prev[1] !== expense
    if ((open && !wasOpen) || expenseChanged) {
      Object.assign(draft, makeDraft())
      pendingFiles.value = null
      nextTick(() => descriptionRef.value?.autoResize())
    }
  },
  { immediate: true },
)

watch(pendingFiles, async (files) => {
  if (!files?.length) return
  uploading.value = true
  try {
    const form = new FormData()
    for (const file of files) form.append('files', file)
    const blobs = await $fetch<{ pathname: string }[]>('/api/receipts/upload', {
      method: 'POST',
      body: form,
    })
    for (const b of blobs) draft.receiptKeys.push(b.pathname)
    pendingFiles.value = null
  } catch {
    toast.add({ title: 'Upload failed', description: 'Could not attach receipt.', color: 'error' })
  } finally {
    uploading.value = false
  }
})

// Auto-set deductible % when category changes
watch(
  () => draft.category,
  (category) => {
    const defaults = getTaxDefaultsForCategory(category)
    draft.taxDeductible = defaults.taxDeductible
    draft.deductiblePct = defaults.deductiblePct
    const cat = findTaxCategoryByName(category)
    if (cat?.specialHandling !== 'equipment') {
      draft.section179 = false
      draft.businessUsePct = 100
    }
    if (cat?.specialHandling !== 'contractor') {
      draft.contractorId = null
    }
  },
)

watch(
  () => draft.taxDeductible,
  (value) => {
    if (!value) {
      draft.deductiblePct = 0
    } else if (draft.deductiblePct === 0) {
      draft.deductiblePct = getTaxDefaultsForCategory(draft.category).deductiblePct
    }
  },
)

// Auto-disable Section 179 when business use is 50% or less (IRS requires >50%)
watch(
  () => draft.businessUsePct,
  (pct) => {
    if (pct <= 50) draft.section179 = false
  },
)

// Smart sync: selecting a contractor can seed an empty vendor field.
watch(
  () => draft.contractorId,
  (contractorId) => {
    if (!isContractorCategory.value || !contractorId || draft.vendor.trim()) return

    const selected = contractors.value.find((contractor) => contractor.id === contractorId)
    if (selected) {
      draft.vendor = selected.name
    }
  },
)

// Smart sync: exact vendor name match auto-links a contractor.
watch(
  () => draft.vendor,
  (vendor) => {
    if (!isContractorCategory.value) return

    const normalizedVendor = normalizeName(vendor)
    if (!normalizedVendor) return

    const exactMatch = contractors.value.find(
      (contractor) => normalizeName(contractor.name) === normalizedVendor,
    )

    if (exactMatch && draft.contractorId !== exactMatch.id) {
      draft.contractorId = exactMatch.id
    }
  },
)

const currentTaxCategory = computed(() => findTaxCategoryByName(draft.category))
const isEquipmentCategory = computed(
  () => currentTaxCategory.value?.specialHandling === 'equipment',
)
const isContractorCategory = computed(
  () => currentTaxCategory.value?.specialHandling === 'contractor',
)
const isDeductiblePctLocked = computed(() => currentTaxCategory.value?.isLocked ?? false)

const hintConfig = computed(() => {
  const hint = currentTaxCategory.value?.uiHint
  if (!hint) return null
  if (hint.startsWith('🔒'))
    return { color: 'warning' as const, icon: 'i-lucide-lock', text: hint.slice(2).trim() }
  if (hint.startsWith('⚠️'))
    return {
      color: 'warning' as const,
      icon: 'i-lucide-triangle-alert',
      text: hint.slice(2).trim(),
    }
  return { color: 'neutral' as const, icon: 'i-lucide-info', text: hint }
})

function close() {
  emit('update:open', false)
}

async function submit() {
  if (!draft.vendor.trim()) {
    toast.add({ title: 'Vendor is required', color: 'warning' })
    return
  }
  const amount = Math.abs(Number(draft.amount))
  if (!Number.isFinite(amount) || amount <= 0) {
    toast.add({ title: 'Amount must be greater than 0', color: 'warning' })
    return
  }

  emit('submit', { ...draft }, props.expense?.id ?? null)

  // Create recurring template if toggled
  if (draft.isRecurring && !props.expense) {
    await addTemplate({
      vendor: draft.vendor.trim(),
      amount: round2(Math.abs(Number(draft.amount))),
      category: draft.category,
      paymentMethod: draft.paymentMethod,
      description: draft.description,
      clientBillable: draft.clientBillable,
      taxDeductible: draft.taxDeductible,
      deductiblePct: draft.deductiblePct,
      frequency: draft.recurringFrequency,
      nextDueDate: advanceDate(draft.date, draft.recurringFrequency),
      endDate: null,
      autoAdd: draft.recurringAutoAdd,
      active: true,
    })
    toast.add({ title: 'Recurring template created', color: 'success' })
  }

  close()
}
</script>

<template>
  <UModal
    :open="open"
    :title="expense ? 'Edit Expense' : 'New Expense'"
    :ui="{ content: 'sm:max-w-5xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <UFormField label="Date">
            <AppDatePicker v-model="draft.date" />
          </UFormField>

          <UFormField label="Vendor / Payee">
            <UInputMenu
              v-model="draft.vendor"
              :items="vendorSuggestions"
              autocomplete
              clear
              open-on-focus
              :content="{ hideWhenEmpty: true }"
              placeholder="e.g. Adobe Inc."
              class="w-full"
            />
          </UFormField>

          <UFormField label="Amount ($)">
            <UInputNumber
              v-model="draft.amount"
              :min="0"
              :step="0.01"
              :increment="false"
              :decrement="false"
              :format-options="{
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Category">
            <USelectMenu
              v-model="draft.category"
              :items="categoryItems"
              value-key="value"
              :search-input="{ placeholder: 'Search categories...' }"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Payment Method">
            <USelect v-model="draft.paymentMethod" :items="paymentMethodItems" class="w-full" />
          </UFormField>

          <UFormField v-if="!isEquipmentCategory" label="Deductible %">
            <template v-if="hintConfig" #hint>
              <UPopover :content="{ align: 'end', side: 'left', sideOffset: 8 }">
                <UButton
                  :icon="hintConfig.icon"
                  :color="hintConfig.color"
                  variant="ghost"
                  size="xs"
                  class="-my-1"
                />
                <template #content>
                  <p class="max-w-72 p-3 text-sm leading-relaxed text-default">
                    {{ hintConfig.text }}
                  </p>
                </template>
              </UPopover>
            </template>
            <UInputNumber
              v-model="draft.deductiblePct"
              :min="0"
              :max="100"
              :step="1"
              :increment="false"
              :decrement="false"
              :disabled="isDeductiblePctLocked"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Contractor link (Contractors & Freelancers only) -->
        <template v-if="isContractorCategory">
          <UFormField label="Link to Contractor">
            <div class="flex gap-2">
              <USelect
                v-model="draft.contractorId"
                :items="contractorItems"
                value-key="value"
                label-key="label"
                placeholder="Select contractor..."
                class="flex-1"
              />
              <UTooltip text="Add new contractor">
                <UButton
                  icon="i-lucide-user-plus"
                  color="neutral"
                  variant="outline"
                  @click="openQuickCreate"
                />
              </UTooltip>
            </div>
          </UFormField>

          <!-- Quick-create contractor inline -->
          <div v-if="quickCreateOpen" class="rounded-lg border border-default bg-elevated/50 p-4">
            <p class="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">
              New Contractor
            </p>
            <div class="flex items-end gap-2">
              <UFormField label="Full Legal Name" class="flex-1">
                <UInput
                  v-model="quickName"
                  placeholder="Jane Doe or Acme LLC"
                  class="w-full"
                  autofocus
                  @keydown.enter="submitQuickCreate"
                />
              </UFormField>
              <UButton
                label="Hide"
                color="neutral"
                variant="soft"
                @click="quickCreateOpen = false"
              />
              <UButton
                label="Add"
                color="neutral"
                variant="solid"
                :loading="quickCreating"
                @click="submitQuickCreate"
              />
            </div>
            <p class="mt-2 text-xs text-muted">
              Business type and other details can be filled in from the Contractors directory.
            </p>
          </div>
        </template>

        <!-- Section 179 (Equipment & Hardware only) -->
        <div v-if="isEquipmentCategory" class="rounded-lg border border-default bg-elevated/50 p-4">
          <p class="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">
            Section 179 Settings
          </p>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Business Use %">
              <UInputNumber
                v-model="draft.businessUsePct"
                :min="0"
                :max="100"
                :step="1"
                :increment="false"
                :decrement="false"
                class="w-full"
              />
            </UFormField>
            <div class="flex flex-col justify-end gap-1">
              <USwitch
                v-model="draft.section179"
                :disabled="draft.businessUsePct <= 50"
                label="Claim as Section 179"
                color="neutral"
              />
              <p v-if="draft.businessUsePct <= 50" class="text-xs text-warning">
                IRS requires &gt;50% business use to elect Section 179.
              </p>
              <p v-else class="text-xs text-muted">
                Full deduction in year of purchase for equipment used &gt;50% for business.
              </p>
            </div>
          </div>
        </div>

        <UFormField label="Description (optional)" class="w-full">
          <UTextarea
            ref="descriptionRef"
            v-model="draft.description"
            :rows="2"
            autoresize
            placeholder="Short note..."
            class="w-full"
          />
        </UFormField>

        <UFileUpload
          v-model="pendingFiles"
          multiple
          :preview="false"
          accept="image/jpeg,image/png,application/pdf"
          variant="area"
          icon="i-lucide-paperclip"
          label="Drop receipts here or click to browse"
          description="PDF, PNG, JPEG — max 8 MB each"
          color="neutral"
          class="w-full"
        />

        <div v-if="uploading" class="flex items-center gap-2 px-1 text-sm text-muted">
          <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
          Uploading...
        </div>

        <div v-if="draft.receiptKeys.length" class="space-y-1">
          <div
            v-for="(key, i) in draft.receiptKeys"
            :key="key"
            class="flex items-center justify-between gap-2 rounded-lg border border-default bg-muted px-3 py-2 text-sm"
          >
            <a :href="`/${key}`" target="_blank" class="truncate text-default hover:underline">
              {{ key.split('/').pop() }}
            </a>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="draft.receiptKeys.splice(i, 1)"
            />
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-5">
          <USwitch v-model="draft.clientBillable" label="Client Billable" color="neutral" />
        </div>

        <!-- Recurring toggle (new expenses only) -->
        <template v-if="!expense">
          <div class="flex flex-wrap items-center gap-5">
            <USwitch v-model="draft.isRecurring" label="Set as recurring" color="neutral" />
            <USelect
              v-if="draft.isRecurring"
              v-model="draft.recurringFrequency"
              :items="['monthly', 'quarterly', 'annually']"
              class="w-40"
            />
            <USwitch
              v-if="draft.isRecurring"
              v-model="draft.recurringAutoAdd"
              label="Auto-add on due date"
              color="neutral"
            />
          </div>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="soft" @click="close" />
        <UButton
          :label="expense ? 'Save Expense' : 'Add Expense'"
          :icon="expense ? 'i-lucide-save' : 'i-lucide-plus'"
          color="neutral"
          variant="solid"
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
