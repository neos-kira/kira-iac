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
  return name ? `${INTRO_CONFIRMED_KEY}_${name}` : INTRO_CONFIRMED_KEY
}

function introConfirmedAtKey(): string {
  const name = getCurrentUsername()
  return name ? `${INTRO_CONFIRMED_AT_KEY}_${name}` : INTRO_CONFIRMED_AT_KEY
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
