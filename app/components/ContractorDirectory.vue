<script setup lang="ts">
import type { Contractor } from '~/composables/useContractors'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { contractors, addContractor, updateContractor, deleteContractor, getYtdSpend } =
  useContractors()
const { confirm } = useConfirm()
const toast = useToast()

const formOpen = ref(false)
const editingContractor = ref<Contractor | null>(null)
const showEin = ref(false)
const formCardRef = ref<HTMLElement | null>(null)

function scrollFormIntoView() {
  if (!import.meta.client) return

  nextTick(() => {
    formCardRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

const BUSINESS_TYPES = [
  { label: 'Individual', value: 'individual' },
  { label: 'Single-member LLC', value: 'single_member_llc' },
  { label: 'Partnership', value: 'partnership' },
  { label: 'Corporation', value: 'corporation' }
]

function makeDraft() {
  return {
    name: editingContractor.value?.name ?? '',
    businessType:
      editingContractor.value?.businessType ?? ('individual' as Contractor['businessType']),
    ein: editingContractor.value?.ein ?? '',
    email: editingContractor.value?.email ?? '',
    w9Received: editingContractor.value?.w9Received ?? false,
    is1099Exempt: editingContractor.value?.is1099Exempt ?? false,
    notes: editingContractor.value?.notes ?? ''
  }
}

const draft = reactive(makeDraft())

watch(editingContractor, () => {
  Object.assign(draft, makeDraft())
  showEin.value = false
})

watch(
  () => draft.businessType,
  (type) => {
    draft.is1099Exempt = type === 'corporation'
  }
)

function openNew() {
  editingContractor.value = null
  Object.assign(draft, makeDraft())
  showEin.value = false
  formOpen.value = true
  scrollFormIntoView()
}

function openEdit(c: Contractor) {
  editingContractor.value = c
  formOpen.value = true
  scrollFormIntoView()
}

function cancelForm() {
  if (contractors.value.length === 0) {
    emit('update:open', false)
    return
  }

  formOpen.value = false
}

async function submit() {
  if (!draft.name.trim()) {
    toast.add({ title: 'Name is required', color: 'warning' })
    return
  }
  const payload = {
    name: draft.name.trim(),
    businessType: draft.businessType,
    ein: draft.ein.trim() || null,
    email: draft.email.trim() || null,
    w9Received: draft.w9Received,
    is1099Exempt: draft.is1099Exempt,
    notes: draft.notes.trim()
  }
  if (editingContractor.value) {
    await updateContractor(editingContractor.value.id, payload)
    toast.add({ title: 'Contractor updated', color: 'success' })
  } else {
    await addContractor(payload)
    toast.add({ title: 'Contractor added', color: 'success' })
  }
  formOpen.value = false
}

async function remove(c: Contractor) {
  const ok = await confirm({
    title: `Delete ${c.name}?`,
    description: 'This will not delete linked expenses.'
  })
  if (ok) deleteContractor(c.id)
}

function ytdBadgeColor(ytd: number, w9Received: boolean) {
  if (ytd >= 600 && !w9Received) return 'error'
  if (ytd >= 600 && w9Received) return 'neutral'
  if (ytd >= 500) return 'warning'
  return 'neutral'
}

function ytdBadgeLabel(ytd: number) {
  const s = formatCurrency(ytd)
  if (ytd >= 600) return `${s} — 1099 Required`
  if (ytd >= 500) return `${s} — Collect W-9`
  return s
}

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  individual: 'Individual',
  single_member_llc: 'Single-member LLC',
  partnership: 'Partnership',
  corporation: 'Corporation'
}

const formDismissLabel = computed(() => (contractors.value.length === 0 ? 'Cancel' : 'Hide'))

watch(
  [() => props.open, () => contractors.value.length],
  ([isOpen, contractorCount]) => {
    if (!isOpen) {
      formOpen.value = false
      editingContractor.value = null
      return
    }

    if (contractorCount === 0) {
      openNew()
    }
  },
  { immediate: true }
)
</script>

<template>
  <UModal
    :open="props.open"
    title="Contractors"
    :ui="{ content: 'sm:max-w-5xl max-h-[85vh]' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4 overflow-y-auto">
        <div class="flex items-center justify-between">
          <p class="text-sm text-muted">Track contractors for 1099-NEC compliance.</p>
          <UButton
            v-if="contractors.length > 0"
            icon="i-lucide-plus"
            label="Add Contractor"
            color="neutral"
            variant="outline"
            size="sm"
            @click="openNew"
          />
        </div>

        <!-- Inline contractor form -->
        <div
          v-if="formOpen"
          ref="formCardRef"
          class="space-y-4 rounded-xl border border-default bg-muted p-4"
        >
          <p class="font-semibold">
            {{ editingContractor ? 'Edit Contractor' : 'New Contractor' }}
          </p>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Full Legal Name" class="sm:col-span-2">
              <UInput v-model="draft.name" placeholder="Jane Doe or Acme LLC" class="w-full" />
            </UFormField>

            <UFormField label="Business Type">
              <USelect
                v-model="draft.businessType"
                :items="BUSINESS_TYPES"
                value-key="value"
                label-key="label"
                class="w-full"
              />
            </UFormField>

            <UFormField label="EIN / SSN (masked)">
              <div class="flex gap-2">
                <UInput
                  v-model="draft.ein"
                  :type="showEin ? 'text' : 'password'"
                  placeholder="XX-XXXXXXX"
                  class="w-full"
                />
                <UButton
                  :icon="showEin ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  color="neutral"
                  variant="ghost"
                  @click="showEin = !showEin"
                />
              </div>
              <p class="mt-1 text-xs text-muted">Stored locally only, never transmitted.</p>
            </UFormField>

            <UFormField label="Email (optional)">
              <UInput
                v-model="draft.email"
                type="email"
                placeholder="contractor@example.com"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Notes (optional)" class="sm:col-span-2">
              <UTextarea
                v-model="draft.notes"
                :rows="2"
                autoresize
                placeholder="Any notes..."
                class="w-full"
              />
            </UFormField>
          </div>

          <div class="flex flex-wrap items-center gap-5">
            <USwitch v-model="draft.w9Received" label="W-9 Received" color="neutral" />
            <USwitch
              v-model="draft.is1099Exempt"
              label="1099 Exempt"
              color="neutral"
              :disabled="
                draft.businessType === 'corporation' || draft.businessType === 'individual'
              "
            />
          </div>

          <UAlert
            v-if="draft.businessType === 'corporation'"
            color="info"
            icon="i-lucide-info"
            title="Corporations are generally exempt from Form 1099-NEC."
          />

          <div class="flex justify-end gap-2">
            <UButton
              :label="formDismissLabel"
              color="neutral"
              variant="soft"
              size="sm"
              @click="cancelForm"
            />
            <UButton
              :label="editingContractor ? 'Save' : 'Add Contractor'"
              color="neutral"
              variant="solid"
              size="sm"
              @click="submit"
            />
          </div>
        </div>

        <!-- Contractors list -->
        <div
          v-if="contractors.length === 0 && !formOpen"
          class="rounded-xl border border-dashed border-muted px-4 py-10 text-center text-muted"
        >
          No contractors added yet.
        </div>

        <div
          v-else-if="contractors.length > 0"
          class="overflow-x-auto rounded-xl border border-default"
        >
          <table class="min-w-full">
            <thead>
              <tr class="table-header-row">
                <th class="px-4 py-3 text-left">Name</th>
                <th class="px-4 py-3 text-left">Type</th>
                <th class="px-4 py-3 text-center">W-9</th>
                <th class="px-4 py-3 text-right">YTD Paid</th>
                <th class="px-4 py-3 text-center">1099</th>
                <th class="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in contractors" :key="c.id" class="border-b border-muted last:border-0">
                <td class="px-4 py-3 font-semibold">{{ c.name }}</td>
                <td class="px-4 py-3 text-sm text-muted">
                  {{ BUSINESS_TYPE_LABELS[c.businessType] }}
                </td>
                <td class="px-4 py-3 text-center">
                  <UIcon
                    :name="c.w9Received ? 'i-lucide-check-circle' : 'i-lucide-circle'"
                    :class="c.w9Received ? 'size-4 text-success' : 'size-4 text-dimmed'"
                  />
                </td>
                <td class="px-4 py-3 text-right">
                  <UBadge
                    :label="ytdBadgeLabel(getYtdSpend(c.id))"
                    :color="ytdBadgeColor(getYtdSpend(c.id), c.w9Received)"
                    variant="subtle"
                    size="sm"
                  />
                </td>
                <td class="px-4 py-3 text-center">
                  <UBadge
                    v-if="c.is1099Exempt"
                    label="Exempt"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                  />
                  <UBadge
                    v-else-if="getYtdSpend(c.id) >= 600"
                    label="Required"
                    :color="c.w9Received ? 'neutral' : 'error'"
                    variant="subtle"
                    size="sm"
                  />
                  <span v-else class="text-sm text-dimmed">—</span>
                </td>
                <td class="px-4 py-3 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <UButton
                      icon="i-lucide-pencil"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      @click="openEdit(c)"
                    />
                    <UButton
                      icon="i-lucide-trash-2"
                      color="error"
                      variant="ghost"
                      size="sm"
                      @click="remove(c)"
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
