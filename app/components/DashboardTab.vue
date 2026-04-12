<script setup lang="ts">
import { LegendPosition, Orientation } from '#imports'

const store = useExpenseStore()

const now = ref<Date | null>(null)
onMounted(() => {
  now.value = new Date()
})

// ── Spend by Category ─────────────────────────────────────────────────────────
const categoryChartCategories = {
  total: { name: 'Spend', color: 'var(--color-indigo-500)' }
}

// ── Top 5 Vendors ─────────────────────────────────────────────────────────────
const vendorPalette = [
  'var(--color-indigo-500)',
  'var(--color-cyan-400)',
  'var(--color-emerald-500)',
  'var(--color-amber-500)',
  'var(--color-rose-500)'
]

const topVendorDonutCategories = computed(() =>
  store.topVendorsYtd.value.reduce<Record<string, { name: string; color: string }>>(
    (acc, item, i) => {
      // Use vendor name as key — cleaner tooltips per the docs best practice
      acc[item.vendor] = {
        name: item.vendor,
        color: vendorPalette[i % vendorPalette.length] ?? 'var(--color-indigo-500)'
      }
      return acc
    },
    {}
  )
)

const topVendorDonutData = computed(() => store.topVendorsYtd.value.map((v) => v.total))

// ── Monthly Spend Trend ───────────────────────────────────────────────────────
const monthlyChartCategories = {
  total: { name: 'Monthly Spend', color: 'var(--color-indigo-500)' }
}

// Only show months up to (and including) the current month — no future zeros
const monthlySpendTruncated = computed(() => {
  if (!now.value) return []
  const currentMonthIdx = now.value.getMonth()
  return store.monthlySpendYtd.value.slice(0, currentMonthIdx + 1)
})

// ── Formatters ────────────────────────────────────────────────────────────────
function compactCurrency(value: number | string | Date) {
  if (typeof value !== 'number') return String(value)
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`
  return `$${value.toFixed(0)}`
}

function categoryLabel(value: number | string | Date) {
  const text = String(value ?? '')
  return text.length <= 24 ? text : `${text.slice(0, 24)}…`
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
    : 0
)

const deductiblePct = computed(() =>
  store.ytdSpend.value > 0
    ? Math.round((store.ytdTaxDeductible.value / store.ytdSpend.value) * 100)
    : 0
)

const billablePct = computed(() =>
  store.ytdSpend.value > 0 ? Math.round((store.ytdBillable.value / store.ytdSpend.value) * 100) : 0
)

const currentMonthName = computed(() => now.value?.toLocaleString('en-US', { month: 'long' }) ?? '')
const currentYear = computed(() => now.value?.getFullYear() ?? '')
</script>

<template>
  <div class="space-y-4">
    <!-- KPI cards -->
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <!-- This Month -->
      <UCard>
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm text-muted">This Month</p>
          <UBadge
            v-if="monthChangePct !== null"
            :color="monthChangePct <= 0 ? 'success' : 'neutral'"
            variant="subtle"
            size="lg"
            :leading-icon="monthChangePct <= 0 ? 'i-lucide-trending-down' : 'i-lucide-trending-up'"
          >
            {{ monthChangePct > 0 ? '+' : '' }}{{ monthChangePct }}%
          </UBadge>
        </div>
        <p class="mt-2 text-4xl font-bold tracking-tight tabular-nums">
          {{ formatCurrency(store.monthSpend.value) }}
        </p>
        <div class="mt-4">
          <p class="flex items-center gap-1.5 text-sm font-semibold">
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
        </div>
      </UCard>

      <!-- YTD Spend -->
      <UCard>
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm text-muted">YTD Spend</p>
          <UBadge v-if="avgMonthlySpend > 0" color="neutral" variant="subtle" size="lg">
            {{ compactCurrency(avgMonthlySpend) }}/mo avg
          </UBadge>
        </div>
        <p class="mt-2 text-4xl font-bold tracking-tight tabular-nums">
          {{ formatCurrency(store.ytdSpend.value) }}
        </p>
        <div class="mt-4">
          <p class="flex items-center gap-1.5 text-sm font-semibold">
            <UIcon name="i-lucide-calendar" class="size-4 shrink-0" />
            {{ monthsElapsed }} month{{ monthsElapsed !== 1 ? 's' : '' }} tracked
          </p>
          <p class="mt-0.5 text-xs text-muted">Year-to-date total spend</p>
        </div>
      </UCard>

      <!-- Tax Deductible -->
      <UCard>
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm text-muted">Tax Deductible YTD</p>
          <UBadge v-if="deductiblePct > 0" color="success" variant="subtle" size="lg">
            {{ deductiblePct }}% deductible
          </UBadge>
        </div>
        <p class="mt-2 text-4xl font-bold tracking-tight tabular-nums">
          {{ formatCurrency(store.ytdTaxDeductible.value) }}
        </p>
        <div class="mt-4">
          <p class="flex items-center gap-1.5 text-sm font-semibold">
            <UIcon name="i-lucide-receipt" class="size-4 shrink-0" />
            {{
              deductiblePct > 0 ? `${deductiblePct}% of spend qualifies` : 'No deductible expenses'
            }}
          </p>
          <p class="mt-0.5 text-xs text-muted">Net deductible this year</p>
        </div>
      </UCard>

      <!-- Billable -->
      <UCard>
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm text-muted">Billable YTD</p>
          <UBadge v-if="billablePct > 0" color="warning" variant="subtle" size="lg">
            {{ billablePct }}% of spend
          </UBadge>
        </div>
        <p class="mt-2 text-4xl font-bold tracking-tight tabular-nums">
          {{ formatCurrency(store.ytdBillable.value) }}
        </p>
        <div class="mt-4">
          <p class="flex items-center gap-1.5 text-sm font-semibold">
            <UIcon name="i-lucide-file-check-2" class="size-4 shrink-0" />
            {{ billablePct > 0 ? `${billablePct}% of total spend` : 'No billable expenses' }}
          </p>
          <p class="mt-0.5 text-xs text-muted">Flagged for client billing</p>
        </div>
      </UCard>
    </div>

    <ExpenseContributionHeatmap />

    <!-- Charts row 1: Category bar + Vendor donut -->
    <div class="grid gap-4 xl:grid-cols-5">
      <UCard class="xl:col-span-3">
        <template #header>
          <div class="flex items-baseline gap-2">
            <h3 class="font-semibold">Spend by Category</h3>
            <span class="text-xs text-muted">YTD</span>
          </div>
        </template>
        <div class="h-[320px]">
          <div
            v-if="store.categorySpendYtd.value.length === 0"
            class="grid h-full place-items-center text-sm text-dimmed"
          >
            No expenses yet
          </div>
          <BarChart
            v-else
            :data="store.categorySpendYtd.value.slice(0, 8)"
            :categories="categoryChartCategories"
            :height="300"
            :orientation="Orientation.Horizontal"
            :x-formatter="compactCurrency"
            :y-formatter="categoryLabel"
            :y-axis="['total']"
            x-axis="category"
            :hide-legend="true"
            :bar-padding="0.25"
            :radius="4"
            :x-grid-line="true"
          />
        </div>
      </UCard>

      <UCard class="xl:col-span-2">
        <template #header>
          <div class="flex items-baseline gap-2">
            <h3 class="font-semibold">Top Vendors</h3>
            <span class="text-xs text-muted">YTD · top 5</span>
          </div>
        </template>
        <div class="h-[320px]">
          <div
            v-if="topVendorDonutData.length === 0"
            class="grid h-full place-items-center text-sm text-dimmed"
          >
            No expenses yet
          </div>
          <DonutChart
            v-else
            :data="topVendorDonutData"
            :categories="topVendorDonutCategories"
            :radius="0"
            :arc-width="32"
            :pad-angle="0.04"
            :height="300"
            :legend-position="LegendPosition.BottomCenter"
          >
            <div class="text-center">
              <div class="text-2xl font-bold tabular-nums">
                {{ compactCurrency(store.ytdSpend.value) }}
              </div>
              <div class="text-xs text-muted">Total YTD</div>
            </div>
          </DonutChart>
        </div>
      </UCard>
    </div>

    <!-- Charts row 2: Monthly spend trend -->
    <UCard>
      <template #header>
        <div class="flex items-baseline gap-2">
          <h3 class="font-semibold">Monthly Spend</h3>
          <span class="text-xs text-muted">{{ currentYear }}</span>
        </div>
      </template>
      <div class="h-[250px]">
        <div
          v-if="store.ytdSpend.value === 0"
          class="grid h-full place-items-center text-sm text-dimmed"
        >
          No expenses yet
        </div>
        <BarChart
          v-else
          :data="monthlySpendTruncated"
          :categories="monthlyChartCategories"
          :height="230"
          :y-axis="['total']"
          x-axis="month"
          :x-formatter="(v: number | string | Date) => String(v)"
          :y-formatter="compactCurrency"
          :hide-legend="true"
          :y-grid-line="true"
          :y-num-ticks="4"
          :radius="4"
          :bar-padding="0.3"
        />
      </div>
    </UCard>
  </div>
</template>
