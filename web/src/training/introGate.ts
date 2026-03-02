/** はじめに確認済みでインフラ基礎課題をアンロックするフラグ（localStorage）。ユーザーごとに保持する。 */
const INTRO_CONFIRMED_KEY = 'isProfessionalStandardsConfirmed'
const INTRO_CONFIRMED_AT_KEY = 'kira-intro-confirmed-at'
const LEGACY_KEY = 'kira-intro-confirmed'
const USER_DISPLAY_NAME_KEY = 'kira-user-display-name'

function getCurrentUsername(): string {
  if (typeof window === 'undefined') return ''
  return (window.localStorage.getItem(USER_DISPLAY_NAME_KEY) || '').trim() || ''
}

function introConfirmedKey(): string {
  const name = getCurrentUsername()
  return name ? `${INTRO_CONFIRMED_KEY}_${name.trim().toLowerCase()}` : INTRO_CONFIRMED_KEY
}

function introConfirmedAtKey(): string {
  const name = getCurrentUsername()
  return name ? `${INTRO_CONFIRMED_AT_KEY}_${name.trim().toLowerCase()}` : INTRO_CONFIRMED_AT_KEY
}

export function getIntroConfirmed(): boolean {
  if (typeof window === 'undefined') return false
  const key = introConfirmedKey()
  const legacy = window.localStorage.getItem(LEGACY_KEY) === 'true'
  const perUser = window.localStorage.getItem(key) === 'true'
  if (perUser) return true
  if (getCurrentUsername() === '' && legacy) return true
  return false
}

/** はじめにクリア日時（ISO文字列）。未クリアなら null */
export function getIntroConfirmedAt(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(introConfirmedAtKey())
}

export function setIntroConfirmed(): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(introConfirmedKey(), 'true')
  window.localStorage.setItem(introConfirmedAtKey(), new Date().toISOString())
}

/** 指定ユーザーの「はじめに」完了を保存（同一タブで表示名が変わっても正しいユーザーに紐付ける）。キーは小文字統一で表記ゆれを吸収。 */
export function setIntroConfirmedForUser(username: string): void {
  if (typeof window === 'undefined' || !username || username.toLowerCase() === 'admin') return
  const id = username.trim().toLowerCase()
  const key = `${INTRO_CONFIRMED_KEY}_${id}`
  const atKey = `${INTRO_CONFIRMED_AT_KEY}_${id}`
  window.localStorage.setItem(key, 'true')
  window.localStorage.setItem(atKey, new Date().toISOString())
}

/** 現在ログイン中のユーザーの「はじめに」完了状態をクリアする（進捗リセット用） */
export function clearIntroForCurrentUser(): void {
  if (typeof window === 'undefined') return
  const name = getCurrentUsername()
  if (!name) return
  const id = name.trim().toLowerCase()
  window.localStorage.removeItem(`${INTRO_CONFIRMED_KEY}_${id}`)
  window.localStorage.removeItem(`${INTRO_CONFIRMED_AT_KEY}_${id}`)
}

/** 指定ユーザーの「はじめに」完了有無（管理者画面のリアルタイム表示用）。レガシーキーがあれば合格とみなし per-user へ移行。キーは小文字統一。 */
export function getIntroConfirmedForUser(username: string): boolean {
  if (typeof window === 'undefined' || !username || username.toLowerCase() === 'admin') return false
  const id = username.trim().toLowerCase()
  const key = `${INTRO_CONFIRMED_KEY}_${id}`
  if (window.localStorage.getItem(key) === 'true') return true
  if (window.localStorage.getItem(LEGACY_KEY) === 'true') {
    setIntroConfirmedForUser(username)
    return true
  }
  return false
}

/** 指定ユーザーの「はじめに」クリア日時（ISO文字列）。未クリアなら null。キーは小文字統一。 */
export function getIntroConfirmedAtForUser(username: string): string | null {
  if (typeof window === 'undefined' || !username || username.toLowerCase() === 'admin') return null
  const id = username.trim().toLowerCase()
  return window.localStorage.getItem(`${INTRO_CONFIRMED_AT_KEY}_${id}`)
}
