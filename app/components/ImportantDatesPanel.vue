<script setup lang="ts">
const open = ref(true)

const IMPORTANT_DATES = [
  // Filing Year 2026 (for Tax Year 2025)
  { date: '2026-01-15', event: 'Q4 2025 estimated tax due', note: 'Form 1040-ES' },
  {
    date: '2026-02-02',
    event: '1099-NEC due to recipients & IRS',
    note: 'Jan 31 fell on Saturday',
  },
  { date: '2026-02-02', event: 'W-2 forms due to employees & SSA', note: '' },
  { date: '2026-03-02', event: '1099-MISC paper filing due to IRS', note: '' },
  {
    date: '2026-03-16',
    event: 'S-Corp (1120-S) & Partnership (1065) returns due',
    note: 'Mar 15 fell on Sunday',
  },
  {
    date: '2026-03-16',
    event: 'Deadline to file S-Corp/Partnership extension (Form 7004)',
    note: '',
  },
  { date: '2026-03-31', event: '1099-MISC e-filing deadline with IRS', note: '' },
  { date: '2026-04-15', event: 'Individual return (Form 1040) due — Tax Year 2025', note: '' },
  { date: '2026-04-15', event: 'Q1 2026 estimated tax due', note: 'Form 1040-ES' },
  { date: '2026-04-15', event: 'C-Corp (Form 1120) return due', note: '' },
  { date: '2026-06-15', event: 'Q2 2026 estimated tax due', note: 'Form 1040-ES' },
  { date: '2026-08-01', event: 'Max IRS penalty for late/unfiled 1099 corrections', note: '' },
  { date: '2026-09-15', event: 'Q3 2026 estimated tax due', note: 'Form 1040-ES' },
  { date: '2026-09-15', event: 'Extended S-Corp/Partnership return deadline', note: '' },
  { date: '2026-10-15', event: 'Extended individual return deadline (Form 1040)', note: '' },
  // Filing Year 2027 (for Tax Year 2026)
  { date: '2027-01-15', event: 'Q4 2026 estimated tax due', note: 'Form 1040-ES' },
  { date: '2027-02-01', event: '1099-NEC due to recipients & IRS', note: 'Jan 31 falls on Sunday' },
  { date: '2027-02-01', event: 'W-2 forms due to employees & SSA', note: '' },
  { date: '2027-03-01', event: '1099-MISC paper filing due to IRS', note: '' },
  { date: '2027-03-15', event: 'S-Corp & Partnership returns due', note: '' },
  { date: '2027-03-31', event: '1099-MISC e-filing deadline with IRS', note: '' },
  { date: '2027-04-15', event: 'Individual return (Form 1040) due — Tax Year 2026', note: '' },
  { date: '2027-04-15', event: 'Q1 2027 estimated tax due', note: 'Form 1040-ES' },
  { date: '2027-06-15', event: 'Q2 2027 estimated tax due', note: 'Form 1040-ES' },
  { date: '2027-09-15', event: 'Q3 2027 estimated tax due', note: 'Form 1040-ES' },
  { date: '2027-10-15', event: 'Extended individual return deadline', note: '' },
]

const todayISO = ref('')
onMounted(() => {
  todayISO.value = getTodayISO()
})

const datesWithDaysUntil = computed(() =>
  IMPORTANT_DATES.map((item) => ({
    ...item,
    daysUntil: todayISO.value
      ? Math.ceil(
          (new Date(`${item.date}T12:00:00`).getTime() -
            new Date(`${todayISO.value}T12:00:00`).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0,
  })),
)
</script>

<template>
  <UCollapsible v-model:open="open">
    <button class="flex w-full items-center justify-between py-2 text-left">
      <span class="font-semibold">Important Tax Dates</span>
      <UIcon
        :name="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        class="size-4 text-muted"
      />
    </button>

    <template #content>
      <div class="mt-3 overflow-x-auto rounded-xl border border-default">
        <table class="min-w-full">
          <thead>
            <tr class="table-header-row">
              <th class="px-4 py-3">Date</th>
              <th class="px-4 py-3">Event</th>
              <th class="px-4 py-3">Note</th>
              <th class="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, i) in datesWithDaysUntil"
              :key="i"
              class="border-b border-muted last:border-0"
              :class="{ 'opacity-40': item.daysUntil < 0 }"
            >
              <td class="px-4 py-3 font-medium tabular-nums">{{ formatDateLong(item.date) }}</td>
              <td class="px-4 py-3">{{ item.event }}</td>
              <td class="px-4 py-3 text-sm text-muted">{{ item.note }}</td>
              <td class="px-4 py-3 text-center">
                <UBadge
                  v-if="item.daysUntil >= 0 && item.daysUntil <= 30"
                  label="Coming up"
                  color="warning"
                  variant="subtle"
                  size="sm"
                />
                <span v-else-if="item.daysUntil < 0" class="text-xs text-dimmed">Past</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </UCollapsible>
</template>
