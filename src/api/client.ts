import type {
  AtmDto,
  EventDto,
  TransactionPageDto,
  OperationalLoadSeriesDto,
  TransactionSummaryDto,
  AlertDto,
  RunSummaryDto,
  ActiveRunDto,
  ThesisValidationDto,
  CashEstimationDto,
  UserDto,
} from '../types'

export const API_BASE = (import.meta.env.VITE_ODIN_API_BASE ?? 'http://localhost:5000').replace(/\/$/, '')
const TOKEN_KEY = 'odin.auth.token'

export interface Session {
  username: string
  role: string
  token: string
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function storeToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

function authHeaders(): HeadersInit {
  const token = getStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`)
  if (res.status === 204) return null as T
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(msg || `POST ${path} -> ${res.status}`)
  }
  return res.json()
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(msg || `PUT ${path} -> ${res.status}`)
  }
  return res.json()
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE', headers: authHeaders() })
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(msg || `DELETE ${path} -> ${res.status}`)
  }
  return res.json()
}

export const api = {
  login: (username: string, password: string) => post<Session>('/api/auth/login', { username, password }),
  me: () => get<{ username: string; role: string }>('/api/auth/me'),
  getAtms: () => get<AtmDto[]>('/api/atms'),
  getEvents: (pageSize = 50, runId?: string) => get<{ items: EventDto[] }>(`/api/events?pageSize=${pageSize}${runId ? `&runId=${encodeURIComponent(runId)}` : ''}`),
  getTransactions: (params: {
    runId?: string
    page?: number
    pageSize?: number
    query?: string
    city?: string
    type?: string
    status?: string
    from?: string
    to?: string
  } = {}) => get<TransactionPageDto>(`/api/transactions${toQuery(params)}`),
  getOperationalLoadSeries: (params: {
    runId?: string
    granularity?: string
    query?: string
    city?: string
    type?: string
    status?: string
    from?: string
    to?: string
  } = {}) => get<OperationalLoadSeriesDto>(`/api/transactions/series${toQuery(params)}`),
  getTransactionSummary: (params: {
    runId?: string
    query?: string
    city?: string
    type?: string
    status?: string
    from?: string
    to?: string
  } = {}) => get<TransactionSummaryDto>(`/api/transactions/summary${toQuery(params)}`),
  getAlerts: (runId?: string) => get<AlertDto[]>(`/api/alerts${runId ? `?runId=${encodeURIComponent(runId)}` : ''}`),
  getClock: () => get<{ simulatedTime: string; speedMultiplier: number; isActive: boolean }>('/api/clock'),
  getRuns: () => get<RunSummaryDto[]>('/api/runs'),
  getActiveRun: () => get<{ activeRun: ActiveRunDto | null }>('/api/runs/active'),
  getThesisValidation: () => get<ThesisValidationDto>('/api/reports/thesis-validation'),
  getCashEstimation: (runId?: string) => get<CashEstimationDto>(`/api/estimation/cash?horizonMinutes=60&windowMinutes=60&maxTransactionsPerAtm=20${runId ? `&runId=${encodeURIComponent(runId)}` : ''}`),
  getUsers: () => get<UserDto[]>('/api/users'),
  createUser: (data: { username: string; password: string; role: string }) => post<UserDto>('/api/users', data),
  updateUser: (id: number, data: { role: string }) => put<UserDto>(`/api/users/${id}`, data),
  deleteUser: (id: number) => del<{ id: number }>(`/api/users/${id}`),
  deleteRun: (runId: string) => del<{ runId: string }>(`/api/runs/${encodeURIComponent(runId)}`),
}

function toQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}
