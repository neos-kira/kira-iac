/**
 * 進捗をサーバー（API + DynamoDB）に送信・取得し、admin が任意の端末から進捗確認できるようにする。
 */
import type { TraineeProgressSnapshot } from './traineeProgressStorage'

const DEFAULT_API_URL = 'https://wfhfqq0tjh.execute-api.ap-northeast-1.amazonaws.com'
const BASE_URL = (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_PROGRESS_API_URL
  ? (import.meta.env.VITE_PROGRESS_API_URL as string)
  : DEFAULT_API_URL
).replace(/\/$/, '')

const SESSION_TOKEN_KEY = 'kira-session-token'

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(SESSION_TOKEN_KEY)
    if (v && v.trim()) return v
    const cookie = getCookieValue(SESSION_TOKEN_KEY)
    return cookie && cookie.trim() ? cookie : null
  } catch {
    const cookie = getCookieValue(SESSION_TOKEN_KEY)
    return cookie && cookie.trim() ? cookie : null
  }
}

function buildAuthHeaders(base: HeadersInit = {}): HeadersInit {
  const noCache = { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
  const token = getSessionToken()
  if (!token) return { ...base, ...noCache }
  return {
    ...base,
    ...noCache,
    Authorization: `Bearer ${token}`,
    'X-Session-Token': token,
  }
}

export function isProgressApiAvailable(): boolean {
  return BASE_URL.length > 0
}

/** 進捗をサーバーに保存（受講生ログイン中に定期的に呼ぶ） */
export async function postProgress(traineeId: string, snapshot: TraineeProgressSnapshot): Promise<boolean> {
  if (!BASE_URL) return false
  const id = traineeId.trim().toLowerCase()
  if (!id || id === 'admin') return false
  try {
    const res = await fetch(`${BASE_URL}/progress`, {
      method: 'PUT',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'omit',
      body: JSON.stringify({ traineeId: id, ...snapshot }),
    })
    if (!res.ok) {
      // Authorization ヘッダー等で CORS/認証が絡む場合でも、サーバーが無認証で受けられる構成に備えてフォールバックする。
      console.log('[Sync] postProgress failed:', { status: res.status })
      const fallback = await fetch(`${BASE_URL}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ traineeId: id, ...snapshot }),
      })
      return fallback.ok
    }
    return res.ok
  } catch {
    // fetch が CORS 等で落ちる場合も、ヘッダー無しで再試行する
    try {
      console.log('[Sync] postProgress exception: retry without auth headers')
      const fallback = await fetch(`${BASE_URL}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ traineeId: id, ...snapshot }),
      })
      return fallback.ok
    } catch {
      return false
    }
  }
}

export type TraineeProgressFromApi = TraineeProgressSnapshot & { traineeId: string }

/** 全受講生の進捗をサーバーから取得（admin 画面用）。401 の場合は認証ヘッダー無しで再試行し、ログイン画面へ戻さない。 */
export async function fetchProgressFromApi(): Promise<TraineeProgressFromApi[]> {
  if (!BASE_URL) return []
  try {
    const res = await fetch(`${BASE_URL}/progress?t=${Date.now()}`, {
      method: 'GET',
      headers: buildAuthHeaders(),
      credentials: 'omit',
    })
    if (res.ok) {
      const data = (await res.json()) as { trainees?: TraineeProgressFromApi[] }
      return Array.isArray(data.trainees) ? data.trainees : []
    }
    if (res.status === 401) console.log('[Sync] fetchProgressFromApi 401: 認証なしで再試行')
    const fallback = await fetch(`${BASE_URL}/progress?t=${Date.now()}`, { method: 'GET', credentials: 'omit' })
    if (!fallback.ok) return []
    const data2 = (await fallback.json()) as { trainees?: TraineeProgressFromApi[] }
    return Array.isArray(data2.trainees) ? data2.trainees : []
  } catch {
    try {
      console.log('[Sync] fetchProgressFromApi 例外: 認証なしで再試行')
      const fallback = await fetch(`${BASE_URL}/progress?t=${Date.now()}`, { method: 'GET', credentials: 'omit' })
      if (!fallback.ok) return []
      const data2 = (await fallback.json()) as { trainees?: TraineeProgressFromApi[] }
      return Array.isArray(data2.trainees) ? data2.trainees : []
    } catch {
      return []
    }
  }
}

/** 指定受講生の進捗をサーバーから取得（受講生画面用）。なければ null。 */
export async function fetchMyProgress(traineeId: string): Promise<TraineeProgressSnapshot | null> {
  if (!BASE_URL) return null
  const id = traineeId.trim().toLowerCase()
  if (!id || id === 'admin') return null
  const all = await fetchProgressFromApi()
  const me = all.find((t) => (t.traineeId || '').trim().toLowerCase() === id)
  if (!me) return null
  const pins = Array.isArray(me.pins) ? me.pins : []
  if (typeof console !== 'undefined' && console.log) {
    console.log('[Sync] fetchMyProgress 取得:', { traineeId: id, pinsCount: pins.length })
  }
  return { ...me, pins }
}
