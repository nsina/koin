<script setup lang="ts">
const props = defineProps<{
  selectedCount: number
  selectedTotal: string
  categories: string[]
}>()

const emit = defineEmits<{
  markBillable: []
  markNotBillable: []
  markDeductible: []
  markNotDeductible: []
  setCategory: [category: string]
  deleteSelected: []
  clearSelection: []
}>()

const selectedCategory = ref('')

const categoryItems = computed(() =>
  props.categories.map((category) => ({ label: category, value: category }))
)

watch(selectedCategory, (category) => {
  if (!category) return
  emit('setCategory', category)
  // Reset so the same category can be chosen again in a later action.
  selectedCategory.value = ''
})

const moreItems = [
  [
    {
      label: 'Mark Not Billable',
      icon: 'i-lucide-file-x',
      onSelect: () => emit('markNotBillable')
    },
    {
      label: 'Mark Not Deductible',
      icon: 'i-lucide-ban',
      onSelect: () => emit('markNotDeductible')
    }
  ]
]
</script>

<template>
  <UCard
    class="inline-flex max-w-full"
    :ui="{
      root: 'rounded-full border-2 border-default/20 bg-default/95 dark:bg-neutral-700/90 shadow-lg backdrop-blur supports-backdrop-filter:bg-default/90',
      body: 'p-6 sm:px-6 sm:py-4'
    }"
  >
    <div class="flex max-w-full flex-wrap items-center gap-3 sm:flex-nowrap">
      <p class="text-sm font-semibold whitespace-nowrap text-default">
        {{ selectedCount }} selected &#11825; {{ selectedTotal }}
      </p>

      <USelectMenu
        v-model="selectedCategory"
        value-key="value"
        placeholder="Category"
        :search-input="{ placeholder: 'Search categories...' }"
        :items="categoryItems"
        size="md"
        class="w-48 sm:w-56"
      />

      <div class="flex items-center gap-1 sm:ml-auto">
        <UTooltip text="Mark Billable" :content="{ side: 'top' }">
          <UButton
            icon="i-lucide-receipt"
            color="neutral"
            variant="ghost"
            size="md"
            square
            class="rounded-full"
            aria-label="Mark selected as billable"
            @click="emit('markBillable')"
          />
        </UTooltip>

        <UTooltip text="Mark Tax Deductible" :content="{ side: 'top' }">
          <UButton
            icon="i-lucide-landmark"
            color="neutral"
            variant="ghost"
            size="md"
            square
            class="rounded-full"
            aria-label="Mark selected as tax deductible"
            @click="emit('markDeductible')"
          />
        </UTooltip>

        <UDropdownMenu
          :items="moreItems"
          :filter="{ placeholder: 'Search actions...' }"
          :content="{ align: 'end', sideOffset: 10 }"
        >
          <UTooltip text="More actions" :content="{ side: 'top' }">
            <UButton
              icon="i-lucide-ellipsis-vertical"
              color="neutral"
              variant="ghost"
              size="md"
              square
              class="rounded-full"
              aria-label="More bulk actions"
            />
          </UTooltip>
        </UDropdownMenu>

        <UTooltip text="Delete Selected" :content="{ side: 'top' }">
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="md"
            square
            class="rounded-full"
            aria-label="Delete selected expenses"
            @click="emit('deleteSelected')"
          />
        </UTooltip>

        <USeparator orientation="vertical" size="sm" class="mx-1 h-6" />

        <UTooltip text="Clear Selection" :content="{ side: 'top' }">
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="link"
            size="md"
            square
            class="rounded-full"
            aria-label="Clear selection"
            @click="emit('clearSelection')"
          />
        </UTooltip>
      </div>
    </div>
  </UCard>
</template>
