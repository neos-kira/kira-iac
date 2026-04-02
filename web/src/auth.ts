/** ログイン済みかどうか（ログイン画面をスキップするか） */
export const LOGIN_FLAG_KEY = 'kira-user-logged-in'

/** 表示名（ログイン時のユーザー名。進捗のユーザー別キーに使用） */
export const USER_DISPLAY_NAME_KEY = 'kira-user-display-name'

const LOGIN_COOKIE_KEY = 'kira-user-logged-in'

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function setCookieValue(name: string, value: string, maxAgeSeconds = 86400): void {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`
}

export function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false
  const storageLoggedIn = window.localStorage.getItem(LOGIN_FLAG_KEY) === 'true'
  const cookieLoggedIn = getCookieValue(LOGIN_COOKIE_KEY) === 'true'
  return storageLoggedIn || cookieLoggedIn
}

export function getCurrentDisplayName(): string {
  if (typeof window === 'undefined') return ''
  const storageName = (window.localStorage.getItem(USER_DISPLAY_NAME_KEY) || '').trim()
  if (storageName) return storageName
  const cookieName = (getCookieValue(USER_DISPLAY_NAME_KEY) || '').trim()
  return cookieName
}

export function setLoggedIn(): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LOGIN_FLAG_KEY, 'true')
  setCookieValue(LOGIN_COOKIE_KEY, 'true')
}

/** 現在ログイン中のユーザー名（進捗キー用に小文字統一。正しくは kira-test 等） */
export function getCurrentUsername(): string {
  return getCurrentDisplayName().trim().toLowerCase()
}
