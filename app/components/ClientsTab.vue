<script setup lang="ts">
import type {
  BillingCadence,
  Client,
  ClientService,
  ClientServiceStatus,
  ClientStatus,
  PricingModel,
} from '~/composables/useClients'
import { LegendPosition } from '#imports'

const {
  clients,
  clientServices,
  addClient,
  updateClient,
  deleteClient,
  addService,
  updateService,
  deleteService,
  servicesForClient,
  serviceForecastAmount,
  monthlyRunRate,
  forecastMonths,
  monthlyForecast,
  currentMonthlyRevenue,
  nextSixCommittedRevenue,
  twelveMonthForecastRevenue,
  committedRunway,
  activeClientCount,
  endingSoonServices,
  timelineRows,
  timelineTodayRatio,
} = useClients()

const { confirm } = useConfirm()
const toast = useToast()

const selectedClientId = ref<string | null>(null)
const clientFormOpen = ref(false)
const serviceFormOpen = ref(false)
const editingClient = ref<Client | null>(null)
const editingService = ref<ClientService | null>(null)

const CLIENT_STATUS_ITEMS = [
  { label: 'Active', value: 'active' },
  { label: 'Prospect', value: 'prospect' },
  { label: 'Paused', value: 'paused' },
  { label: 'Ended', value: 'ended' },
]

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

const STATUS_COLORS: Record<
  ClientStatus | ClientServiceStatus,
  'success' | 'warning' | 'neutral' | 'error'
> = {
  active: 'success',
  prospect: 'warning',
  paused: 'neutral',
  ended: 'error',
  completed: 'neutral',
}

const CADENCE_LABELS = Object.fromEntries(
  CADENCE_ITEMS.map((item) => [item.value, item.label]),
) as Record<BillingCadence, string>

function makeClientDraft() {
  return {
    name: editingClient.value?.name ?? '',
    contactName: editingClient.value?.contactName ?? '',
    email: editingClient.value?.email ?? '',
    billingCode: editingClient.value?.billingCode ?? '',
    status: editingClient.value?.status ?? ('active' as ClientStatus),
    notes: editingClient.value?.notes ?? '',
  }
}

function makeServiceDraft() {
  return {
    clientId: editingService.value?.clientId ?? selectedClientId.value ?? '',
    name: editingService.value?.name ?? '',
    amount: editingService.value?.amount ?? 0,
    pricingModel: editingService.value?.pricingModel ?? ('fixed' as PricingModel),
    hourlyRate: editingService.value?.hourlyRate ?? 0,
    estimatedMonthlyHours: editingService.value?.estimatedMonthlyHours ?? 0,
    billingCadence: editingService.value?.billingCadence ?? ('monthly' as BillingCadence),
    startDate: editingService.value?.startDate ?? getTodayISO(),
    endDate: editingService.value?.endDate ?? null,
    commitmentEndDate: editingService.value?.commitmentEndDate ?? null,
    status: editingService.value?.status ?? ('active' as ClientServiceStatus),
    notes: editingService.value?.notes ?? '',
  }
}

const clientDraft = reactive(makeClientDraft())
const serviceDraft = reactive(makeServiceDraft())

const selectedClient = computed(
  () => clients.value.find((client) => client.id === selectedClientId.value) ?? null,
)

const selectedClientServices = computed(() =>
  selectedClient.value ? servicesForClient(selectedClient.value.id) : [],
)

const clientItems = computed(() =>
  clients.value.map((client) => ({
    label: client.name,
    value: client.id,
  })),
)

const clientSearch = ref('')
const clientStatusFilter = ref<ClientStatus | 'all'>('all')

const CLIENT_FILTER_ITEMS = [{ label: 'All statuses', value: 'all' }, ...CLIENT_STATUS_ITEMS]

const filteredClients = computed(() => {
  const q = clientSearch.value.trim().toLowerCase()
  return clients.value.filter((client) => {
    if (clientStatusFilter.value !== 'all' && client.status !== clientStatusFilter.value)
      return false
    if (!q) return true
    return (
      client.name.toLowerCase().includes(q) ||
      client.billingCode.toLowerCase().includes(q) ||
      client.contactName.toLowerCase().includes(q)
    )
  })
})

function clientMonthlyRevenue(clientId: string) {
  return servicesForClient(clientId)
    .filter((service) => service.status === 'active')
    .reduce((sum, service) => sum + monthlyRunRate(service), 0)
}

const selectedClientRevenue = computed(() =>
  selectedClient.value ? clientMonthlyRevenue(selectedClient.value.id) : 0,
)

const timelineGridStyle = computed(() => ({
  gridTemplateColumns: 'minmax(15rem, 18rem) minmax(46rem, 1fr)',
}))

// Diagonal hatch for the "projected" (uncommitted) portion of a timeline bar.
// currentColor is set to `primary` on the element, so it stays on-hue in both themes.
const PROJECTED_HATCH =
  'repeating-linear-gradient(45deg, color-mix(in srgb, currentColor 38%, transparent) 0 1.5px, transparent 1.5px 7px)'

// ── Revenue Forecast chart (stacked bar: committed vs projected per month) ────
// Single-hue stack: committed = solid primary (the locked floor), projected =
// a soft primary tint (the at-will upside). Same hue reads as "one revenue
// metric, two certainties"; the tint blends toward the surface so it adapts to
// light/dark automatically.
const PROJECTED_FILL = 'color-mix(in srgb, var(--ui-primary) 14%, var(--ui-bg))'
const forecastCategories = {
  committed: { name: 'Committed', color: 'var(--ui-primary)' },
  projected: { name: 'Projected', color: PROJECTED_FILL },
}
const forecastTicks = computed(() => monthlyForecast.value.map((_, i) => i))
function monthAxisLabel(value: number | string | Date) {
  return monthlyForecast.value[Number(value)]?.label.split(' ')[0] ?? ''
}

// Custom hover tooltip. vue-chrts' BarChart tooltip slot is unreliable (it
// snapshots the slot innerHTML before Vue renders it, so it stays blank), so we
// drive our own from the real bar elements via event delegation — perfectly
// aligned and backed by our own reactive state.
const hoverIdx = ref<number | null>(null)
const hoverPos = ref({ x: 0, y: 0 })
const hoveredMonth = computed(() =>
  hoverIdx.value === null ? null : (monthlyForecast.value[hoverIdx.value] ?? null),
)

function onForecastMove(e: MouseEvent) {
  const wrap = e.currentTarget as HTMLElement
  const group = (e.target as HTMLElement).closest('[class*="barGroup"]')
  if (!group) {
    hoverIdx.value = null
    return
  }
  const groups = [...wrap.querySelectorAll('[class*="barGroup"]')]
  const idx = groups.indexOf(group)
  if (idx < 0) {
    hoverIdx.value = null
    return
  }
  const wrapRect = wrap.getBoundingClientRect()
  const gRect = group.getBoundingClientRect()
  const halfTip = 104
  hoverIdx.value = idx
  hoverPos.value = {
    x: Math.min(
      Math.max(gRect.left - wrapRect.left + gRect.width / 2, halfTip),
      wrapRect.width - halfTip,
    ),
    y: Math.max(e.clientY - wrapRect.top, 128),
  }
}

watch(
  () => clients.value.length,
  () => {
    if (!selectedClientId.value && clients.value[0]) selectedClientId.value = clients.value[0].id
    if (selectedClientId.value && !clients.value.some((c) => c.id === selectedClientId.value)) {
      selectedClientId.value = clients.value[0]?.id ?? null
    }
  },
  { immediate: true },
)

watch(editingClient, () => {
  Object.assign(clientDraft, makeClientDraft())
})

watch(editingService, () => {
  Object.assign(serviceDraft, makeServiceDraft())
})

watch(
  () => serviceDraft.pricingModel,
  (model) => {
    if (model === 'hourly') serviceDraft.billingCadence = 'monthly'
  },
)

function openNewClient() {
  editingClient.value = null
  Object.assign(clientDraft, makeClientDraft())
  clientFormOpen.value = true
}

function openEditClient(client: Client) {
  editingClient.value = client
  clientFormOpen.value = true
}

function openNewService(clientId = selectedClientId.value) {
  if (!clientId) return
  editingService.value = null
  Object.assign(serviceDraft, makeServiceDraft(), { clientId })
  serviceFormOpen.value = true
}

function openEditService(service: ClientService) {
  editingService.value = service
  selectedClientId.value = service.clientId
  serviceFormOpen.value = true
}

function closeClientForm() {
  clientFormOpen.value = false
  editingClient.value = null
}

function closeServiceForm() {
  serviceFormOpen.value = false
  editingService.value = null
}

async function submitClient() {
  if (!clientDraft.name.trim()) {
    toast.add({ title: 'Client name is required', color: 'warning' })
    return
  }

  const payload = {
    name: clientDraft.name.trim(),
    contactName: clientDraft.contactName.trim(),
    email: clientDraft.email.trim() || null,
    billingCode: clientDraft.billingCode.trim().toUpperCase(),
    status: clientDraft.status,
    notes: clientDraft.notes.trim(),
  }

  if (editingClient.value) {
    await updateClient(editingClient.value.id, payload)
  } else {
    const client = await addClient(payload)
    selectedClientId.value = client.id
  }
  closeClientForm()
}

async function submitService() {
  if (!serviceDraft.clientId) {
    toast.add({ title: 'Select a client', color: 'warning' })
    return
  }
  if (!serviceDraft.name.trim()) {
    toast.add({ title: 'Service name is required', color: 'warning' })
    return
  }
  if (serviceDraft.pricingModel === 'hourly' && serviceDraft.hourlyRate <= 0) {
    toast.add({ title: 'Hourly rate must be greater than zero', color: 'warning' })
    return
  }
  if (serviceDraft.pricingModel === 'hourly' && serviceDraft.estimatedMonthlyHours <= 0) {
    toast.add({ title: 'Estimated monthly hours must be greater than zero', color: 'warning' })
    return
  }
  if (serviceDraft.pricingModel !== 'hourly' && serviceDraft.amount <= 0) {
    toast.add({ title: 'Amount must be greater than zero', color: 'warning' })
    return
  }
  if (serviceDraft.endDate && serviceDraft.endDate < serviceDraft.startDate) {
    toast.add({ title: 'End date must be after the start date', color: 'warning' })
    return
  }
  if (serviceDraft.commitmentEndDate && serviceDraft.commitmentEndDate < serviceDraft.startDate) {
    toast.add({ title: 'Commitment date must be after the start date', color: 'warning' })
    return
  }

  const payload = {
    clientId: serviceDraft.clientId,
    name: serviceDraft.name.trim(),
    amount:
      serviceDraft.pricingModel === 'hourly'
        ? round2(serviceDraft.hourlyRate * serviceDraft.estimatedMonthlyHours)
        : round2(serviceDraft.amount),
    pricingModel: serviceDraft.pricingModel,
    hourlyRate: serviceDraft.pricingModel === 'hourly' ? round2(serviceDraft.hourlyRate) : null,
    estimatedMonthlyHours:
      serviceDraft.pricingModel === 'hourly' ? round2(serviceDraft.estimatedMonthlyHours) : null,
    billingCadence: serviceDraft.billingCadence,
    startDate: serviceDraft.startDate,
    endDate: serviceDraft.endDate || null,
    commitmentEndDate: serviceDraft.commitmentEndDate || null,
    status: serviceDraft.status,
    notes: serviceDraft.notes.trim(),
  }

  if (editingService.value) await updateService(editingService.value.id, payload)
  else await addService(payload)
  closeServiceForm()
}

async function removeClient(client: Client) {
  const ok = await confirm({
    title: `Delete ${client.name}?`,
    description: 'This also deletes every service attached to this client.',
    confirmLabel: 'Delete Client',
    color: 'error',
  })
  if (ok) await deleteClient(client.id)
}

async function removeService(service: ClientService) {
  const ok = await confirm({
    title: `Delete ${service.name}?`,
    description: 'This removes the service from future revenue forecasts.',
    confirmLabel: 'Delete Service',
    color: 'error',
  })
  if (ok) await deleteService(service.id)
}
</script>

<template>
  <div class="space-y-5">
    <div class="no-print flex flex-wrap items-center gap-2">
      <UButton
        icon="i-lucide-plus"
        label="Add Client"
        color="neutral"
        variant="subtle"
        @click="openNewClient"
      />
      <UButton
        icon="i-lucide-briefcase-business"
        label="Add Service"
        color="neutral"
        variant="ghost"
        :disabled="clients.length === 0"
        @click="openNewService()"
      />
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <UCard>
        <p class="text-sm text-muted">Current Monthly Revenue</p>
        <p class="mt-2 text-4xl font-bold tracking-tight tabular-nums">
          {{ formatCurrency(currentMonthlyRevenue) }}
        </p>
        <p class="mt-4 flex items-center gap-1.5 text-sm font-semibold">
          <UIcon name="i-lucide-users" class="size-4 shrink-0" />
          {{ activeClientCount }} active client{{ activeClientCount !== 1 ? 's' : '' }}
        </p>
      </UCard>

      <UCard>
        <p class="text-sm text-muted">Committed Next 6 Months</p>
        <p class="mt-2 text-4xl font-bold tracking-tight tabular-nums">
          {{ formatCurrency(nextSixCommittedRevenue) }}
        </p>
        <p class="mt-4 flex items-center gap-1.5 text-sm font-semibold">
          <UIcon name="i-lucide-lock-keyhole" class="size-4 shrink-0" />
          Contracted or dated work
        </p>
      </UCard>

      <UCard>
        <p class="text-sm text-muted">12-Month Forecast</p>
        <p class="mt-2 text-4xl font-bold tracking-tight tabular-nums">
          {{ formatCurrency(twelveMonthForecastRevenue) }}
        </p>
        <p class="mt-4 flex items-center gap-1.5 text-sm font-semibold">
          <UIcon name="i-lucide-chart-no-axes-combined" class="size-4 shrink-0" />
          Committed plus projected
        </p>
      </UCard>

      <UCard>
        <p class="text-sm text-muted">Ending Soon</p>
        <p class="mt-2 text-4xl font-bold tracking-tight tabular-nums">
          {{ endingSoonServices.length }}
        </p>
        <p class="mt-4 flex items-center gap-1.5 text-sm font-semibold">
          <UIcon name="i-lucide-calendar-clock" class="size-4 shrink-0" />
          Next 3 months
        </p>
      </UCard>
    </div>

    <div v-if="clientFormOpen" class="rounded-lg border border-default bg-muted p-4">
      <div class="mb-4 flex items-center justify-between gap-3">
        <p class="font-semibold">{{ editingClient ? 'Edit Client' : 'New Client' }}</p>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="closeClientForm"
        />
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Client Name" class="sm:col-span-2">
          <UInput v-model="clientDraft.name" placeholder="Acme Inc." class="w-full" />
        </UFormField>
        <UFormField label="Contact Name">
          <UInput v-model="clientDraft.contactName" placeholder="Jane Doe" class="w-full" />
        </UFormField>
        <UFormField label="Email">
          <UInput
            v-model="clientDraft.email"
            type="email"
            placeholder="client@example.com"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Status">
          <USelect
            v-model="clientDraft.status"
            :items="CLIENT_STATUS_ITEMS"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Billing Code" hint="Mercury" class="sm:col-span-2">
          <UInput
            v-model="clientDraft.billingCode"
            placeholder="DCNE"
            class="w-full font-mono uppercase"
          />
        </UFormField>
        <UFormField label="Notes" class="sm:col-span-2">
          <UTextarea v-model="clientDraft.notes" :rows="2" autoresize class="w-full" />
        </UFormField>
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="soft" @click="closeClientForm" />
        <UButton
          :label="editingClient ? 'Save Client' : 'Add Client'"
          color="neutral"
          @click="submitClient"
        />
      </div>
    </div>

    <div v-if="serviceFormOpen" class="rounded-lg border border-default bg-muted p-4">
      <div class="mb-4 flex items-center justify-between gap-3">
        <p class="font-semibold">{{ editingService ? 'Edit Service' : 'New Service' }}</p>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="closeServiceForm"
        />
      </div>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UFormField label="Client">
          <USelect
            v-model="serviceDraft.clientId"
            :items="clientItems"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Service">
          <UInput
            v-model="serviceDraft.name"
            placeholder="Retainer, project, setup fee"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Pricing">
          <USelect
            v-model="serviceDraft.pricingModel"
            :items="PRICING_MODEL_ITEMS"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </UFormField>
        <UFormField v-if="serviceDraft.pricingModel === 'fixed'" label="Amount">
          <UInputNumber
            v-model="serviceDraft.amount"
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
              v-model="serviceDraft.hourlyRate"
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
              v-model="serviceDraft.estimatedMonthlyHours"
              :min="0"
              :step="1"
              :increment="false"
              :decrement="false"
              class="w-full"
            />
          </UFormField>
        </template>
        <UFormField label="Cadence">
          <USelect
            v-model="serviceDraft.billingCadence"
            :items="CADENCE_ITEMS"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Start Date">
          <AppDatePicker v-model="serviceDraft.startDate" />
        </UFormField>
        <UFormField label="End Date">
          <AppDatePicker
            :model-value="serviceDraft.endDate ?? undefined"
            @update:model-value="(v) => (serviceDraft.endDate = v || null)"
          />
        </UFormField>
        <UFormField label="Commitment Through">
          <AppDatePicker
            :model-value="serviceDraft.commitmentEndDate ?? undefined"
            @update:model-value="(v) => (serviceDraft.commitmentEndDate = v || null)"
          />
        </UFormField>
        <UFormField label="Status">
          <USelect
            v-model="serviceDraft.status"
            :items="SERVICE_STATUS_ITEMS"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Notes" class="sm:col-span-2 xl:col-span-4">
          <UTextarea v-model="serviceDraft.notes" :rows="2" autoresize class="w-full" />
        </UFormField>
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="soft" @click="closeServiceForm" />
        <UButton
          :label="editingService ? 'Save Service' : 'Add Service'"
          color="neutral"
          @click="submitService"
        />
      </div>
    </div>

    <div class="grid items-start gap-4 xl:grid-cols-5">
      <UCard class="xl:col-span-2" :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-semibold">Clients</h3>
            <UBadge
              :label="
                filteredClients.length === clients.length
                  ? String(clients.length)
                  : `${filteredClients.length} / ${clients.length}`
              "
              color="neutral"
              variant="soft"
            />
          </div>
        </template>

        <div
          v-if="clients.length > 0"
          class="flex flex-col gap-2 border-b border-default p-3 sm:flex-row"
        >
          <UInput
            v-model="clientSearch"
            icon="i-lucide-search"
            placeholder="Search name, contact, code"
            size="sm"
            class="w-full"
          />
          <USelect
            v-model="clientStatusFilter"
            :items="CLIENT_FILTER_ITEMS"
            value-key="value"
            label-key="label"
            size="sm"
            class="w-full sm:w-40"
          />
        </div>

        <div v-if="clients.length === 0" class="px-4 py-12 text-center text-sm text-muted">
          No clients yet.
        </div>
        <div
          v-else-if="filteredClients.length === 0"
          class="flex h-96 items-center justify-center px-4 text-center text-sm text-muted"
        >
          No clients match your filters.
        </div>
        <div v-else class="h-96 divide-y divide-muted overflow-y-auto">
          <button
            v-for="client in filteredClients"
            :key="client.id"
            type="button"
            class="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-elevated"
            :class="{ 'bg-elevated': selectedClientId === client.id }"
            @click="selectedClientId = client.id"
          >
            <span class="min-w-0">
              <span class="block truncate font-semibold">{{ client.name }}</span>
              <span class="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <UBadge
                  :label="client.status"
                  :color="STATUS_COLORS[client.status]"
                  variant="subtle"
                  size="sm"
                  class="capitalize"
                />
                <span v-if="client.billingCode" class="font-mono text-muted">{{
                  client.billingCode
                }}</span>
                <span
                  >{{ servicesForClient(client.id).length }} service{{
                    servicesForClient(client.id).length !== 1 ? 's' : ''
                  }}</span
                >
              </span>
            </span>
            <span class="shrink-0 text-sm font-semibold tabular-nums">
              {{ formatCurrency(clientMonthlyRevenue(client.id)) }}
            </span>
          </button>
        </div>
      </UCard>

      <UCard class="xl:col-span-3">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-semibold">{{ selectedClient?.name ?? 'Client Detail' }}</h3>
                <UBadge
                  v-if="selectedClient?.billingCode"
                  :label="selectedClient.billingCode"
                  color="neutral"
                  variant="soft"
                  size="sm"
                  class="font-mono"
                />
              </div>
              <p v-if="selectedClient" class="text-xs text-muted">
                {{ selectedClient.contactName || selectedClient.email || 'No contact saved' }}
              </p>
            </div>
            <div v-if="selectedClient" class="flex items-center gap-1">
              <UButton
                icon="i-lucide-plus"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="openNewService(selectedClient.id)"
              />
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="openEditClient(selectedClient)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="sm"
                @click="removeClient(selectedClient)"
              />
            </div>
          </div>
        </template>

        <div v-if="!selectedClient" class="py-12 text-center text-sm text-muted">
          Select or add a client.
        </div>
        <div v-else class="space-y-4">
          <UCard variant="soft" :ui="{ body: 'p-0 sm:p-0' }">
            <div class="grid grid-cols-3 divide-x divide-default">
              <div class="px-4 py-3">
                <p class="text-xs text-muted">Monthly Run Rate</p>
                <p class="mt-1 text-xl font-semibold tabular-nums">
                  {{ formatCurrency(selectedClientRevenue) }}
                </p>
              </div>
              <div class="px-4 py-3">
                <p class="text-xs text-muted">Services</p>
                <p class="mt-1 text-xl font-semibold tabular-nums">
                  {{ selectedClientServices.length }}
                </p>
              </div>
              <div class="px-4 py-3">
                <p class="text-xs text-muted">Status</p>
                <UBadge
                  :label="selectedClient.status"
                  :color="STATUS_COLORS[selectedClient.status]"
                  variant="subtle"
                  class="mt-1 capitalize"
                />
              </div>
            </div>
          </UCard>

          <div
            v-if="selectedClientServices.length === 0"
            class="rounded-lg border border-dashed border-muted px-4 py-10 text-center text-sm text-muted"
          >
            No services for this client.
          </div>
          <div v-else class="overflow-x-auto rounded-lg border border-default">
            <table class="min-w-full">
              <thead>
                <tr class="table-header-row">
                  <th class="px-4 py-3 text-left">Service</th>
                  <th class="px-4 py-3 text-right">Amount</th>
                  <th class="px-4 py-3 text-left">Cadence</th>
                  <th class="px-4 py-3 text-left">Dates</th>
                  <th class="px-4 py-3 text-center">Status</th>
                  <th class="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="service in selectedClientServices"
                  :key="service.id"
                  class="border-b border-muted last:border-0"
                >
                  <td class="px-4 py-3">
                    <p class="font-semibold">{{ service.name }}</p>
                    <p v-if="service.notes" class="max-w-xs truncate text-xs text-muted">
                      {{ service.notes }}
                    </p>
                  </td>
                  <td class="px-4 py-3 text-right font-semibold tabular-nums">
                    {{ formatCurrency(serviceForecastAmount(service)) }}
                    <p
                      v-if="service.pricingModel === 'hourly'"
                      class="text-xs font-normal text-muted"
                    >
                      {{ formatCurrency(service.hourlyRate ?? 0) }}/hr x
                      {{ service.estimatedMonthlyHours ?? 0 }}h est.
                    </p>
                  </td>
                  <td class="px-4 py-3 text-sm">{{ CADENCE_LABELS[service.billingCadence] }}</td>
                  <td class="px-4 py-3 text-sm text-muted">
                    {{ formatDateShort(service.startDate) }}
                    <template v-if="service.endDate"
                      >- {{ formatDateShort(service.endDate) }}</template
                    >
                    <p v-if="service.commitmentEndDate" class="text-xs text-primary">
                      Committed through {{ formatDateShort(service.commitmentEndDate) }}
                    </p>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <UBadge
                      :label="service.status"
                      :color="STATUS_COLORS[service.status]"
                      variant="subtle"
                      size="sm"
                      class="capitalize"
                    />
                  </td>
                  <td class="px-4 py-3 text-center">
                    <div class="flex items-center justify-center gap-1">
                      <UButton
                        icon="i-lucide-pencil"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        @click="openEditService(service)"
                      />
                      <UButton
                        icon="i-lucide-trash-2"
                        color="error"
                        variant="ghost"
                        size="sm"
                        @click="removeService(service)"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div class="flex items-center gap-2">
            <h3 class="font-semibold">Revenue Forecast</h3>
            <span class="text-xs text-muted">12 months</span>
          </div>
          <p v-if="clientServices.length > 0" class="text-xs text-muted">
            <template v-if="committedRunway.count > 0">
              Committed through
              <span class="font-semibold text-primary">{{ committedRunway.label }}</span>
              · {{ committedRunway.count }} of 12 months contracted
            </template>
            <template v-else>No contracted revenue in the next 12 months</template>
          </p>
        </div>
      </template>
      <div
        v-if="monthlyForecast.length === 0 || clientServices.length === 0"
        class="flex h-72 flex-col items-center justify-center gap-2 text-sm text-dimmed"
      >
        <UIcon name="i-lucide-chart-no-axes-combined" class="size-7 opacity-40" />
        No forecast data yet
      </div>
      <div v-else class="relative h-80" @mousemove="onForecastMove" @mouseleave="hoverIdx = null">
        <BarChart
          :data="monthlyForecast"
          :categories="forecastCategories"
          :y-axis="['committed', 'projected']"
          :stacked="true"
          :height="300"
          :radius="6"
          :bar-padding="0.5"
          :padding="{ top: 8, right: 0, bottom: 0, left: 0 }"
          :x-explicit-ticks="forecastTicks"
          :x-formatter="monthAxisLabel"
          :y-formatter="compactCurrency"
          :y-num-ticks="4"
          :y-grid-line="true"
          :hide-tooltip="true"
          :legend-position="LegendPosition.TopLeft"
        />
        <div
          v-if="hoveredMonth"
          class="pointer-events-none absolute z-20 w-52 -translate-x-1/2 -translate-y-full rounded-lg border border-default bg-default px-3 py-2.5 shadow-lg"
          :style="{ left: `${hoverPos.x}px`, top: `${hoverPos.y - 12}px` }"
        >
          <p class="text-xs font-medium text-muted">{{ hoveredMonth.label }}</p>
          <div class="mt-1.5 space-y-1 text-sm tabular-nums">
            <p class="flex items-center justify-between gap-4">
              <span class="flex items-center gap-1.5 text-muted">
                <span class="size-2 rounded-full bg-primary" />Committed
              </span>
              <span class="font-medium">{{ formatCurrency(hoveredMonth.committed) }}</span>
            </p>
            <p class="flex items-center justify-between gap-4">
              <span class="flex items-center gap-1.5 text-muted">
                <span
                  class="size-2 rounded-full ring-1 ring-default ring-inset"
                  :style="{ backgroundColor: PROJECTED_FILL }"
                />Projected
              </span>
              <span class="font-medium">{{ formatCurrency(hoveredMonth.projected) }}</span>
            </p>
            <p
              class="flex items-center justify-between gap-4 border-t border-default pt-1 font-semibold"
            >
              <span>Total</span>
              <span>{{ formatCurrency(hoveredMonth.total) }}</span>
            </p>
            <p class="flex items-center justify-between gap-4 pt-0.5 text-xs font-normal">
              <span class="text-muted">Active clients</span>
              <span class="tabular-nums">{{ hoveredMonth.activeClientCount }}</span>
            </p>
          </div>
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div class="flex items-center gap-2">
            <h3 class="font-semibold">Client Timeline</h3>
            <span class="text-xs text-muted"
              >{{ timelineRows.length }} active service{{
                timelineRows.length !== 1 ? 's' : ''
              }}</span
            >
          </div>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
            <span class="flex items-center gap-1.5">
              <span class="h-2.5 w-4 rounded-sm bg-primary" />
              Committed
            </span>
            <span class="flex items-center gap-1.5">
              <span
                class="h-2.5 w-4 rounded-sm text-primary"
                :style="{ backgroundImage: PROJECTED_HATCH }"
              />
              Projected
            </span>
            <span class="flex items-center gap-1.5">
              <span class="h-3 w-0.5 rounded bg-warning" />
              Ending soon
            </span>
          </div>
        </div>
      </template>

      <div v-if="timelineRows.length === 0" class="py-12 text-center text-sm text-muted">
        No active services in the forecast window.
      </div>
      <div v-else class="overflow-x-auto">
        <div class="min-w-260 space-y-1.5">
          <div
            class="grid items-center gap-3 pb-1 text-[11px] font-medium text-muted"
            :style="timelineGridStyle"
          >
            <div>Service</div>
            <div class="grid grid-cols-12">
              <div
                v-for="month in forecastMonths"
                :key="month.iso"
                class="border-l border-muted px-2 first:border-l-0"
              >
                {{ month.label }}
              </div>
            </div>
          </div>
          <div
            v-for="row in timelineRows"
            :key="row.id"
            class="grid items-center gap-3 rounded-lg border border-default px-3 py-2.5"
            :style="timelineGridStyle"
          >
            <div class="min-w-0 space-y-1">
              <p class="truncate text-sm font-semibold">{{ row.clientName }}</p>
              <p class="truncate text-xs text-muted">
                {{ row.serviceName }} · {{ formatCurrency(row.amount) }} ·
                {{ CADENCE_LABELS[row.billingCadence] }}
              </p>
              <span
                v-if="row.endLabel"
                class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                :class="row.isEndingSoon ? 'bg-warning/15 text-warning' : 'bg-elevated text-muted'"
              >
                <UIcon name="i-lucide-flag" class="size-3" />
                Ends {{ row.endLabel }}
              </span>
              <span
                v-else-if="row.commitmentEndLabel"
                class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                :class="
                  row.isEndingSoon ? 'bg-warning/15 text-warning' : 'bg-primary/10 text-primary'
                "
              >
                <UIcon name="i-lucide-lock-keyhole" class="size-3" />
                Committed thru {{ row.commitmentEndLabel }}
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1 rounded-full bg-elevated px-2 py-0.5 text-[11px] font-medium text-muted"
              >
                <UIcon name="i-lucide-infinity" class="size-3" />
                Ongoing
              </span>
            </div>

            <div class="relative h-9">
              <div class="absolute inset-0 grid grid-cols-12">
                <span
                  v-for="month in forecastMonths"
                  :key="month.iso"
                  class="border-l border-default/60 first:border-l-0"
                />
              </div>

              <div
                class="absolute inset-y-0 z-10 w-px bg-neutral-400/60"
                :style="{ left: `${timelineTodayRatio * 100}%` }"
              />

              <div
                class="absolute inset-y-1.5 overflow-hidden rounded-l-md text-primary"
                :class="row.extendsPastWindow ? 'rounded-r-none' : 'rounded-r-md'"
                :style="{
                  left: `${(row.startOffset / 12) * 100}%`,
                  width: `${(row.span / 12) * 100}%`,
                }"
              >
                <div
                  class="absolute inset-0 bg-primary/12"
                  :style="{ backgroundImage: PROJECTED_HATCH }"
                />
                <div
                  v-if="row.commitmentSpan > 0"
                  class="absolute inset-y-0 left-0 bg-primary"
                  :style="{ width: `${Math.min(100, (row.commitmentSpan / row.span) * 100)}%` }"
                />
              </div>

              <div
                v-if="row.endsWithinWindow"
                class="absolute inset-y-1 z-20 w-0.5 rounded"
                :class="row.isEndingSoon ? 'bg-warning' : 'bg-primary/70'"
                :style="{ left: `calc(${((row.startOffset + row.span) / 12) * 100}% - 1px)` }"
              />
              <div
                v-else-if="row.extendsPastWindow"
                class="absolute inset-y-0 right-0 z-20 flex items-center pr-0.5 text-primary/70"
              >
                <UIcon name="i-lucide-chevron-right" class="size-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
