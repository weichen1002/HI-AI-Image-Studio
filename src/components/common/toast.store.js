import { reactive } from 'vue'

const state = reactive({
  items: []
})

function addToast(payload) {
  const item = {
    id: crypto.randomUUID(),
    type: payload?.type || 'info',
    message: String(payload?.message || ''),
    duration: Number(payload?.duration || 2200)
  }
  state.items.push(item)
  setTimeout(() => {
    const idx = state.items.findIndex((t) => t.id === item.id)
    if (idx >= 0) state.items.splice(idx, 1)
  }, item.duration)
}

export function toastSuccess(message, duration) {
  addToast({ type: 'success', message, duration })
}

export function toastError(message, duration) {
  addToast({ type: 'error', message, duration })
}

export function toastInfo(message, duration) {
  addToast({ type: 'info', message, duration })
}

export function useToastState() {
  return state
}

