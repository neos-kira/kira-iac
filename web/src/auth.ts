import { safeGetItem, safeSetItem, getCookieValue, setCookieValue } from './utils/storage'

/** ログイン済みかどうか（ログイン画面をスキップするか） */
export const LOGIN_FLAG_KEY = 'kira-user-logged-in'

/** 表示名（ログイン時のユーザー名。進捗のユーザー別キーに使用） */
export const USER_DISPLAY_NAME_KEY = 'kira-user-display-name'

/** ロール（student / manager） */
export const USER_ROLE_KEY = 'kira-user-role'

const LOGIN_COOKIE_KEY = 'kira-user-logged-in'

/**
 * ログイン済み判定（安全なストレージアクセス）
 * シークレットモードでも安定して動作する
 */
export function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false
  const storageLoggedIn = safeGetItem(LOGIN_FLAG_KEY) === 'true'
  const cookieLoggedIn = getCookieValue(LOGIN_COOKIE_KEY) === 'true'
  return storageLoggedIn || cookieLoggedIn
}

/**
 * 現在の表示名を取得（安全なストレージアクセス）
 * シークレットモードでも安定して動作する
 */
export function getCurrentDisplayName(): string {
  if (typeof window === 'undefined') return ''
  const storageName = (safeGetItem(USER_DISPLAY_NAME_KEY) || '').trim()
  if (storageName) return storageName
  const cookieName = (getCookieValue(USER_DISPLAY_NAME_KEY) || '').trim()
  return cookieName
}

/**
 * ログイン済み状態を設定（安全なストレージアクセス）
 * シークレットモードでも安定して動作する
 */
export function setLoggedIn(): void {
  if (typeof window === 'undefined') return
  safeSetItem(LOGIN_FLAG_KEY, 'true')
  setCookieValue(LOGIN_COOKIE_KEY, 'true')
}

/** 現在ログイン中のユーザー名（進捗キー用に小文字統一。正しくは kira-test 等） */
export function getCurrentUsername(): string {
  return getCurrentDisplayName().trim().toLowerCase()
}

/** 現在のロールを取得（student / manager） */
export function getCurrentRole(): string {
  if (typeof window === 'undefined') return 'student'
  const v = safeGetItem(USER_ROLE_KEY) || ''
  if (v) return v
  return 'student'
}

/** ロールを保存 */
export function setCurrentRole(role: string): void {
  if (typeof window === 'undefined') return
  safeSetItem(USER_ROLE_KEY, role)
  setCookieValue(USER_ROLE_KEY, role)
}

/** 本名（displayName）用ストレージキー */
export const USER_REAL_NAME_KEY = 'kira-real-name'

/** DynamoDBに保存された本名を取得 */
export function getUserRealName(): string {
  if (typeof window === 'undefined') return ''
  return (safeGetItem(USER_REAL_NAME_KEY) || '').trim()
}

/** 本名をlocalStorageに保存 */
export function setUserRealName(name: string): void {
  if (typeof window === 'undefined') return
  safeSetItem(USER_REAL_NAME_KEY, name)
}
