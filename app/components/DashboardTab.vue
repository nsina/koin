<script setup lang="ts">
import { CurveType, LegendPosition } from '#imports'

const store = useExpenseStore()

const now = ref<Date | null>(null)
onMounted(() => {
  now.value = new Date()
})

// ── Spend by Category (ranked list with inline bars) ──────────────────────────
const categoryRows = computed(() => {
  const rows = store.categorySpendYtd.value.slice(0, 8)
  const max = rows[0]?.total ?? 0 // sorted desc, so first is the largest
  const ytd = store.ytdSpend.value
  return rows.map((r) => ({
    category: r.category,
    total: r.total,
    pct: ytd > 0 ? Math.round((r.total / ytd) * 100) : 0,
    barPct: max > 0 ? Math.max((r.total / max) * 100, 2) : 0,
  }))
})

const hiddenCategoryCount = computed(() => Math.max(store.categorySpendYtd.value.length - 8, 0))

// ── Top 5 Vendors ─────────────────────────────────────────────────────────────
const vendorPalette = [
  'var(--color-indigo-500)',
  'var(--color-cyan-400)',
  'var(--color-emerald-500)',
  'var(--color-amber-500)',
  'var(--color-rose-500)',
]

const vendorColor = (i: number) =>
  vendorPalette[i % vendorPalette.length] ?? 'var(--color-indigo-500)'

// Vendor name keys keep tooltips clean; the % lives in the custom legend column.
const topVendorDonutCategories = computed(() =>
  store.topVendorsYtd.value.reduce<Record<string, { name: string; color: string }>>(
    (acc, item, i) => {
      acc[item.vendor] = { name: item.vendor, color: vendorColor(i) }
      return acc
    },
    {},
  ),
)

const topVendorDonutData = computed(() => store.topVendorsYtd.value.map((v) => v.total))

// Rows for the side-by-side legend list (dot · name · amount · share).
const topVendorLegend = computed(() =>
  store.topVendorsYtd.value.map((v, i) => ({
    label: v.vendor,
    total: v.total,
    pct: vendorSharePct(v.total),
    color: vendorColor(i),
  })),
)

// Only show months up to (and including) the current month — no future zeros
const monthlySpendTruncated = computed(() => {
  if (!now.value) return []
  const currentMonthIdx = now.value.getMonth()
  return store.monthlySpendYtd.value.slice(0, currentMonthIdx + 1)
})

// The Area/Line chart plots an index-based x-axis, so force one integer tick per
// month and resolve the label from the index (avoids fractional auto-ticks).
const monthTicks = computed(() => monthlySpendTruncated.value.map((_, i) => i))

function monthAtIndex(value: number | string | Date) {
  const i = Number(value)
  return monthlySpendTruncated.value[i]?.month ?? ''
}

// Soft indigo gradient for the area fill — strong near the line, fading to flat.
const areaGradientStops = [
  { offset: '0%', stopOpacity: 0.35 },
  { offset: '100%', stopOpacity: 0 },
]

// ── Monthly Spend: Deductible vs Non-deductible (stacked) ─────────────────────
const monthlySplitCategories = {
  deductible: { name: 'Deductible', color: 'var(--color-emerald-500)' },
  nonDeductible: { name: 'Non-deductible', color: 'var(--color-zinc-400)' },
}

const monthlyDeductibleSplit = computed(() => {
  const today = now.value
  if (!today) return []
  const year = today.getFullYear()
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: new Date(year, i, 1).toLocaleString('en-US', { month: 'short' }),
    deductible: 0,
    nonDeductible: 0,
  }))
  for (const e of store.expenses.value) {
    if (!isDateInCurrentYear(e.date, today)) continue
    const idx = new Date(`${e.date}T12:00:00`).getMonth()
    const ded = store.getNetDeductible(e)
    months[idx]!.deductible = round2(months[idx]!.deductible + ded)
    months[idx]!.nonDeductible = round2(months[idx]!.nonDeductible + (e.amount - ded))
  }
  return months.slice(0, today.getMonth() + 1)
})

// ── Cumulative YTD spend (running total — budget pacing) ──────────────────────
const cumulativeCategories = {
  total: { name: 'Cumulative Spend', color: 'var(--color-indigo-500)' },
}

const cumulativeSpend = computed(() => {
  let running = 0
  return monthlySpendTruncated.value.map((m) => {
    running = round2(running + m.total)
    return { month: m.month, total: running }
  })
})

// ── Spend by Payment Method ───────────────────────────────────────────────────
const paymentMethodPalette = [
  'var(--color-violet-500)',
  'var(--color-sky-500)',
  'var(--color-amber-500)',
  'var(--color-teal-500)',
]

const paymentMethodSpend = computed(() => {
  const today = now.value
  if (!today) return []
  const map = new Map<string, number>()
  for (const e of store.expenses.value) {
    if (!isDateInCurrentYear(e.date, today)) continue
    map.set(e.paymentMethod, (map.get(e.paymentMethod) ?? 0) + e.amount)
  }
  return Array.from(map.entries())
    .map(([method, total]) => ({ method, total: round2(total) }))
    .sort((a, b) => b.total - a.total)
})

const paymentColor = (i: number) =>
  paymentMethodPalette[i % paymentMethodPalette.length] ?? 'var(--color-violet-500)'

const paymentMethodCategories = computed(() =>
  paymentMethodSpend.value.reduce<Record<string, { name: string; color: string }>>(
    (acc, item, i) => {
      acc[item.method] = { name: item.method, color: paymentColor(i) }
      return acc
    },
    {},
  ),
)

const paymentMethodData = computed(() => paymentMethodSpend.value.map((p) => p.total))

const paymentMethodLegend = computed(() =>
  paymentMethodSpend.value.map((p, i) => ({
    label: p.method,
    total: p.total,
    pct: vendorSharePct(p.total),
    color: paymentColor(i),
  })),
)

// Share of YTD spend for a vendor — surfaced in the donut tooltip.
function vendorSharePct(total: number) {
  return store.ytdSpend.value > 0 ? Math.round((total / store.ytdSpend.value) * 100) : 0
}

// ── KPI card computed values ──────────────────────────────────────────────────

const lastMonthSpend = computed(() => {
  if (!now.value) return 0
  const prevMonth = now.value.getMonth() === 0 ? 11 : now.value.getMonth() - 1
  const prevYear =
    now.value.getMonth() === 0 ? now.value.getFullYear() - 1 : now.value.getFullYear()
  return store.expenses.value.reduce((sum, e) => {
    const d = new Date(`${e.date}T12:00:00`)
    return d.getFullYear() === prevYear && d.getMonth() === prevMonth ? sum + e.amount : sum
  }, 0)
})

const monthChangePct = computed(() => {
  if (lastMonthSpend.value === 0) return null
  return round2(((store.monthSpend.value - lastMonthSpend.value) / lastMonthSpend.value) * 100)
})

const monthsElapsed = computed(() => (now.value ? now.value.getMonth() + 1 : 0))
const avgMonthlySpend = computed(() =>
  store.ytdSpend.value > 0 && monthsElapsed.value > 0
    ? round2(store.ytdSpend.value / monthsElapsed.value)
    : 0,
)

const deductiblePct = computed(() =>
  store.ytdSpend.value > 0
    ? Math.round((store.ytdTaxDeductible.value / store.ytdSpend.value) * 100)
    : 0,
)

const billablePct = computed(() =>
  store.ytdSpend.value > 0 ? Math.round((store.ytdBillable.value / store.ytdSpend.value) * 100) : 0,
)

const currentMonthName = computed(() => now.value?.toLocaleString('en-US', { month: 'long' }) ?? '')
const currentYear = computed(() => now.value?.getFullYear() ?? '')
</script>

<template>
  <div class="space-y-4">
    <!-- KPI cards -->
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <!-- This Month -->
      <StatCard label="This Month" :value="formatCurrency(store.monthSpend.value)">
        <template #action>
          <UBadge
            v-if="monthChangePct !== null"
            :color="monthChangePct <= 0 ? 'success' : 'neutral'"
            variant="subtle"
            size="lg"
            :leading-icon="monthChangePct <= 0 ? 'i-lucide-trending-down' : 'i-lucide-trending-up'"
          >
            {{ monthChangePct > 0 ? '+' : '' }}{{ monthChangePct }}%
          </UBadge>
        </template>
        <template #meta>
          <p class="flex items-center gap-1.5 text-sm font-semibold text-highlighted">
            <UIcon
              :name="(monthChangePct ?? 0) <= 0 ? 'i-lucide-trending-down' : 'i-lucide-trending-up'"
              class="size-4 shrink-0"
            />
            <template v-if="monthChangePct !== null">
              {{ monthChangePct <= 0 ? 'Down' : 'Up' }} {{ Math.abs(monthChangePct) }}% vs last
              month
            </template>
            <template v-else>No prior month data</template>
          </p>
          <p class="mt-0.5 text-xs text-muted">Total spend in {{ currentMonthName }}</p>
        </template>
      </StatCard>

      <!-- YTD Spend -->
      <StatCard label="YTD Spend" :value="formatCurrency(store.ytdSpend.value)">
        <template #action>
          <UBadge v-if="avgMonthlySpend > 0" color="neutral" variant="subtle" size="lg">
            {{ compactCurrency(avgMonthlySpend) }}/mo avg
          </UBadge>
        </template>
        <template #meta>
          <p class="flex items-center gap-1.5 text-sm font-semibold text-highlighted">
            <UIcon name="i-lucide-calendar" class="size-4 shrink-0" />
            {{ monthsElapsed }} month{{ monthsElapsed !== 1 ? 's' : '' }} tracked
          </p>
          <p class="mt-0.5 text-xs text-muted">Year-to-date total spend</p>
        </template>
      </StatCard>

      <!-- Tax Deductible -->
      <StatCard label="Tax Deductible YTD" :value="formatCurrency(store.ytdTaxDeductible.value)">
        <template #action>
          <UBadge v-if="deductiblePct > 0" color="success" variant="subtle" size="lg">
            {{ deductiblePct }}% deductible
          </UBadge>
        </template>
        <template #meta>
          <p class="flex items-center gap-1.5 text-sm font-semibold text-highlighted">
            <UIcon name="i-lucide-receipt" class="size-4 shrink-0" />
            {{
              deductiblePct > 0 ? `${deductiblePct}% of spend qualifies` : 'No deductible expenses'
            }}
          </p>
          <p class="mt-0.5 text-xs text-muted">Net deductible this year</p>
        </template>
      </StatCard>

      <!-- Billable -->
      <StatCard label="Billable YTD" :value="formatCurrency(store.ytdBillable.value)">
        <template #action>
          <UBadge v-if="billablePct > 0" color="warning" variant="subtle" size="lg">
            {{ billablePct }}% of spend
          </UBadge>
        </template>
        <template #meta>
          <p class="flex items-center gap-1.5 text-sm font-semibold text-highlighted">
            <UIcon name="i-lucide-file-check-2" class="size-4 shrink-0" />
            {{ billablePct > 0 ? `${billablePct}% of total spend` : 'No billable expenses' }}
          </p>
          <p class="mt-0.5 text-xs text-muted">Flagged for client billing</p>
        </template>
      </StatCard>
    </div>

    <ExpenseContributionHeatmap />

    <!-- Charts row 1: Category bar + Vendor donut -->
    <div class="grid gap-4 xl:grid-cols-5">
      <UCard class="xl:col-span-2">
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-baseline gap-2">
              <h3 class="font-semibold">Spend by Category</h3>
              <span class="text-xs text-muted">YTD</span>
            </div>
            <span class="text-xs text-muted">
              {{ store.categorySpendYtd.value.length }}
              {{ store.categorySpendYtd.value.length === 1 ? 'category' : 'categories' }}
            </span>
          </div>
        </template>
        <div class="h-80">
          <div
            v-if="categoryRows.length === 0"
            class="flex h-full flex-col items-center justify-center gap-2 text-sm text-dimmed"
          >
            <UIcon name="i-lucide-chart-bar" class="size-7 opacity-40" />
            No expenses yet
          </div>
          <div v-else class="flex h-full flex-col justify-between">
            <ul class="space-y-3">
              <li v-for="row in categoryRows" :key="row.category" class="group">
                <div class="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span class="truncate font-medium">{{ row.category }}</span>
                  <span class="shrink-0 tabular-nums">
                    {{ formatCurrency(row.total) }}
                    <span class="ml-1 text-xs text-dimmed">{{ row.pct }}%</span>
                  </span>
                </div>
                <div class="h-2 w-full overflow-hidden rounded-full bg-elevated">
                  <div
                    class="h-full rounded-full bg-primary transition-all duration-500 group-hover:opacity-80"
                    :style="{ width: `${row.barPct}%` }"
                  />
                </div>
              </li>
            </ul>
            <p v-if="hiddenCategoryCount > 0" class="pt-3 text-xs text-dimmed">
              + {{ hiddenCategoryCount }} more
              {{ hiddenCategoryCount === 1 ? 'category' : 'categories' }}
            </p>
          </div>
        </div>
      </UCard>

      <UCard class="xl:col-span-3">
        <template #header>
          <div class="flex items-baseline gap-2">
            <h3 class="font-semibold">Top Vendors</h3>
            <span class="text-xs text-muted">YTD · top 5</span>
          </div>
        </template>
        <div class="flex h-80 items-center">
          <div
            v-if="topVendorDonutData.length === 0"
            class="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-dimmed"
          >
            <UIcon name="i-lucide-chart-pie" class="size-7 opacity-40" />
            No expenses yet
          </div>
          <div v-else class="flex w-full flex-col items-center gap-6 sm:flex-row sm:gap-8">
            <div class="shrink-0">
              <DonutChart
                :data="topVendorDonutData"
                :categories="topVendorDonutCategories"
                :radius="0"
                :arc-width="28"
                :pad-angle="0.04"
                :height="200"
                :hide-legend="true"
              >
                <div class="text-center">
                  <div class="text-2xl font-bold tabular-nums">
                    {{ compactCurrency(store.ytdSpend.value) }}
                  </div>
                  <div class="text-xs text-muted">Total YTD</div>
                </div>
              </DonutChart>
            </div>
            <ChartLegend class="min-w-0 flex-1" :items="topVendorLegend" />
          </div>
        </div>
      </UCard>
    </div>

    <!-- Charts row 2: Monthly spend trend — deductible vs non-deductible -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-baseline gap-2">
            <h3 class="font-semibold">Monthly Spend</h3>
            <span class="text-xs text-muted">{{ currentYear }} · deductible split</span>
          </div>
          <span v-if="avgMonthlySpend > 0" class="text-xs text-muted">
            {{ compactCurrency(avgMonthlySpend) }} avg / month
          </span>
        </div>
      </template>
      <div class="h-65">
        <div
          v-if="store.ytdSpend.value === 0"
          class="flex h-full flex-col items-center justify-center gap-2 text-sm text-dimmed"
        >
          <UIcon name="i-lucide-trending-up" class="size-7 opacity-40" />
          No expenses yet
        </div>
        <AreaChart
          v-else
          :data="monthlyDeductibleSplit"
          :categories="monthlySplitCategories"
          :height="240"
          :curve-type="CurveType.MonotoneX"
          :gradient-stops="areaGradientStops"
          :line-width="2"
          :stacked="true"
          :x-explicit-ticks="monthTicks"
          :x-formatter="monthAtIndex"
          :y-formatter="compactCurrency"
          :y-num-ticks="4"
          :y-grid-line="true"
          :legend-position="LegendPosition.TopLeft"
        >
          <template #tooltip="{ values }">
            <div v-if="values" class="min-w-44 px-3 py-2.5">
              <p class="text-xs font-medium text-muted">{{ values.month }} {{ currentYear }}</p>
              <div class="mt-1.5 space-y-1 text-sm tabular-nums">
                <p class="flex items-center justify-between gap-4">
                  <span class="flex items-center gap-1.5 text-muted">
                    <span class="size-2 rounded-full bg-emerald-500" />Deductible
                  </span>
                  <span class="font-medium">{{ formatCurrency(values.deductible) }}</span>
                </p>
                <p class="flex items-center justify-between gap-4">
                  <span class="flex items-center gap-1.5 text-muted">
                    <span class="size-2 rounded-full bg-zinc-400" />Non-deductible
                  </span>
                  <span class="font-medium">{{ formatCurrency(values.nonDeductible) }}</span>
                </p>
                <p
                  class="flex items-center justify-between gap-4 border-t border-default pt-1 font-semibold"
                >
                  <span>Total</span>
                  <span>{{ formatCurrency(values.deductible + values.nonDeductible) }}</span>
                </p>
              </div>
            </div>
          </template>
        </AreaChart>
      </div>
    </UCard>

    <!-- Charts row 3: Payment methods + cumulative pacing -->
    <div class="grid gap-4 xl:grid-cols-5">
      <UCard class="xl:col-span-2">
        <template #header>
          <div class="flex items-baseline gap-2">
            <h3 class="font-semibold">Payment Methods</h3>
            <span class="text-xs text-muted">YTD</span>
          </div>
        </template>
        <div class="flex h-80 flex-col items-center justify-center gap-6">
          <div
            v-if="paymentMethodData.length === 0"
            class="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-dimmed"
          >
            <UIcon name="i-lucide-credit-card" class="size-7 opacity-40" />
            No expenses yet
          </div>
          <template v-else>
            <DonutChart
              :data="paymentMethodData"
              :categories="paymentMethodCategories"
              :radius="0"
              :arc-width="26"
              :pad-angle="0.04"
              :height="170"
              :hide-legend="true"
            >
              <div class="text-center">
                <div class="text-xl font-bold tabular-nums">
                  {{ compactCurrency(store.ytdSpend.value) }}
                </div>
                <div class="text-xs text-muted">Total YTD</div>
              </div>
            </DonutChart>
            <ChartLegend :items="paymentMethodLegend" />
          </template>
        </div>
      </UCard>

      <UCard class="xl:col-span-3">
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-baseline gap-2">
              <h3 class="font-semibold">Cumulative Spend</h3>
              <span class="text-xs text-muted">{{ currentYear }} running total</span>
            </div>
            <span class="text-xs text-muted">{{ compactCurrency(store.ytdSpend.value) }} YTD</span>
          </div>
        </template>
        <div class="h-80">
          <div
            v-if="store.ytdSpend.value === 0"
            class="flex h-full flex-col items-center justify-center gap-2 text-sm text-dimmed"
          >
            <UIcon name="i-lucide-area-chart" class="size-7 opacity-40" />
            No expenses yet
          </div>
          <AreaChart
            v-else
            :data="cumulativeSpend"
            :categories="cumulativeCategories"
            :height="300"
            :curve-type="CurveType.MonotoneX"
            :gradient-stops="areaGradientStops"
            :line-width="2"
            :x-explicit-ticks="monthTicks"
            :x-formatter="monthAtIndex"
            :y-formatter="compactCurrency"
            :y-num-ticks="4"
            :hide-legend="true"
            :y-grid-line="true"
          >
            <template #tooltip="{ values }">
              <div v-if="values" class="px-3 py-2.5">
                <p class="text-xs font-medium text-muted">
                  Through {{ values.month }} {{ currentYear }}
                </p>
                <p class="mt-1 flex items-center gap-1.5 text-sm font-semibold tabular-nums">
                  <span class="size-2 rounded-full bg-indigo-500" />
                  {{ formatCurrency(values.total) }}
                </p>
              </div>
            </template>
          </AreaChart>
        </div>
      </UCard>
    </div>
  </div>
</template>
