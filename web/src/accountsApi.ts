import { isProgressApiAvailable } from './progressApi'
import { safeSetItem, safeRemoveItem, setCookieValue, clearCookieValue } from './utils/storage'

const DEFAULT_API_URL = 'https://wfhfqq0tjh.execute-api.ap-northeast-1.amazonaws.com'
const BASE_URL = (
  typeof import.meta.env !== 'undefined' && import.meta.env.VITE_PROGRESS_API_URL
    ? (import.meta.env.VITE_PROGRESS_API_URL as string)
    : DEFAULT_API_URL
).replace(/\/$/, '')

const SESSION_TOKEN_KEY = 'kira-session-token'

async function saveSessionToken(token: string | null) {
  if (typeof window === 'undefined') return
  if (token) {
    safeSetItem(SESSION_TOKEN_KEY, token)
    setCookieValue(SESSION_TOKEN_KEY, token)
  } else {
    safeRemoveItem(SESSION_TOKEN_KEY)
    clearCookieValue(SESSION_TOKEN_KEY)
  }
  await Promise.resolve()
}

export type Account = {
  username: string
  createdAt?: string
}

export function isAccountApiAvailable(): boolean {
  return isProgressApiAvailable()
}

export async function createAccount(username: string, password: string): Promise<boolean> {
  if (!BASE_URL) return false
  const name = username.trim().toLowerCase()
  if (!name || name === 'admin') return false
  if (!password) return false
  try {
    const res = await fetch(`${BASE_URL}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: name, password }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function fetchAccounts(): Promise<Account[]> {
  if (!BASE_URL) return []
  try {
    const res = await fetch(`${BASE_URL}/accounts`)
    if (!res.ok) return []
    const data = (await res.json()) as { accounts?: Account[] }
    if (!Array.isArray(data.accounts)) return []
    return data.accounts
      .map((a) => ({
        username: (a.username || '').trim().toLowerCase(),
        createdAt: a.createdAt,
      }))
      .filter((a) => a.username && a.username !== 'admin')
  } catch {
    return []
  }
}

/** サーバーへ送るボディ: バックエンドは username / password（平文。ハッシュはサーバー側で実施）を期待 */
const LOGIN_DEBUG = true

export async function checkAccount(username: string, password: string): Promise<boolean> {
  if (!BASE_URL) return false
  const name = username.trim().toLowerCase()
  if (!name || !password) return false
  const body = { username: name, password }
  if (LOGIN_DEBUG) {
    console.log('[auth] 送信ボディ:', { username: name, password: password ? '***' : '' })
  }
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'omit',
    })
    const text = await res.text()
    type LoginRes = { ok?: boolean; error?: string; username?: string; token?: string }
    let data: LoginRes = {}
    try {
      data = text ? (JSON.parse(text) as LoginRes) : {}
    } catch {
      if (LOGIN_DEBUG) console.log('[auth] レスポンスパース失敗:', text?.slice(0, 200))
    }
    if (LOGIN_DEBUG) {
      console.log('[auth] レスポンス:', { status: res.status, body: data })
    }
    if (res.ok && (data.ok === true || 'username' in data)) {
      if (typeof data.token === 'string' && data.token) await saveSessionToken(data.token)
      return true
    }
    if (res.status === 401) {
      await saveSessionToken(null)
      return false
    }
    if (res.status === 404) return checkAccountAuthCheck(name, password)
    return false
  } catch (err) {
    if (LOGIN_DEBUG) console.log('[auth] 例外:', err)
    return false
  }
}

/** /auth/check のフォールバック（旧バックエンド用） */
async function checkAccountAuthCheck(username: string, password: string): Promise<boolean> {
  if (!BASE_URL) return false
  try {
    const res = await fetch(`${BASE_URL}/auth/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      credentials: 'omit',
    })
    if (!res.ok) return false
    const data = (await res.json()) as { ok?: boolean }
    return !!data.ok
  } catch {
    return false
  }
}

export async function resetPassword(username: string, newPassword: string): Promise<boolean> {
  if (!BASE_URL) return false
  const name = username.trim().toLowerCase()
  if (!name || name === 'admin' || !newPassword) return false
  try {
    const res = await fetch(`${BASE_URL}/accounts/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: name, newPassword }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function deleteAccount(username: string): Promise<boolean> {
  if (!BASE_URL) return false
  const name = username.trim().toLowerCase()
  if (!name || name === 'admin') return false
  try {
    const res = await fetch(`${BASE_URL}/accounts`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: name }),
    })
    return res.ok
  } catch {
    return false
  }
}


