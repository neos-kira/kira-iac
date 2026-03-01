/** はじめに確認済みでインフラ基礎課題をアンロックするフラグ（localStorage） */
const INTRO_CONFIRMED_KEY = 'isProfessionalStandardsConfirmed'
const LEGACY_KEY = 'kira-intro-confirmed'

export function getIntroConfirmed(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.localStorage.getItem(INTRO_CONFIRMED_KEY) === 'true' ||
    window.localStorage.getItem(LEGACY_KEY) === 'true'
  )
}

export function setIntroConfirmed(): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(INTRO_CONFIRMED_KEY, 'true')
}
