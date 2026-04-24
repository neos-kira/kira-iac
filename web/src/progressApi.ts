/**
 * 進捗をサーバー（API + DynamoDB）に送信・取得し、admin が任意の端末から進捗確認できるようにする。
 */
import type { TraineeProgressSnapshot } from './traineeProgressStorage'
import { safeGetItem, safeRemoveItem, safeSetItem, getCookieValue, clearCookieValue } from './utils/storage'

const DEFAULT_API_URL = 'https://wfhfqq0tjh.execute-api.ap-northeast-1.amazonaws.com'
export const BASE_URL = (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_PROGRESS_API_URL
  ? (import.meta.env.VITE_PROGRESS_API_URL as string)
  : DEFAULT_API_URL
).replace(/\/$/, '')

const SESSION_TOKEN_KEY = 'kira-session-token'

export function forceLogout(): void {
  if (typeof window === 'undefined') return
  safeRemoveItem('kira-session-token')
  safeRemoveItem('kira-user-logged-in')
  safeRemoveItem('kira-user-display-name')
  clearCookieValue('kira-session-token')
  clearCookieValue('kira-user-logged-in')
  const base = (window.location.origin + window.location.pathname).replace(/\/$/, '')
  window.location.href = base + '#/login'
}

function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null
  const v = safeGetItem(SESSION_TOKEN_KEY)
  if (v && v.trim()) return v
  const cookie = getCookieValue(SESSION_TOKEN_KEY)
  return cookie && cookie.trim() ? cookie : null
}

export function buildAuthHeaders(base: HeadersInit = {}): HeadersInit {
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

/** セッショントークンからユーザー名を取得し、localStorageに復元する */
export async function fetchMe(): Promise<string | null> {
  if (!BASE_URL) return null
  try {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: buildAuthHeaders(),
      credentials: 'omit',
    })
    if (!res.ok) return null
    const data = (await res.json()) as { username?: string }
    const username = data.username ?? ''
    if (username) {
      safeSetItem('kira-user-display-name', username)
    }
    return username || null
  } catch {
    return null
  }
}

/** auth/me からユーザー情報（termsAgreedAt 含む）を取得する */
export async function fetchMeInfo(): Promise<{ username: string; role: string; termsAgreedAt: string | null; termsVersion: string | null } | null> {
  if (!BASE_URL) return null
  try {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: buildAuthHeaders(),
      credentials: 'omit',
    })
    if (!res.ok) return null
    const data = (await res.json()) as { username?: string; role?: string; termsAgreedAt?: string | null; termsVersion?: string | null }
    return {
      username: data.username ?? '',
      role: data.role ?? 'student',
      termsAgreedAt: data.termsAgreedAt ?? null,
      termsVersion: data.termsVersion ?? null,
    }
  } catch {
    return null
  }
}

/** 進捗をサーバーに保存（受講生ログイン中に定期的に呼ぶ） */
export async function postProgress(traineeId: string, snapshot: TraineeProgressSnapshot): Promise<boolean> {
  if (!BASE_URL) return false
  const id = traineeId.trim().toLowerCase()
  if (!id) return false
  const token = getSessionToken()
  console.log('[Sync] postProgress 開始:', { traineeId: id, hasToken: !!token })
  try {
    const res = await fetch(`${BASE_URL}/progress`, {
      method: 'PUT',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'omit',
      body: JSON.stringify({ traineeId: id, ...snapshot }),
    })
    console.log('[Sync] postProgress レスポンス:', { status: res.status, ok: res.ok })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.log('[Sync] postProgress エラー詳細:', errText)
      if (res.status === 401) {
        forceLogout()
        return false
      }
      const fallback = await fetch(`${BASE_URL}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ traineeId: id, ...snapshot }),
      })
      console.log('[Sync] postProgress fallback:', { status: fallback.status, ok: fallback.ok })
      return fallback.ok
    }
    return res.ok
  } catch (err) {
    console.log('[Sync] postProgress 例外(CORS?):', err)
    try {
      const fallback = await fetch(`${BASE_URL}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ traineeId: id, ...snapshot }),
      })
      console.log('[Sync] postProgress fallback(例外後):', { status: fallback.status, ok: fallback.ok })
      return fallback.ok
    } catch (err2) {
      console.log('[Sync] postProgress fallbackも例外:', err2)
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
    if (res.status === 401) {
      console.log('[Sync] fetchProgressFromApi 401: forceLogout')
      forceLogout()
      return []
    }
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

export type ScoreDetails = { who: boolean; what: boolean; when: boolean; where: boolean; why: boolean; how: boolean }
export type ScoreResult = { pass: boolean; feedback: string; details?: ScoreDetails }

export type ScoreResultV2 = {
  rating: 'pass' | 'partial' | 'fail'
  comment: string
  advice: string
}

/**
 * Lambdaプロキシ経由でClaude APIによる採点を行う。
 * API キーはLambdaの環境変数（ANTHROPIC_API_KEY）に設定すること。
 */
export async function scoreAnswer(params: {
  question: string
  scoringCriteria: string
  answer: string
}): Promise<ScoreResult> {
  if (!BASE_URL) throw new Error('API not configured')
  const res = await fetch(`${BASE_URL}/ai/score`, {
    method: 'POST',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'omit',
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    if (res.status === 401) {
      forceLogout()
      throw new Error('unauthorized')
    }
    if (res.status === 503) {
      throw new Error('AIが混雑しています。少し待ってから再試行してください。')
    }
    const text = await res.text().catch(() => '')
    throw new Error(`score API error ${res.status}: ${text}`)
  }
  return (await res.json()) as ScoreResult
}

/**
 * 3段階採点（rating: pass/partial/fail）。
 * Lambda側は後方互換で pass/feedback も返すが、こちらでは rating/comment/advice を使う。
 */
export async function scoreAnswerV2(params: {
  question: string
  scoringCriteria: string
  answer: string
}): Promise<ScoreResultV2> {
  if (!BASE_URL) throw new Error('API not configured')
  const res = await fetch(`${BASE_URL}/ai/score`, {
    method: 'POST',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'omit',
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    if (res.status === 401) {
      forceLogout()
      throw new Error('unauthorized')
    }
    if (res.status === 503) {
      throw new Error('AIが混雑しています。少し待ってから再試行してください。')
    }
    const text = await res.text().catch(() => '')
    throw new Error(`score API error ${res.status}: ${text}`)
  }
  const data = await res.json()
  return {
    rating: data.rating ?? (data.pass ? 'pass' : 'fail'),
    comment: data.comment ?? data.feedback ?? '',
    advice: data.advice ?? '',
  }
}

/** 指定受講生の進捗をサーバーから取得（受講生画面用）。なければ null。 */
export async function fetchMyProgress(traineeId: string): Promise<TraineeProgressSnapshot | null> {
  if (!BASE_URL) return null
  const id = traineeId.trim().toLowerCase()
  if (!id) return null
  const all = await fetchProgressFromApi()
  const me = all.find((t) => (t.traineeId || '').trim().toLowerCase() === id)
  if (!me) return null
  const pins = Array.isArray(me.pins) ? me.pins : []
  // introStep を確実に数値型へ変換（DynamoDB Number型が文字列で返るケースに対応）
  const rawIntroStep = (me as Record<string, unknown>).introStep
  const introStep = rawIntroStep === null || rawIntroStep === undefined || rawIntroStep === ''
    ? 0
    : Number(rawIntroStep)
  console.log('[Sync] fetchMyProgress 取得:', {
    traineeId: id,
    pinsCount: pins.length,
    rawIntroStep,
    rawIntroStepType: typeof rawIntroStep,
    normalizedIntroStep: introStep,
  })
  return { ...me, pins, introStep: Number.isFinite(introStep) ? introStep : 0 }
}
