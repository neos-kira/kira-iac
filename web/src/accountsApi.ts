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

export type AdminUser = {
  username: string
  role: string
  createdAt: string | null
  wbsPercent: number
  currentChapter: string
  lastActive: { label: string } | null
  lastLogin: string | null
  ec2State: 'running' | 'stopped' | 'pending' | 'stopping' | 'terminated' | null
  ec2InstanceId: string | null
  ec2PublicIp: string | null
  introConfirmed: boolean
  chapterProgress: { chapter: number; label: string; percent: number; cleared: boolean }[]
  delayedIds: string[]
  infra1Checkboxes: boolean[]
  infra1SectionDone: Record<string, boolean>
  ec2Host: string | null
  ec2Username: string | null
  keyPairName: string | null
  ec2CreatedAt: string | null
  ec2StartTime: string | null
  termsAgreedAt: string | null
  accountType: 'corporate' | 'individual'
}

export function isAccountApiAvailable(): boolean {
  return isProgressApiAvailable()
}

/** サーバーへ送るボディ: バックエンドは username / password（平文。ハッシュはサーバー側で実施）を期待 */
const LOGIN_DEBUG = true

export type LoginResult = { ok: boolean; role: string }

export async function checkAccount(username: string, password: string): Promise<LoginResult> {
  if (!BASE_URL) return { ok: false, role: 'student' }
  const name = username.trim().toLowerCase()
  if (!name || !password) return { ok: false, role: 'student' }
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
    type LoginRes = { ok?: boolean; error?: string; username?: string; token?: string; role?: string }
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
      const role = data.role || 'student'
      return { ok: true, role }
    }
    if (res.status === 401) {
      await saveSessionToken(null)
      return { ok: false, role: 'student' }
    }
    if (res.status === 404) return checkAccountAuthCheck(name, password)
    return { ok: false, role: 'student' }
  } catch (err) {
    if (LOGIN_DEBUG) console.log('[auth] 例外:', err)
    return { ok: false, role: 'student' }
  }
}

/** /auth/check のフォールバック（旧バックエンド用） */
async function checkAccountAuthCheck(username: string, password: string): Promise<LoginResult> {
  if (!BASE_URL) return { ok: false, role: 'student' }
  try {
    const res = await fetch(`${BASE_URL}/auth/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      credentials: 'omit',
    })
    if (!res.ok) return { ok: false, role: 'student' }
    const data = (await res.json()) as { ok?: boolean }
    return { ok: !!data.ok, role: 'student' }
  } catch {
    return { ok: false, role: 'student' }
  }
}

export async function resetPassword(username: string, newPassword: string): Promise<boolean> {
  if (!BASE_URL) return false
  const name = username.trim().toLowerCase()
  if (!name || !newPassword) return false
  try {
    const res = await fetch(`${BASE_URL}/admin/users/${encodeURIComponent(name)}/password`, {
      method: 'PUT',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'omit',
      body: JSON.stringify({ newPassword }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ============================================================
// Admin API（manager ロール専用）
// ============================================================

import { buildAuthHeaders } from './progressApi'

/** 全ユーザー + 進捗マージ取得（GET /admin/users） */
export async function fetchAdminUsers(): Promise<AdminUser[]> {
  if (!BASE_URL) return []
  try {
    const res = await fetch(`${BASE_URL}/admin/users?t=${Date.now()}`, {
      headers: buildAuthHeaders(),
      credentials: 'omit',
    })
    if (!res.ok) return []
    const data = (await res.json()) as { users?: AdminUser[] }
    return Array.isArray(data.users) ? data.users : []
  } catch {
    return []
  }
}

/** ユーザー作成（POST /admin/users） - roleフィールド付き */
export async function createAdminUser(username: string, password: string, role: string, accountType: 'corporate' | 'individual' = 'individual'): Promise<{ ok: boolean; error?: string }> {
  if (!BASE_URL) return { ok: false, error: 'API未設定' }
  const name = username.trim().toLowerCase()
  try {
    const res = await fetch(`${BASE_URL}/admin/users`, {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'omit',
      body: JSON.stringify({ username: name, password, role, accountType }),
    })
    const data = (await res.json()) as { ok?: boolean; error?: string; message?: string }
    if (res.status === 409 || data.error === 'username_exists' || data.error === 'already_exists') return { ok: false, error: 'そのユーザー名は既に使用されています' }
    if (res.status === 400 && data.error === 'password_too_short') return { ok: false, error: 'パスワードは8文字以上必要です' }
    if (!res.ok) return { ok: false, error: data.message || data.error || '作成に失敗しました' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'ネットワークエラー' }
  }
}

/** ユーザー削除（DELETE /admin/users/:username） */
export async function deleteAdminUser(username: string): Promise<{ ok: boolean; error?: string }> {
  if (!BASE_URL) return { ok: false, error: 'API未設定' }
  const name = username.trim().toLowerCase()
  try {
    const res = await fetch(`${BASE_URL}/admin/users/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: buildAuthHeaders(),
      credentials: 'omit',
    })
    const data = (await res.json()) as { ok?: boolean; error?: string }
    if (data.error === 'last_manager') return { ok: false, error: '最後のmanagerは削除できません' }
    if (!res.ok) return { ok: false, error: data.error || '削除に失敗しました' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'ネットワークエラー' }
  }
}

/** EC2サーバー個別停止（POST /admin/ec2/stop） */
export async function stopUserServer(instanceId: string): Promise<{ ok: boolean; error?: string }> {
  if (!BASE_URL) return { ok: false, error: 'API未設定' }
  try {
    const res = await fetch(`${BASE_URL}/admin/ec2/stop`, {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'omit',
      body: JSON.stringify({ instanceId }),
    })
    if (!res.ok) return { ok: false, error: '停止に失敗しました' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'ネットワークエラー' }
  }
}

/** 全EC2サーバー一括停止（POST /admin/ec2/stop-all） */
export async function stopAllServers(): Promise<{ ok: boolean; stoppedCount?: number; error?: string }> {
  if (!BASE_URL) return { ok: false, error: 'API未設定' }
  try {
    const res = await fetch(`${BASE_URL}/admin/ec2/stop-all`, {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'omit',
      body: JSON.stringify({}),
    })
    if (!res.ok) return { ok: false, error: '停止に失敗しました' }
    const data = (await res.json()) as { ok?: boolean; stoppedCount?: number }
    return { ok: true, stoppedCount: data.stoppedCount ?? 0 }
  } catch {
    return { ok: false, error: 'ネットワークエラー' }
  }
}

