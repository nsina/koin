<script setup lang="ts">
const store = useExpenseStore()

interface DayCell {
  iso: string
  date: Date
  inRange: boolean
  isFuture: boolean
  count: number
  total: number
}

interface DayMeta {
  count: number
  total: number
}

const now = ref<Date | null>(null)

const currentYear = computed(() => now.value?.getFullYear() ?? null)

const dayTotals = computed(() => {
  const year = currentYear.value
  const map = new Map<string, DayMeta>()
  if (!year) return map

  for (const expense of store.expenses.value) {
    const iso = expense.date
    const d = new Date(`${iso}T12:00:00`)
    if (d.getFullYear() !== year) continue
    const prev = map.get(iso) ?? { count: 0, total: 0 }
    map.set(iso, { count: prev.count + 1, total: round2(prev.total + expense.amount) })
  }

  return map
})

const maxDayCount = computed(() => {
  let max = 0
  for (const meta of dayTotals.value.values()) {
    if (meta.count > max) max = meta.count
  }
  return max
})

function toIsoDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatMonth(date: Date) {
  return date.toLocaleString('en-US', { month: 'short' })
}

function formatTooltipDate(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getLevel(count: number, maxCount: number) {
  if (count <= 0 || maxCount <= 0) return 0
  if (maxCount <= 4) return Math.min(count, 4)
  const ratio = count / maxCount
  if (ratio < 0.2) return 1
  if (ratio < 0.45) return 2
  if (ratio < 0.7) return 3
  return 4
}

function mondayFirstDow(date: Date) {
  return (date.getDay() + 6) % 7
}

const weeks = computed(() => {
  const year = currentYear.value
  const currentDate = now.value
  if (!year || !currentDate) return [] as DayCell[][]

  const firstDayOfYear = new Date(year, 0, 1)
  const rangeStart = new Date(firstDayOfYear)
  rangeStart.setDate(firstDayOfYear.getDate() - mondayFirstDow(firstDayOfYear))

  const lastDayOfYear = new Date(year, 11, 31)
  const rangeEnd = new Date(lastDayOfYear)
  rangeEnd.setDate(lastDayOfYear.getDate() + (6 - mondayFirstDow(lastDayOfYear)))

  const days: DayCell[] = []
  const cursor = new Date(rangeStart)
  const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())

  while (cursor <= rangeEnd) {
    const cellDate = new Date(cursor)
    const iso = toIsoDate(cellDate)
    const meta = dayTotals.value.get(iso)
    const inRange = cellDate.getFullYear() === year
    const isFuture = cellDate > today
    days.push({
      iso,
      date: cellDate,
      inRange,
      isFuture,
      count: inRange ? (meta?.count ?? 0) : 0,
      total: inRange ? (meta?.total ?? 0) : 0,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  const result: DayCell[][] = []
  for (let i = 0; i < days.length; i += 7) {
    result.push(days.slice(i, i + 7))
  }
  return result
})

const monthLabels = computed(() => {
  const labels: { label: string; weekIndex: number }[] = []
  const seen = new Set<string>()
  for (let i = 0; i < weeks.value.length; i++) {
    const week = weeks.value[i]
    if (!week) continue
    const firstOfMonth = week.find((day) => day.inRange && day.date.getDate() === 1)
    if (firstOfMonth) {
      const key = formatMonth(firstOfMonth.date)
      if (!seen.has(key)) {
        seen.add(key)
        labels.push({ label: key, weekIndex: i })
      }
    }
  }
  return labels
})

const totalActiveDays = computed(() => {
  let count = 0
  for (const meta of dayTotals.value.values()) {
    if (meta.count > 0) count += 1
  }
  return count
})

// Grid dimensions — kept as constants for the dynamic width/height calculations.
// Tailwind equivalents: CELL=14 → size-3.5/h-3.5/w-3.5, GAP=3 → gap-[3px], DAY_LABEL_W=28 → w-7
const CELL = 14
const GAP = 3
const COL = CELL + GAP // 17px per column (cell + trailing gap)
const DAY_LABEL_W = 28

const DOW_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']

// Level 0–4: base classes used for both rendering and the legend; hover only on interactive tiles
const LEVEL_CLASSES = [
  { base: 'border-default bg-elevated', hover: 'hover:border-primary/30' },
  { base: 'border-primary/30 bg-primary/12', hover: 'hover:border-primary/50' },
  { base: 'border-primary/50 bg-primary/30', hover: 'hover:border-primary/70' },
  { base: 'border-primary/70 bg-primary/55', hover: 'hover:border-primary/85' },
  { base: 'border-primary/90 bg-primary/80', hover: 'hover:border-primary' },
] as const

// ── Selected day ──────────────────────────────────────────────────────────────
const selectedIso = ref<string>('')

onMounted(() => {
  now.value = new Date()
  selectedIso.value = toIsoDate(now.value)
})

const selectedDayExpenses = computed(() =>
  store.expenses.value.filter((e) => e.date === selectedIso.value),
)

const selectedDayTotal = computed(() =>
  round2(selectedDayExpenses.value.reduce((sum, e) => sum + e.amount, 0)),
)

const selectedDayLabel = computed(() => {
  if (!selectedIso.value) return ''
  const d = new Date(`${selectedIso.value}T12:00:00`)
  const today = now.value ? toIsoDate(now.value) : ''
  if (selectedIso.value === today) return 'Today'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
})

function selectDay(day: DayCell) {
  if (!day.inRange) return
  selectedIso.value = day.iso
}

function tooltipText(day: DayCell) {
  if (!day.inRange) return formatTooltipDate(day.date)
  if (day.isFuture) return `No expenses yet · ${formatTooltipDate(day.date)}`
  if (day.count === 0) return `No expenses · ${formatTooltipDate(day.date)}`
  const expenseLabel = day.count === 1 ? 'expense' : 'expenses'
  return `${day.count} ${expenseLabel} · ${formatCurrency(day.total)} on ${formatTooltipDate(day.date)}`
}

function tileClass(day: DayCell) {
  if (!day.inRange) return 'border-transparent bg-transparent cursor-default'
  const isSelected = day.iso === selectedIso.value
  if (day.isFuture) {
    return [
      'border-default/40 bg-elevated/50 cursor-default',
      isSelected && 'ring-1 ring-primary/50',
    ]
      .filter(Boolean)
      .join(' ')
  }
  const { base, hover } = LEVEL_CLASSES[getLevel(day.count, maxDayCount.value)]!
  return [base, hover, 'cursor-pointer', isSelected && 'ring-1 ring-primary ring-offset-1']
    .filter(Boolean)
    .join(' ')
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-baseline gap-2">
          <h3 class="font-semibold">Expense Activity</h3>
          <span class="text-xs text-muted">{{ currentYear ?? '' }}</span>
        </div>
        <span class="text-xs text-muted">{{ formatNumber(totalActiveDays) }} active day(s)</span>
      </div>
    </template>

    <div v-if="weeks.length === 0" class="py-6 text-sm text-muted">Loading activity…</div>

    <div v-else class="flex flex-col lg:h-40 lg:flex-row lg:items-start lg:gap-6">
      <!-- ── Heatmap ── -->
      <div class="no-scrollbar min-w-0 shrink-0 overflow-x-auto p-0.5">
        <div class="space-y-2" :style="{ width: `${DAY_LABEL_W + weeks.length * COL}px` }">
          <!-- Month labels (absolutely positioned, left values derived from weekIndex) -->
          <div class="relative h-4">
            <span
              v-for="{ label, weekIndex } in monthLabels"
              :key="label"
              class="absolute text-[10px] leading-4 text-muted"
              :style="{ left: `${DAY_LABEL_W + GAP + weekIndex * COL}px` }"
            >
              {{ label }}
            </span>
          </div>

          <!-- DOW labels + week columns -->
          <div class="flex gap-0.75">
            <div class="flex w-7 shrink-0 flex-col gap-0.75 text-[10px] leading-none text-muted">
              <div v-for="(label, i) in DOW_LABELS" :key="i" class="flex h-3.5 items-center">
                {{ label }}
              </div>
            </div>

            <div class="flex gap-0.75">
              <div
                v-for="(week, weekIndex) in weeks"
                :key="weekIndex"
                class="flex w-3.5 flex-col gap-[3px]"
              >
                <UTooltip
                  v-for="day in week"
                  :key="day.iso"
                  :text="tooltipText(day)"
                  :delay-duration="80"
                >
                  <div
                    class="size-3.5 rounded-[2px] border transition-colors duration-150"
                    :class="tileClass(day)"
                    @click="selectDay(day)"
                  />
                </UTooltip>
              </div>
            </div>
          </div>

          <!-- Legend -->
          <div class="mt-3 flex items-center gap-0.75 text-[10px] text-muted">
            <div class="w-7 shrink-0">Less</div>
            <div class="flex gap-0.75">
              <div
                v-for="{ base } in LEVEL_CLASSES"
                :key="base"
                class="size-3.5 rounded-[2px] border"
                :class="base"
              />
            </div>
            <span class="pl-1.5">More</span>
          </div>
        </div>
      </div>

      <!-- ── Day detail panel (sidebar on lg+, stacked below on mobile) ── -->
      <div class="mt-4 min-w-0 flex-1 lg:mt-0 lg:border-l lg:border-default lg:pl-5">
        <div class="flex items-baseline justify-between gap-2 border-b border-default pb-2 lg:pr-3">
          <span class="text-xs font-semibold">{{ selectedDayLabel }}</span>
          <span v-if="selectedDayExpenses.length > 0" class="text-xs text-muted tabular-nums">
            {{ formatCurrency(selectedDayTotal) }}
          </span>
        </div>
        <p v-if="selectedDayExpenses.length === 0" class="mt-3 text-xs text-dimmed">No expenses</p>
        <UScrollArea
          v-else
          class="mt-2 [scrollbar-color:--theme(--color-neutral-400/40%)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-400/30 [&::-webkit-scrollbar-track]:bg-transparent"
          :style="{ maxHeight: `${16 + 8 + CELL * 7 + GAP * 6 + 8 + 18 - 24}px` }"
        >
          <ul class="divide-y divide-default lg:pr-3">
            <li
              v-for="expense in selectedDayExpenses"
              :key="expense.id"
              class="flex items-start justify-between gap-2 py-1.5"
            >
              <div class="min-w-0">
                <p class="truncate text-xs font-medium">{{ expense.vendor }}</p>
                <p class="text-[10px] text-muted">{{ expense.category }}</p>
              </div>
              <span class="shrink-0 text-xs text-muted tabular-nums">
                {{ formatCurrency(expense.amount) }}
              </span>
            </li>
          </ul>
        </UScrollArea>
      </div>
    </div>
  </UCard>
</template>
