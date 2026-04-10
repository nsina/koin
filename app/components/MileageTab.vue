<script setup lang="ts">
const store = useExpenseStore()
const { confirm } = useConfirm()
const toast = useToast()
const { irsRatePerMile } = useSettings()

const draft = reactive({
  date: getTodayISO(),
  from: '',
  to: '',
  miles: 0,
  purpose: 'Client meeting'
})

function submit() {
  if (!draft.from.trim() || !draft.to.trim()) {
    toast.add({
      title: 'Start and end locations are required',
      color: 'warning'
    })
    return
  }
  const miles = Number(draft.miles)
  if (!Number.isFinite(miles) || miles <= 0) {
    toast.add({ title: 'Miles must be greater than 0', color: 'warning' })
    return
  }
  store.addMileageTrip({ ...draft, miles })
  draft.from = ''
  draft.to = ''
  draft.miles = 0
  draft.purpose = 'Client meeting'
}

async function deleteTrip(trip: Parameters<typeof store.deleteMileageTrip>[0]) {
  const ok = await confirm({
    title: `Delete trip from ${trip.from} to ${trip.to}?`,
    description: 'This action cannot be undone.'
  })
  if (ok) store.deleteMileageTrip(trip)
}
</script>

<template>
  <div class="space-y-5">
    <!-- Summary -->
    <div class="grid gap-4 lg:grid-cols-3">
      <UCard>
        <p class="text-sm text-muted">Total Miles (YTD)</p>
        <p class="mt-2 text-4xl font-bold tracking-tight tabular-nums">
          {{ formatNumber(store.totalMilesYtd.value) }}
        </p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">IRS Rate (2026)</p>
        <p class="mt-2 text-4xl font-bold tracking-tight tabular-nums">
          {{ formatRate(irsRatePerMile) }}/mi
        </p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">Total Deduction (YTD)</p>
        <p class="mt-2 text-4xl font-bold tracking-tight tabular-nums">
          {{ formatCurrency(store.mileageDeductionYtd.value) }}
        </p>
      </UCard>
    </div>

    <!-- Log trip form -->
    <UCard class="no-print">
      <template #header>
        <h3 class="text-xl font-bold tracking-tight">Log Trip</h3>
      </template>

      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
        <UFormField label="Date">
          <AppDatePicker v-model="draft.date" />
        </UFormField>
        <UFormField label="From">
          <UInput v-model="draft.from" placeholder="Start location" />
        </UFormField>
        <UFormField label="To">
          <UInput v-model="draft.to" placeholder="End location" />
        </UFormField>
        <UFormField label="Miles">
          <UInputNumber
            v-model="draft.miles"
            :min="0"
            :step="0.1"
            :increment="false"
            :decrement="false"
            :format-options="{ minimumFractionDigits: 1, maximumFractionDigits: 2 }"
          />
        </UFormField>
        <UFormField label="Purpose">
          <UInput v-model="draft.purpose" placeholder="Client meeting" />
        </UFormField>
        <div class="flex items-end">
          <UButton icon="i-lucide-plus" color="neutral" variant="solid" @click="submit" />
        </div>
      </div>
    </UCard>

    <!-- Trip table -->
    <UCard>
      <div class="overflow-x-auto">
        <table class="min-w-full">
          <thead>
            <tr class="table-header-row">
              <th class="px-4 py-4">Date</th>
              <th class="px-4 py-4">From → To</th>
              <th class="px-4 py-4 text-right">Miles</th>
              <th class="px-4 py-4">Purpose</th>
              <th class="px-4 py-4 text-right">Deductible</th>
              <th class="no-print px-4 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="store.mileageTrips.value.length === 0" class="text-muted">
              <td colspan="6" class="px-4 py-14 text-center text-2xl">No mileage logged yet.</td>
            </tr>
            <tr
              v-for="trip in store.mileageTrips.value"
              :key="trip.id"
              class="border-b border-muted"
            >
              <td class="px-4 py-3 font-medium">
                {{ formatDateLong(trip.date) }}
              </td>
              <td class="px-4 py-3">{{ trip.from }} → {{ trip.to }}</td>
              <td class="px-4 py-3 text-right font-semibold">
                {{ trip.miles.toFixed(1) }}
              </td>
              <td class="px-4 py-3 text-default">
                {{ trip.purpose }}
              </td>
              <td class="px-4 py-3 text-right font-semibold">
                {{ formatCurrency(round2(trip.miles * irsRatePerMile)) }}
              </td>
              <td class="no-print px-4 py-3 text-center">
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="sm"
                  @click="deleteTrip(trip)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </div>
</template>
