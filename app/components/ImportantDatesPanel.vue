<script setup lang="ts">
import type { ImportantTaxDate } from '~/utils/taxDates'

const open = ref(true)

// Deadlines are generated from IRS rules (with weekend/holiday roll-forward) rather than
// hardcoded, so the panel stays accurate every year without manual edits. We surface the
// current filing year plus the next so upcoming January deadlines are always visible.
const todayISO = ref('')
const importantDates = ref<ImportantTaxDate[]>([])

onMounted(() => {
  todayISO.value = getTodayISO()
  const year = new Date().getFullYear()
  importantDates.value = getImportantTaxDates(year, year + 1)
})

const datesWithDaysUntil = computed(() =>
  importantDates.value.map((item) => ({
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
