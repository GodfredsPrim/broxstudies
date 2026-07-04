import axios, { AxiosError } from 'axios'

export const TOKEN_KEY = 'brox.v2.token'

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {}
}

export const api = axios.create({
  baseURL: '/',
  timeout: 60_000,
})

api.interceptors.request.use((config) => {
  const tok = getToken()
  if (tok) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${tok}`
  }
  return config
})

const SUBSCRIPTION_REQUIRED_DETAIL = 'An active subscription is required for this feature.'

api.interceptors.response.use(
  (response) => response,
  (err) => {
    if (err instanceof AxiosError && err.response?.status === 403 && err.response.data?.detail === SUBSCRIPTION_REQUIRED_DETAIL) {
      if (window.location.pathname !== '/activate') {
        window.location.assign('/activate')
      }
    }
    return Promise.reject(err)
  }
)

export function extractError(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof AxiosError) {
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) return detail.map((d: any) => d.msg || d).join('; ')
    if (err.message) return err.message
  }
  return fallback
}
