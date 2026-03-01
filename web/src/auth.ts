/** ログイン済みかどうか（ログイン画面をスキップするか） */
export const LOGIN_FLAG_KEY = 'kira-user-logged-in'

export function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(LOGIN_FLAG_KEY) === 'true'
}

export function setLoggedIn(): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LOGIN_FLAG_KEY, 'true')
}
