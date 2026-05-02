<script setup lang="ts">
import { PAYMENT_METHODS } from '~/composables/useExpenseStore'

definePageMeta({ layout: false, ssr: false })

const store = useExpenseStore()
const {
  irsRatePerMile,
  companyName,
  defaultPaymentMethod,
  fiscalYearStart,
  mercuryApiToken,
  saveSetting,
} = useSettings()
const toast = useToast()
const { confirm } = useConfirm()
const {
  public: { appVersion, appAuthor, appLicense, appDescription },
} = useRuntimeConfig()
const currentYear = new Date().getFullYear()

const draftCompanyName = ref(companyName.value)
const draftRate = ref(irsRatePerMile.value)
const draftPaymentMethod = ref(defaultPaymentMethod.value)
const draftFiscalYearStart = ref(fiscalYearStart.value)
const draftMercuryToken = ref(mercuryApiToken.value)
const restoreFile = ref<File | null>(null)
const restoringBackup = ref(false)
const wipeModalOpen = ref(false)
const wipeConfirmText = ref('')
const wipingAllData = ref(false)
const storageUsedBytes = ref(0)
const storageFileCount = ref(0)
const storageLoading = ref(true)
const storageError = ref(false)

type ConnectionStatus = 'idle' | 'loading' | 'success' | 'error'
const connectionStatus = ref<ConnectionStatus>('idle')

watch(draftMercuryToken, () => {
  connectionStatus.value = 'idle'
})

const tokenHasUnsavedChanges = computed(() => draftMercuryToken.value !== mercuryApiToken.value)

const tokenSaved = ref(false)

const storageUsedMegabytes = computed(() => storageUsedBytes.value / (1024 * 1024))
const storageUsedLabel = computed(() => {
  const usedMb = storageUsedMegabytes.value
  if (usedMb <= 0) return '0 MB'
  if (usedMb < 10) return `${usedMb.toFixed(1)} MB`
  return `${Math.round(usedMb)} MB`
})
const storageFileLabel = computed(() => {
  const fileWord = storageFileCount.value === 1 ? 'receipt file' : 'receipt files'
  return `${storageFileCount.value} ${fileWord}`
})

async function loadStorageUsage() {
  storageLoading.value = true
  storageError.value = false

  try {
    const response = await $fetch<{ usedBytes: number; fileCount: number }>('/api/settings/storage')
    storageUsedBytes.value = Math.max(0, response.usedBytes ?? 0)
    storageFileCount.value = Math.max(0, response.fileCount ?? 0)
  } catch {
    storageError.value = true
  } finally {
    storageLoading.value = false
  }
}

onMounted(() => {
  loadStorageUsage()
})

async function saveToken() {
  await saveSetting('mercury_api_token', draftMercuryToken.value, true)
  tokenSaved.value = true
  setTimeout(() => (tokenSaved.value = false), 800)
}

async function restoreSelectedBackup() {
  if (!restoreFile.value || restoringBackup.value) return

  const ok = await confirm({
    title: 'Restore backup and overwrite current data?',
    description:
      'This will replace your current expenses and mileage trips with the selected backup file.',
    confirmLabel: 'Restore Backup',
    cancelLabel: 'Cancel',
    color: 'error',
  })
  if (!ok) return

  restoringBackup.value = true
  try {
    await store.restoreBackup(restoreFile.value)
    restoreFile.value = null
  } finally {
    restoringBackup.value = false
  }
}

async function testConnection() {
  connectionStatus.value = 'loading'
  try {
    await $fetch('/api/mercury/verify', { method: 'POST' })
    connectionStatus.value = 'success'
  } catch {
    connectionStatus.value = 'error'
  }
}

watch(companyName, (v) => (draftCompanyName.value = v), { immediate: true })
watch(irsRatePerMile, (v) => (draftRate.value = v), { immediate: true })
watch(defaultPaymentMethod, (v) => (draftPaymentMethod.value = v), { immediate: true })
watch(fiscalYearStart, (v) => (draftFiscalYearStart.value = v), { immediate: true })
watch(mercuryApiToken, (v) => (draftMercuryToken.value = v), { immediate: true })

const hasChanges = computed(
  () =>
    draftCompanyName.value !== companyName.value ||
    draftRate.value !== irsRatePerMile.value ||
    draftPaymentMethod.value !== defaultPaymentMethod.value ||
    draftFiscalYearStart.value !== fiscalYearStart.value ||
    draftMercuryToken.value !== mercuryApiToken.value,
)

const canWipeAllData = computed(() => wipeConfirmText.value.trim() === 'DELETE')

async function goBack() {
  if (hasChanges.value) {
    const ok = await confirm({
      title: 'Discard unsaved changes?',
      description: 'Your changes will not be saved.',
      confirmLabel: 'Discard',
      color: 'neutral',
    })
    if (!ok) return
  }
  navigateTo('/')
}

async function saveAll() {
  await Promise.all([
    saveSetting('companyName', draftCompanyName.value, true),
    saveSetting('irsRatePerMile', String(draftRate.value), true),
    saveSetting('defaultPaymentMethod', draftPaymentMethod.value, true),
    saveSetting('fiscalYearStart', draftFiscalYearStart.value, true),
    ...(draftMercuryToken.value !== mercuryApiToken.value
      ? [saveSetting('mercury_api_token', draftMercuryToken.value, true)]
      : []),
  ])
  toast.add({ title: 'Settings saved', color: 'success' })
  navigateTo('/')
}

function openWipeModal() {
  wipeConfirmText.value = ''
  wipeModalOpen.value = true
}

async function wipeAllData() {
  if (!canWipeAllData.value || wipingAllData.value) return

  wipingAllData.value = true
  try {
    await $fetch('/api/admin/wipe', {
      method: 'POST',
      body: { confirmation: wipeConfirmText.value.trim() },
    })

    wipeModalOpen.value = false
    toast.add({ title: 'All data wiped', color: 'success' })
    reloadNuxtApp({ path: '/' })
  } catch {
    toast.add({
      title: 'Wipe failed',
      description: 'Please confirm by typing DELETE and try again.',
      color: 'error',
    })
  } finally {
    wipingAllData.value = false
  }
}
</script>

<template>
  <UHeader>
    <template #left>
      <UButton
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        label="Back"
        @click="goBack"
      />
    </template>
    <template #title>
      <span class="font-extrabold tracking-tight">Settings</span>
    </template>
    <template #right>
      <UButton
        label="Save"
        color="primary"
        variant="solid"
        :disabled="!hasChanges"
        @click="saveAll"
      />
    </template>
  </UHeader>

  <UMain>
    <div class="mx-auto w-full max-w-lg space-y-6 px-6 py-8 md:px-10">
      <USeparator label="General Preferences" />

      <div class="space-y-5">
        <UFormField label="Company Name">
          <UInput v-model="draftCompanyName" placeholder="Your company name" class="w-full" />
        </UFormField>

        <UFormField label="IRS Mileage Rate ($/mi)">
          <template #description>
            Update each January when the IRS publishes new rates.<br />
            <ULink
              to="https://www.irs.gov/tax-professionals/standard-mileage-rates"
              target="_blank"
              class="underline"
              >Check current rates</ULink
            >
          </template>
          <div class="flex w-full">
            <UInputNumber
              v-model="draftRate"
              color="neutral"
              :min="0"
              :step="0.001"
              :increment="false"
              :decrement="false"
              :format-options="{ minimumFractionDigits: 3, maximumFractionDigits: 3 }"
              disable-wheel-change
              class="flex-1"
              :ui="{ base: 'rounded-r-none' }"
            />
            <div
              class="flex items-center rounded-r-md border border-l-0 border-neutral-300 bg-neutral-50 px-3 text-sm text-neutral-500 select-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"
            >
              $/mi
            </div>
          </div>
        </UFormField>

        <UFormField label="Default Payment Method">
          <USelectMenu v-model="draftPaymentMethod" :items="PAYMENT_METHODS" class="w-full" />
        </UFormField>

        <UFormField
          label="Fiscal Year Start"
          hint="MM-DD"
          description="Determines the default date range in Tax Report. Use 01-01 for a calendar year."
        >
          <UInput v-model="draftFiscalYearStart" placeholder="01-01" class="w-full" />
        </UFormField>
      </div>

      <USeparator label="Mercury API" />

      <UFormField label="Mercury API Token">
        <template #description>
          Generate a <strong>Read Only</strong> token at
          <ULink to="https://app.mercury.com/settings/tokens" target="_blank" class="underline"
            >Mercury Settings</ULink
          >. Enables direct transaction sync without CSV export.
        </template>
        <div class="space-y-2">
          <UInput
            v-model="draftMercuryToken"
            type="password"
            placeholder="secret-token:..."
            class="w-full"
          />
          <div class="flex items-center gap-2">
            <UButton
              v-if="tokenHasUnsavedChanges || tokenSaved"
              size="xs"
              :color="tokenSaved ? 'success' : 'neutral'"
              variant="outline"
              :label="tokenSaved ? 'Saved' : 'Save Token'"
              :icon="tokenSaved ? 'i-lucide-check' : 'i-lucide-save'"
              :disabled="!draftMercuryToken || tokenSaved"
              @click="saveToken"
            />
            <UButton
              v-else
              size="xs"
              color="neutral"
              variant="outline"
              :loading="connectionStatus === 'loading'"
              :disabled="!draftMercuryToken || connectionStatus === 'loading'"
              label="Test Connection"
              @click="testConnection"
            />
            <span
              v-if="connectionStatus === 'success' && !tokenHasUnsavedChanges"
              class="flex items-center gap-1 text-xs text-success"
            >
              <UIcon name="i-lucide-check-circle" class="size-3.5" />
              Connected
            </span>
            <span
              v-else-if="connectionStatus === 'error' && !tokenHasUnsavedChanges"
              class="flex items-center gap-1 text-xs text-error"
            >
              <UIcon name="i-lucide-x-circle" class="size-3.5" />
              Invalid token
            </span>
          </div>
        </div>
      </UFormField>

      <USeparator label="Data Management" />

      <div class="space-y-3">
        <p class="text-sm text-muted">
          Export a backup JSON or restore from a previous backup file.
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            label="Export Database Backup"
            @click="store.exportBackup()"
          />
          <UFileUpload
            v-model="restoreFile"
            layout="list"
            label="Restore from Backup"
            description="Only .json backup files are accepted"
            :interactive="false"
            position="inside"
            accept=".json,application/json"
            class="w-full"
          >
            <template #actions="{ open }">
              <UButton
                icon="i-lucide-upload"
                color="neutral"
                variant="outline"
                label="Select Backup File"
                @click="open()"
              />
            </template>

            <template #files-bottom="{ files, removeFile }">
              <div v-if="files" class="mt-2 flex flex-wrap items-center gap-2">
                <UButton
                  label="Restore Backup"
                  icon="i-lucide-database-backup"
                  color="neutral"
                  :loading="restoringBackup"
                  :disabled="restoringBackup"
                  @click="restoreSelectedBackup"
                />
                <UButton
                  label="Clear"
                  color="neutral"
                  variant="ghost"
                  :disabled="restoringBackup"
                  @click="removeFile()"
                />
              </div>
            </template>
          </UFileUpload>
        </div>
      </div>

      <USeparator label="Storage" />

      <div class="space-y-2">
        <div class="space-y-2">
          <div v-if="storageLoading" class="space-y-2">
            <USkeleton class="h-4 w-40" />
            <USkeleton class="h-4 w-56" />
          </div>

          <div v-else-if="storageError" class="space-y-1">
            <p class="text-sm text-error">Unable to load storage usage.</p>
            <p class="text-xs text-muted">Try refreshing this page.</p>
          </div>

          <div v-else class="space-y-1">
            <p class="text-sm font-semibold">Storage Used</p>
            <p class="text-sm text-muted">{{ storageUsedLabel }} across {{ storageFileLabel }}</p>
          </div>
        </div>
      </div>

      <USeparator label="Danger Zone" />

      <div class="rounded-lg border border-error/30 bg-error/5 p-4">
        <div class="space-y-3">
          <div>
            <p class="text-sm font-semibold text-error">Factory Reset</p>
            <p class="text-xs text-muted">
              Permanently deletes all expenses, mileage trips, contractors, recurring templates,
              estimated tax payments, settings, and uploaded receipt files. This cannot be undone.
            </p>
          </div>

          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="solid"
            label="Factory Reset"
            @click="openWipeModal"
          />
        </div>
      </div>

      <USeparator decorative />

      <div class="space-y-1">
        <div class="flex items-center justify-between">
          <span class="text-md font-semibold">Koin</span>
          <UBadge :label="`v${appVersion}`" color="neutral" variant="soft" size="md" />
        </div>
        <p class="text-xs text-muted">{{ appDescription }}</p>
        <p class="text-xs text-muted">
          &copy; {{ currentYear }} {{ appAuthor }} &middot; {{ appLicense }} License
        </p>
      </div>
    </div>
  </UMain>

  <UModal
    v-model:open="wipeModalOpen"
    title="Factory Reset"
    description="Permanently deletes all data. This cannot be undone."
    :dismissible="!wipingAllData"
    :close="!wipingAllData"
  >
    <template #body>
      <div class="space-y-3">
        <UAlert
          color="error"
          variant="soft"
          icon="i-lucide-alert-triangle"
          title="Everything will be permanently deleted"
          description="All expenses, mileage trips, contractors, recurring templates, estimated tax payments, settings, and uploaded receipt files will be removed with no way to recover them."
        />

        <UFormField label='Type "DELETE" to confirm'>
          <UInput
            v-model="wipeConfirmText"
            placeholder="DELETE"
            class="w-full"
            :disabled="wipingAllData"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          :disabled="wipingAllData"
          @click="wipeModalOpen = false"
        />
        <UButton
          label="Factory Reset"
          icon="i-lucide-trash-2"
          color="error"
          :loading="wipingAllData"
          :disabled="!canWipeAllData || wipingAllData"
          @click="wipeAllData"
        />
      </div>
    </template>
  </UModal>
</template>
