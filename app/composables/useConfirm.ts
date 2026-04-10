export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  color?: 'error' | 'warning' | 'primary' | 'neutral'
}

const open = ref(false)
const options = ref<ConfirmOptions>({ title: '' })
let _resolve: ((value: boolean) => void) | null = null

export function useConfirm() {
  function confirm(opts: ConfirmOptions): Promise<boolean> {
    options.value = opts
    open.value = true
    return new Promise((resolve) => {
      _resolve = resolve
    })
  }

  function handleConfirm() {
    open.value = false
    _resolve?.(true)
    _resolve = null
  }

  function handleCancel() {
    open.value = false
    _resolve?.(false)
    _resolve = null
  }

  return { open, options, confirm, handleConfirm, handleCancel }
}
