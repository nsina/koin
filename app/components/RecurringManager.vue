<script setup lang="ts">
import type { RecurringTemplate } from '~/composables/useRecurring'
import { PAYMENT_METHODS } from '~/composables/useExpenseStore'
import { TAX_CATEGORIES } from '~/utils/taxRules'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { recurringTemplates, addTemplate, updateTemplate, deleteTemplate } = useRecurring()
const { confirm } = useConfirm()
const toast = useToast()

const formOpen = ref(false)
const editingTemplate = ref<RecurringTemplate | null>(null)
const formCardRef = ref<HTMLElement | null>(null)

function scrollFormIntoView() {
  if (!import.meta.client) return

  nextTick(() => {
    formCardRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

const categoryItems = TAX_CATEGORIES.map((c) => c.name)
const frequencyItems = ['monthly', 'quarterly', 'annually']
const formDismissLabel = computed(() => (recurringTemplates.value.length === 0 ? 'Cancel' : 'Hide'))

function makeDraft() {
  return {
    vendor: editingTemplate.value?.vendor ?? '',
    amount: editingTemplate.value?.amount ?? 0,
    category: editingTemplate.value?.category ?? TAX_CATEGORIES[0]!.name,
    paymentMethod: editingTemplate.value?.paymentMethod ?? PAYMENT_METHODS[0]!,
    description: editingTemplate.value?.description ?? '',
    clientBillable: editingTemplate.value?.clientBillable ?? false,
    taxDeductible: editingTemplate.value?.taxDeductible ?? true,
    deductiblePct: editingTemplate.value?.deductiblePct ?? 100,
    frequency: editingTemplate.value?.frequency ?? ('monthly' as RecurringTemplate['frequency']),
    nextDueDate: editingTemplate.value?.nextDueDate ?? getTodayISO(),
    endDate: editingTemplate.value?.endDate ?? null,
    autoAdd: editingTemplate.value?.autoAdd ?? false,
    active: editingTemplate.value?.active ?? true
  }
}

const draft = reactive(makeDraft())

watch(editingTemplate, () => {
  Object.assign(draft, makeDraft())
})

function openNew() {
  editingTemplate.value = null
  Object.assign(draft, makeDraft())
  formOpen.value = true
  scrollFormIntoView()
}

function openEdit(t: RecurringTemplate) {
  editingTemplate.value = t
  formOpen.value = true
  scrollFormIntoView()
}

function cancelForm() {
  if (recurringTemplates.value.length === 0) {
    emit('update:open', false)
    return
  }

  formOpen.value = false
}

async function submit() {
  if (!draft.vendor.trim()) {
    toast.add({ title: 'Vendor is required', color: 'warning' })
    return
  }
  if (editingTemplate.value) {
    await updateTemplate(editingTemplate.value.id, draft)
    toast.add({ title: 'Template updated', color: 'success' })
  } else {
    await addTemplate(draft)
    toast.add({ title: 'Recurring template added', color: 'success' })
  }
  formOpen.value = false
}

async function remove(t: RecurringTemplate) {
  const ok = await confirm({
    title: `Delete recurring template for ${t.vendor}?`,
    description: 'This will not delete previously auto-added expenses.'
  })
  if (ok) deleteTemplate(t.id)
}

async function toggleActive(t: RecurringTemplate) {
  await updateTemplate(t.id, { active: !t.active })
}

watch(
  [() => props.open, () => recurringTemplates.value.length],
  ([isOpen, templateCount]) => {
    if (!isOpen) {
      formOpen.value = false
      editingTemplate.value = null
      return
    }

    if (templateCount === 0) {
      openNew()
    }
  },
  { immediate: true }
)
</script>

<template>
  <UModal
    :open="props.open"
    title="Recurring Expenses"
    :ui="{ content: 'sm:max-w-5xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <p class="text-sm text-muted">Templates auto-add or remind you when expenses are due.</p>
          <UButton
            v-if="recurringTemplates.length > 0"
            icon="i-lucide-plus"
            label="Add Template"
            color="neutral"
            variant="outline"
            size="sm"
            @click="openNew"
          />
        </div>

        <!-- Template form (inline) -->
        <div
          v-if="formOpen"
          ref="formCardRef"
          class="space-y-3 rounded-xl border border-default bg-muted p-4"
        >
          <p class="font-semibold">{{ editingTemplate ? 'Edit Template' : 'New Template' }}</p>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <UFormField label="Vendor">
              <UInput v-model="draft.vendor" placeholder="Adobe Inc." class="w-full" />
            </UFormField>
            <UFormField label="Amount ($)">
              <UInputNumber
                v-model="draft.amount"
                :min="0"
                :step="0.01"
                :increment="false"
                :decrement="false"
                :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Category">
              <USelect v-model="draft.category" :items="categoryItems" class="w-full" />
            </UFormField>
            <UFormField label="Payment Method">
              <USelect v-model="draft.paymentMethod" :items="PAYMENT_METHODS" class="w-full" />
            </UFormField>
            <UFormField label="Frequency">
              <USelect v-model="draft.frequency" :items="frequencyItems" class="w-full" />
            </UFormField>
            <UFormField label="Next Due Date">
              <AppDatePicker v-model="draft.nextDueDate" />
            </UFormField>
            <UFormField label="End Date (optional)">
              <AppDatePicker
                :model-value="draft.endDate ?? undefined"
                @update:model-value="
                  (v) => {
                    draft.endDate = v || null
                  }
                "
              />
            </UFormField>
          </div>
          <div class="flex flex-wrap items-center gap-5">
            <USwitch v-model="draft.autoAdd" label="Auto-add on due date" color="neutral" />
            <USwitch v-model="draft.active" label="Active" color="neutral" />
          </div>
          <div class="flex justify-end gap-2">
            <UButton
              :label="formDismissLabel"
              color="neutral"
              variant="soft"
              size="sm"
              @click="cancelForm"
            />
            <UButton label="Save" color="neutral" variant="solid" size="sm" @click="submit" />
          </div>
        </div>

        <!-- Templates list -->
        <div
          v-if="recurringTemplates.length === 0 && !formOpen"
          class="rounded-xl border border-dashed border-muted px-4 py-10 text-center text-muted"
        >
          No recurring templates yet.
        </div>

        <div
          v-else-if="recurringTemplates.length > 0"
          class="overflow-x-auto rounded-xl border border-default"
        >
          <table class="min-w-full">
            <thead>
              <tr class="table-header-row">
                <th class="px-4 py-3">Vendor</th>
                <th class="px-4 py-3 text-right">Amount</th>
                <th class="px-4 py-3">Category</th>
                <th class="px-4 py-3">Frequency</th>
                <th class="px-4 py-3">Next Due</th>
                <th class="px-4 py-3 text-center">Auto-add</th>
                <th class="px-4 py-3 text-center">Active</th>
                <th class="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="t in recurringTemplates"
                :key="t.id"
                class="border-b border-muted last:border-0"
                :class="{ 'opacity-50': !t.active }"
              >
                <td class="px-4 py-3 font-semibold">{{ t.vendor }}</td>
                <td class="px-4 py-3 text-right tabular-nums">{{ formatCurrency(t.amount) }}</td>
                <td class="px-4 py-3">
                  <UBadge :label="t.category" color="neutral" variant="subtle" size="sm" />
                </td>
                <td class="px-4 py-3 text-sm text-muted capitalize">{{ t.frequency }}</td>
                <td class="px-4 py-3 text-sm">{{ formatDateLong(t.nextDueDate) }}</td>
                <td class="px-4 py-3 text-center">
                  <UIcon
                    :name="t.autoAdd ? 'i-lucide-check-circle' : 'i-lucide-minus'"
                    :class="t.autoAdd ? 'size-4 text-success' : 'size-4 text-dimmed'"
                  />
                </td>
                <td class="px-4 py-3 text-center">
                  <UButton
                    :label="t.active ? 'Active' : 'Paused'"
                    :color="t.active ? 'success' : 'neutral'"
                    variant="subtle"
                    size="xs"
                    class="w-16 justify-center"
                    @click="toggleActive(t)"
                  />
                </td>
                <td class="px-4 py-3 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <UButton
                      icon="i-lucide-pencil"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      @click="openEdit(t)"
                    />
                    <UButton
                      icon="i-lucide-trash-2"
                      color="error"
                      variant="ghost"
                      size="sm"
                      @click="remove(t)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </UModal>
</template>
