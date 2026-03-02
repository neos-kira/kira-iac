/** ログイン済みかどうか（ログイン画面をスキップするか） */
export const LOGIN_FLAG_KEY = 'kira-user-logged-in'

/** 表示名（ログイン時のユーザー名。進捗のユーザー別キーに使用） */
export const USER_DISPLAY_NAME_KEY = 'kira-user-display-name'

export function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(LOGIN_FLAG_KEY) === 'true'
}

export function setLoggedIn(): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LOGIN_FLAG_KEY, 'true')
}

/** 現在ログイン中のユーザー名（進捗キー用に小文字統一。正しくは kira-test 等） */
export function getCurrentUsername(): string {
  if (typeof window === 'undefined') return ''
  return (window.localStorage.getItem(USER_DISPLAY_NAME_KEY) || '').trim().toLowerCase()
}
