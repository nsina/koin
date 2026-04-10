<script setup lang="ts">
import { CalendarDate } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'

type CalendarDateRange = { start: DateValue | undefined; end: DateValue | undefined }

/**
 * Reusable date picker built on UCalendar + UPopover.
 *
 * Single mode (default):
 *   <AppDatePicker v-model="isoString" />
 *
 * Range mode:
 *   <AppDatePicker range v-model:from="isoFrom" v-model:to="isoTo" />
 *
 * All values are ISO strings (YYYY-MM-DD).
 */

const props = defineProps<{
  modelValue?: string
  from?: string
  to?: string
  range?: boolean
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:from': [value: string]
  'update:to': [value: string]
}>()

const isOpen = ref(false)

function isoToCalendarDate(iso: string | undefined): CalendarDate | undefined {
  if (!iso) return undefined
  const parts = iso.split('-').map(Number)
  const [y, m, d] = parts
  if (!y || !m || !d) return undefined
  return new CalendarDate(y, m, d)
}

function calendarDateToISO(date: DateValue): string {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
}

const singleCalendarValue = computed(() => isoToCalendarDate(props.modelValue))

const rangeCalendarValue = computed(
  (): CalendarDateRange => ({
    start: isoToCalendarDate(props.from),
    end: isoToCalendarDate(props.to)
  })
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onSingleUpdate(date: any) {
  emit('update:modelValue', date ? calendarDateToISO(date as DateValue) : '')
  if (date) isOpen.value = false
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onRangeUpdate(range: any) {
  const r = range as CalendarDateRange
  emit('update:from', r?.start ? calendarDateToISO(r.start) : '')
  emit('update:to', r?.end ? calendarDateToISO(r.end) : '')
  if (r?.start && r?.end) isOpen.value = false
}

const buttonLabel = computed(() => {
  if (props.range) {
    if (!props.from && !props.to) return props.placeholder ?? 'Pick a range'
    const from = props.from ? formatDateLong(props.from) : '...'
    const to = props.to ? formatDateLong(props.to) : '...'
    return `${from} – ${to}`
  }
  if (!props.modelValue) return props.placeholder ?? 'Pick a date'
  return formatDateLong(props.modelValue)
})
</script>

<template>
  <UPopover v-model:open="isOpen">
    <UButton
      color="neutral"
      variant="outline"
      icon="i-lucide-calendar"
      :label="buttonLabel"
      :disabled="disabled"
      :class="range ? 'w-58' : 'min-w-36'"
    />
    <template #content>
      <div class="p-3">
        <UCalendar
          v-if="range"
          range
          :model-value="rangeCalendarValue"
          @update:model-value="onRangeUpdate"
        />
        <UCalendar v-else :model-value="singleCalendarValue" @update:model-value="onSingleUpdate" />
      </div>
    </template>
  </UPopover>
</template>
