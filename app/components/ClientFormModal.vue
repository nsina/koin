<script setup lang="ts">
import type { Client, ClientStatus } from '~/composables/useClients'

const props = defineProps<{
  open: boolean
  client: Client | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: [client: Client]
}>()

const { addClient, updateClient } = useClients()
const toast = useToast()

const CLIENT_STATUS_ITEMS = [
  { label: 'Active', value: 'active' },
  { label: 'Prospect', value: 'prospect' },
  { label: 'Paused', value: 'paused' },
  { label: 'Ended', value: 'ended' },
]

function makeDraft() {
  return {
    name: props.client?.name ?? '',
    contactName: props.client?.contactName ?? '',
    email: props.client?.email ?? '',
    billingCode: props.client?.billingCode ?? '',
    status: props.client?.status ?? ('active' as ClientStatus),
    notes: props.client?.notes ?? '',
  }
}

const draft = reactive(makeDraft())
const saving = ref(false)

watch(
  () => [props.open, props.client] as const,
  ([open, client], prev) => {
    const wasOpen = prev?.[0] ?? false
    const clientChanged = prev !== undefined && prev[1] !== client
    if ((open && !wasOpen) || clientChanged) Object.assign(draft, makeDraft())
  },
  { immediate: true },
)

function close() {
  emit('update:open', false)
}

async function submit() {
  if (!draft.name.trim()) {
    toast.add({ title: 'Client name is required', color: 'warning' })
    return
  }

  const payload = {
    name: draft.name.trim(),
    contactName: draft.contactName.trim(),
    email: draft.email.trim() || null,
    billingCode: draft.billingCode.trim().toUpperCase(),
    status: draft.status,
    notes: draft.notes.trim(),
  }

  saving.value = true
  try {
    if (props.client) {
      await updateClient(props.client.id, payload)
    } else {
      const created = await addClient(payload)
      emit('saved', created)
    }
    close()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="client ? 'Edit Client' : 'New Client'"
    :dismissible="false"
    :ui="{ content: 'sm:max-w-xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Client Name" class="sm:col-span-2">
          <UInput
            v-model="draft.name"
            placeholder="Acme Inc."
            autofocus
            class="w-full"
            @keydown.enter="submit"
          />
        </UFormField>
        <UFormField label="Contact Name">
          <UInput v-model="draft.contactName" placeholder="Jane Doe" class="w-full" />
        </UFormField>
        <UFormField label="Email">
          <UInput
            v-model="draft.email"
            type="email"
            placeholder="client@example.com"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Status">
          <USelect
            v-model="draft.status"
            :items="CLIENT_STATUS_ITEMS"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Billing Code" hint="Mercury">
          <UInput
            v-model="draft.billingCode"
            placeholder="DCNE"
            class="w-full font-mono uppercase"
          />
        </UFormField>
        <UFormField label="Notes" class="sm:col-span-2">
          <UTextarea v-model="draft.notes" :rows="2" autoresize class="w-full" />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="soft" @click="close" />
        <UButton
          :label="client ? 'Save Client' : 'Add Client'"
          :icon="client ? 'i-lucide-save' : 'i-lucide-plus'"
          :loading="saving"
          color="neutral"
          variant="solid"
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
