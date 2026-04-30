import { toastError } from '../components/common'

export class ApiError extends Error {
  constructor(message, payload) {
    super(message)
    this.name = 'ApiError'
    this.status = Number(payload?.status || 0)
    this.code = payload?.code ? String(payload.code) : ''
    this.data = payload?.data
  }
}

function extractMessage(data) {
  const msg = data?.message ?? data?.error ?? ''
  if (Array.isArray(msg)) return msg.filter(Boolean).join('；')
  return msg ? String(msg) : ''
}

function friendlyMessage(status, data) {
  const code = data?.code ? String(data.code) : ''
  if (status === 401) return '登录已过期，请重新登录'
  if (status === 402 || code === 'INSUFFICIENT_CREDITS') return '余额不足，无法完成本次操作'
  if (status >= 500) return '服务器开小差了，请稍后重试'
  return extractMessage(data) || `请求失败（${status}）`
}

async function parseResponseBody(response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

export async function apiFetch(url, init, opts) {
  const options = opts || {}
  const showToast = options.toast !== false
  const redirectOn401 = options.redirectOn401 !== false

  try {
    const response = await fetch(url, init)
    const data = await parseResponseBody(response)

    if (response.ok) return data

    const message = friendlyMessage(response.status, data)
    const code = data?.code ? String(data.code) : ''

    if (showToast) toastError(message)
    if (response.status === 401 && redirectOn401 && window?.location?.pathname !== '/auth') {
      window.location.href = '/auth'
    }

    throw new ApiError(message, { status: response.status, code, data })
  } catch (err) {
    if (err instanceof ApiError) throw err

    const message = '网络异常，请检查网络连接后重试'
    if (showToast) toastError(message)
    throw new ApiError(message, { status: 0, code: 'NETWORK_ERROR', data: null })
  }
}

