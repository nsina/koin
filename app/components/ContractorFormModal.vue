<script setup lang="ts">
import type { Contractor } from '~/composables/useContractors'

const props = defineProps<{
  open: boolean
  contractor: Contractor | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { addContractor, updateContractor } = useContractors()
const toast = useToast()

const showEin = ref(false)

const BUSINESS_TYPES = [
  { label: 'Individual', value: 'individual' },
  { label: 'Single-member LLC', value: 'single_member_llc' },
  { label: 'Partnership', value: 'partnership' },
  { label: 'Corporation', value: 'corporation' }
]

function makeDraft() {
  return {
    name: props.contractor?.name ?? '',
    businessType: props.contractor?.businessType ?? ('individual' as Contractor['businessType']),
    ein: props.contractor?.ein ?? '',
    email: props.contractor?.email ?? '',
    w9Received: props.contractor?.w9Received ?? false,
    is1099Exempt: props.contractor?.is1099Exempt ?? false,
    notes: props.contractor?.notes ?? ''
  }
}

const draft = reactive(makeDraft())

watch(
  () => props.contractor,
  () => {
    Object.assign(draft, makeDraft())
  },
  { immediate: true }
)

// Auto-set 1099 exempt for corporations
watch(
  () => draft.businessType,
  (type) => {
    draft.is1099Exempt = type === 'corporation'
  }
)

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
  if (props.contractor) {
    await updateContractor(props.contractor.id, payload)
  } else {
    await addContractor(payload)
  }
  emit('update:open', false)
}
</script>

<template>
  <UModal
    :open="open"
    :title="contractor ? 'Edit Contractor' : 'Add Contractor'"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
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
            :disabled="draft.businessType === 'corporation' || draft.businessType === 'individual'"
          />
        </div>

        <UAlert
          v-if="draft.businessType === 'corporation'"
          color="info"
          icon="i-lucide-info"
          title="Corporations are generally exempt from Form 1099-NEC."
        />
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Cancel"
          color="neutral"
          variant="soft"
          @click="emit('update:open', false)"
        />
        <UButton
          :label="contractor ? 'Save' : 'Add Contractor'"
          color="neutral"
          variant="solid"
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
