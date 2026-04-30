import { reactive } from 'vue'

const state = reactive({
  items: [],
  queue: []
})

const maxVisible = 3
const timers = new Map()
const recent = new Map()
const dedupeWindowMs = 1200

function normalizePayload(type, messageOrPayload, duration) {
  if (messageOrPayload && typeof messageOrPayload === 'object') {
    const payload = messageOrPayload
    return {
      type: payload.type || type || 'info',
      message: String(payload.message || ''),
      duration: Number(payload.duration ?? duration ?? 2200),
      action: payload.action,
      closable: payload.closable === true
    }
  }
  return {
    type: type || 'info',
    message: String(messageOrPayload || ''),
    duration: Number(duration ?? 2200),
    action: undefined,
    closable: false
  }
}

function dedupeKey(item) {
  return `${item.type}:${item.message}`
}

function scheduleRemove(id, duration) {
  if (!Number.isFinite(duration) || duration <= 0) return
  const tid = setTimeout(() => closeToast(id), duration)
  timers.set(id, tid)
}

function addToast(payload) {
  const item = {
    id: crypto.randomUUID(),
    type: payload?.type || 'info',
    message: String(payload?.message || ''),
    duration: Number(payload?.duration || 2200),
    action: payload?.action,
    closable: payload?.closable === true
  }

  const key = dedupeKey(item)
  const now = Date.now()
  const last = recent.get(key) || 0
  if (now - last < dedupeWindowMs) return
  recent.set(key, now)

  const hasSame =
    state.items.some((t) => dedupeKey(t) === key) ||
    state.queue.some((t) => dedupeKey(t) === key)
  if (hasSame) return

  if (state.items.length < maxVisible) {
    state.items.push(item)
    scheduleRemove(item.id, item.duration)
    return item.id
  }

  state.queue.push(item)
  return item.id
}

export function closeToast(id) {
  const tid = timers.get(id)
  if (tid) {
    clearTimeout(tid)
    timers.delete(id)
  }
  const idx = state.items.findIndex((t) => t.id === id)
  if (idx >= 0) state.items.splice(idx, 1)

  while (state.items.length < maxVisible && state.queue.length) {
    const next = state.queue.shift()
    if (!next) break
    state.items.push(next)
    scheduleRemove(next.id, next.duration)
  }
}

export function toastSuccess(message, duration) {
  addToast(normalizePayload('success', message, duration))
}

export function toastError(message, duration) {
  addToast(normalizePayload('error', message, duration))
}

export function toastInfo(message, duration) {
  addToast(normalizePayload('info', message, duration))
}

export function useToastState() {
  return state
}
