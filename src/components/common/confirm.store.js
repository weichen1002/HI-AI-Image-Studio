import { reactive } from 'vue'

const defaultOptions = {
  open: false,
  title: '确认操作',
  message: '确定要继续吗？',
  details: '',
  objectName: '',
  tone: 'danger',
  confirmText: '确认',
  cancelText: '取消',
  destructive: true,
  loading: false
}

const state = reactive({ ...defaultOptions })
let resolver = null

function settle(value) {
  const done = resolver
  resolver = null
  Object.assign(state, { ...defaultOptions, open: false })
  done?.(value)
}

export function useConfirmState() {
  return state
}

export function confirmAction(options = {}) {
  if (resolver) settle(false)
  Object.assign(state, {
    ...defaultOptions,
    ...options,
    open: true,
    loading: false
  })
  return new Promise((resolve) => {
    resolver = resolve
  })
}

export function confirmDanger(options = {}) {
  return confirmAction({
    tone: 'danger',
    confirmText: '删除',
    destructive: true,
    ...options
  })
}

export function resolveConfirm(value) {
  settle(value)
}
