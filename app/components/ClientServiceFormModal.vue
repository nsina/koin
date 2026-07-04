<script setup lang="ts">
import type {
  BillingCadence,
  ClientService,
  ClientServiceStatus,
  PricingModel,
} from '~/composables/useClients'

const props = defineProps<{
  open: boolean
  service: ClientService | null
  defaultClientId: string | null
}>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { clients, addService, updateService } = useClients()
const toast = useToast()

const SERVICE_STATUS_ITEMS = [
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' },
  { label: 'Completed', value: 'completed' },
]

const CADENCE_ITEMS = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Annually', value: 'annually' },
  { label: 'One-time', value: 'one_time' },
]

const PRICING_MODEL_ITEMS = [
  { label: 'Fixed fee', value: 'fixed' },
  { label: 'Hourly', value: 'hourly' },
]

const clientItems = computed(() =>
  clients.value.map((client) => ({ label: client.name, value: client.id })),
)

function makeDraft() {
  return {
    clientId: props.service?.clientId ?? props.defaultClientId ?? '',
    name: props.service?.name ?? '',
    amount: props.service?.amount ?? 0,
    pricingModel: props.service?.pricingModel ?? ('fixed' as PricingModel),
    hourlyRate: props.service?.hourlyRate ?? 0,
    estimatedMonthlyHours: props.service?.estimatedMonthlyHours ?? 0,
    billingCadence: props.service?.billingCadence ?? ('monthly' as BillingCadence),
    startDate: props.service?.startDate ?? getTodayISO(),
    endDate: props.service?.endDate ?? null,
    commitmentEndDate: props.service?.commitmentEndDate ?? null,
    status: props.service?.status ?? ('active' as ClientServiceStatus),
    notes: props.service?.notes ?? '',
  }
}

const draft = reactive(makeDraft())
const saving = ref(false)

watch(
  () => [props.open, props.service] as const,
  ([open, service], prev) => {
    const wasOpen = prev?.[0] ?? false
    const serviceChanged = prev !== undefined && prev[1] !== service
    if ((open && !wasOpen) || serviceChanged) Object.assign(draft, makeDraft())
  },
  { immediate: true },
)

// Hourly is inherently a monthly run rate (rate x est. monthly hours), so its
// cadence is fixed to monthly.
watch(
  () => draft.pricingModel,
  (model) => {
    if (model === 'hourly') draft.billingCadence = 'monthly'
  },
)

const hourlyMonthly = computed(() => round2(draft.hourlyRate * draft.estimatedMonthlyHours))

function close() {
  emit('update:open', false)
}

async function submit() {
  if (!draft.clientId) {
    toast.add({ title: 'Select a client', color: 'warning' })
    return
  }
  if (!draft.name.trim()) {
    toast.add({ title: 'Service name is required', color: 'warning' })
    return
  }
  if (draft.pricingModel === 'hourly' && draft.hourlyRate <= 0) {
    toast.add({ title: 'Hourly rate must be greater than zero', color: 'warning' })
    return
  }
  if (draft.pricingModel === 'hourly' && draft.estimatedMonthlyHours <= 0) {
    toast.add({ title: 'Estimated monthly hours must be greater than zero', color: 'warning' })
    return
  }
  if (draft.pricingModel !== 'hourly' && draft.amount <= 0) {
    toast.add({ title: 'Amount must be greater than zero', color: 'warning' })
    return
  }
  if (draft.endDate && draft.endDate < draft.startDate) {
    toast.add({ title: 'End date must be after the start date', color: 'warning' })
    return
  }
  if (draft.commitmentEndDate && draft.commitmentEndDate < draft.startDate) {
    toast.add({ title: 'Commitment date must be after the start date', color: 'warning' })
    return
  }

  const payload = {
    clientId: draft.clientId,
    name: draft.name.trim(),
    amount:
      draft.pricingModel === 'hourly'
        ? round2(draft.hourlyRate * draft.estimatedMonthlyHours)
        : round2(draft.amount),
    pricingModel: draft.pricingModel,
    hourlyRate: draft.pricingModel === 'hourly' ? round2(draft.hourlyRate) : null,
    estimatedMonthlyHours:
      draft.pricingModel === 'hourly' ? round2(draft.estimatedMonthlyHours) : null,
    billingCadence: draft.billingCadence,
    startDate: draft.startDate,
    endDate: draft.endDate || null,
    commitmentEndDate: draft.commitmentEndDate || null,
    status: draft.status,
    notes: draft.notes.trim(),
  }

  saving.value = true
  try {
    if (props.service) await updateService(props.service.id, payload)
    else await addService(payload)
    close()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="service ? 'Edit Service' : 'New Service'"
    :dismissible="false"
    :ui="{ content: 'sm:max-w-3xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Client" class="sm:col-span-2">
          <USelect
            v-model="draft.clientId"
            :items="clientItems"
            value-key="value"
            label-key="label"
            placeholder="Select a client..."
            class="w-full"
          />
        </UFormField>

        <UFormField label="Service" class="sm:col-span-2">
          <UInput v-model="draft.name" placeholder="Retainer, project, setup fee" class="w-full" />
        </UFormField>

        <UFormField label="Pricing">
          <USelect
            v-model="draft.pricingModel"
            :items="PRICING_MODEL_ITEMS"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Cadence" :hint="draft.pricingModel === 'hourly' ? 'Monthly' : undefined">
          <USelect
            v-model="draft.billingCadence"
            :items="CADENCE_ITEMS"
            value-key="value"
            label-key="label"
            :disabled="draft.pricingModel === 'hourly'"
            class="w-full"
          />
        </UFormField>

        <UFormField v-if="draft.pricingModel === 'fixed'" label="Amount" class="sm:col-span-2">
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
        <template v-else>
          <UFormField label="Hourly Rate">
            <UInputNumber
              v-model="draft.hourlyRate"
              :min="0"
              :step="1"
              :increment="false"
              :decrement="false"
              :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Est. Monthly Hours">
            <UInputNumber
              v-model="draft.estimatedMonthlyHours"
              :min="0"
              :step="1"
              :increment="false"
              :decrement="false"
              class="w-full"
            />
          </UFormField>
          <p class="text-sm text-muted sm:col-span-2">
            Estimated monthly revenue:
            <span class="font-semibold text-default tabular-nums">{{
              formatCurrency(hourlyMonthly)
            }}</span>
          </p>
        </template>

        <UFormField label="Start Date">
          <AppDatePicker v-model="draft.startDate" block />
        </UFormField>
        <UFormField label="Status">
          <USelect
            v-model="draft.status"
            :items="SERVICE_STATUS_ITEMS"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </UFormField>

        <UFormField label="End Date" hint="Optional">
          <AppDatePicker
            block
            clearable
            placeholder="Ongoing"
            :model-value="draft.endDate ?? undefined"
            @update:model-value="(v) => (draft.endDate = v || null)"
          />
        </UFormField>
        <UFormField
          label="Commitment Through"
          hint="Optional"
          help="Revenue counts as committed through this date, projected after."
        >
          <AppDatePicker
            block
            clearable
            placeholder="Not committed"
            :model-value="draft.commitmentEndDate ?? undefined"
            @update:model-value="(v) => (draft.commitmentEndDate = v || null)"
          />
        </UFormField>

        <UFormField label="Notes" class="sm:col-span-2">
          <UTextarea v-model="draft.notes" :rows="2" autoresize class="w-full" />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="soft" @click="close" />
        <UButton
          :label="service ? 'Save Service' : 'Add Service'"
          :icon="service ? 'i-lucide-save' : 'i-lucide-plus'"
          :loading="saving"
          color="neutral"
          variant="solid"
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
