/**
 * 安全なストレージアクセスユーティリティ
 * シークレットモードやプライベートブラウズでも
 * エラーを投げずに動作する。
 */

/** localStorage から安全に値を取得。エラー時は null を返す */
export function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/** localStorage に安全に値を保存。エラー時は false を返す */
export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/** localStorage から安全に値を削除。エラー時は false を返す */
export function safeRemoveItem(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

/** sessionStorage から安全に値を取得。エラー時は null を返す */
export function safeSessionGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

/** sessionStorage に安全に値を保存。エラー時は false を返す */
export function safeSessionSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.sessionStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/** sessionStorage から安全に値を削除。エラー時は false を返す */
export function safeSessionRemoveItem(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.sessionStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

/** Cookie値を取得 */
export function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

/** Cookie値を設定 */
export function setCookieValue(name: string, value: string, maxAgeSeconds = 86400): void {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`
}

/** Cookie値を削除 */
export function clearCookieValue(name: string): void {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`
}
