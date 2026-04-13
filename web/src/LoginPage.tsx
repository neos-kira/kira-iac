import { useEffect, useState, useCallback } from 'react'
import { NeOSLogo } from './components/NeOSLogo'
import { setLoggedIn } from './auth'
import { addTrainee } from './traineeProgressStorage'
import { isJTerada, J_TERADA_PASSWORD } from './specialUsers'
import { checkAccount, isAccountApiAvailable, resetPassword } from './accountsApi'
import { Eye, EyeOff } from 'lucide-react'
import { safeSetItem, safeSessionRemoveItem, setCookieValue } from './utils/storage'

const USER_DISPLAY_NAME_KEY = 'kira-user-display-name'

// グローバルrefで入力値を保持（コンポーネント再マウント対策）
const globalInputState = {
  username: '',
  password: '',
  resetUsername: '',
  resetNewPassword: '',
  resetConfirmPassword: '',
}

export function LoginPage() {
  // 初期値としてglobalInputStateから復元
  const [username, setUsernameState] = useState(globalInputState.username)
  const [password, setPasswordState] = useState(globalInputState.password)
  const [loginError, setLoginError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // パスワードリセット用state
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [resetUsername, setResetUsernameState] = useState(globalInputState.resetUsername)
  const [resetNewPassword, setResetNewPasswordState] = useState(globalInputState.resetNewPassword)
  const [resetConfirmPassword, setResetConfirmPasswordState] = useState(globalInputState.resetConfirmPassword)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  // 入力値変更時にグローバルステートも更新
  const setUsername = useCallback((value: string) => {
    globalInputState.username = value
    setUsernameState(value)
  }, [])
  const setPassword = useCallback((value: string) => {
    globalInputState.password = value
    setPasswordState(value)
  }, [])
  const setResetUsername = useCallback((value: string) => {
    globalInputState.resetUsername = value
    setResetUsernameState(value)
  }, [])
  const setResetNewPassword = useCallback((value: string) => {
    globalInputState.resetNewPassword = value
    setResetNewPasswordState(value)
  }, [])
  const setResetConfirmPassword = useCallback((value: string) => {
    globalInputState.resetConfirmPassword = value
    setResetConfirmPasswordState(value)
  }, [])

  // ログイン成功時にグローバルステートをクリア
  const clearGlobalInputState = useCallback(() => {
    globalInputState.username = ''
    globalInputState.password = ''
    globalInputState.resetUsername = ''
    globalInputState.resetNewPassword = ''
    globalInputState.resetConfirmPassword = ''
  }, [])

  useEffect(() => {
    document.title = 'NICプラットフォーム'
  }, [])

  async function handleLogin() {
    setLoginError('')
    setIsLoggingIn(true)
    let didNavigate = false
    const name = username.trim()
    try {
      if (!name) return
      if (isJTerada(name) && password !== J_TERADA_PASSWORD) {
        setLoginError('ユーザー名かパスワードが間違っています。')
        return
      }
      const normalized = name.toLowerCase()

      if (!isAccountApiAvailable()) {
        setLoginError('アカウントAPIが未設定のためログインできません。管理者に連絡してください。')
        return
      }

      const ok = await checkAccount(normalized, password)
      if (!ok) {
        setLoginError('ユーザー名かパスワードが間違っています。')
        return
      }

      // 安全なストレージ操作（シークレットモード対応）
      safeSetItem(USER_DISPLAY_NAME_KEY, normalized)
      setCookieValue(USER_DISPLAY_NAME_KEY, normalized)
      setLoggedIn()
      safeSessionRemoveItem('kira-login-reload-tried')
      if (normalized !== 'admin') {
        addTrainee(name)
      }
      // グローバルステートをクリア
      clearGlobalInputState()
      // iOS Safari 等での localStorage / Cookie 書き込み直後の遷移問題を避けるため、少し待機する
      await new Promise((resolve) => setTimeout(resolve, 100))
      didNavigate = true
      const base =
        (window.location.origin + window.location.pathname + (window.location.search || '')).replace(/\/$/, '') ||
        window.location.origin
      window.location.href = base + '#/'
    } finally {
      if (!didNavigate) setIsLoggingIn(false)
    }
  }

  async function handleReset() {
    setResetError('')
    setResetSuccess('')
    const name = resetUsername.trim().toLowerCase()
    if (!name) { setResetError('ユーザー名を入力してください。'); return }
    if (!resetNewPassword) { setResetError('新しいパスワードを入力してください。'); return }
    if (resetNewPassword !== resetConfirmPassword) { setResetError('パスワードが一致しません。'); return }
    setIsResetting(true)
    try {
      const ok = await resetPassword(name, resetNewPassword)
      if (ok) {
        setResetSuccess('パスワードをリセットしました。ログイン画面からサインインしてください。')
        setResetUsername('')
        setResetNewPassword('')
        setResetConfirmPassword('')
      } else {
        setResetError('リセットに失敗しました。ユーザー名を確認してください。')
      }
    } finally {
      setIsResetting(false)
    }
  }

  const needsPassword = isJTerada(username.trim())
  const canSubmit = !isLoggingIn && username.trim().length > 0 && (!needsPassword || password.length > 0)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleLogin()
  }
  const canReset = !isResetting && resetUsername.trim().length > 0 && resetNewPassword.length > 0 && resetConfirmPassword.length > 0

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex justify-center mb-6">
          <NeOSLogo height={128} noLink={true} />
        </div>

        {mode === 'login' ? (
          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="login-username" className="block text-sm font-medium text-slate-700 mb-1">
                ユーザー名
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="ユーザー名を入力"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                autoComplete="username"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1">
                パスワード
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="パスワードを入力"
                  className="w-full rounded-lg border border-slate-300 bg-white pr-10 pl-4 py-2.5 text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  autoComplete="current-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'パスワードを非表示' : 'パスワードを表示'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {loginError && (
              <p className="text-sm text-red-600" role="alert">
                {loginError}
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleLogin()}
              disabled={!canSubmit || isLoggingIn}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? 'ログイン中...' : 'ログイン'}
            </button>
            <p className="text-center">
              <button
                type="button"
                onClick={() => { setMode('reset'); setLoginError('') }}
                className="text-xs text-slate-400 hover:text-slate-600 underline"
              >
                パスワードを忘れた方はこちら
              </button>
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">パスワードのリセット</h2>
            <div>
              <label htmlFor="reset-username" className="block text-sm font-medium text-slate-700 mb-1">
                ユーザー名
              </label>
              <input
                id="reset-username"
                type="text"
                value={resetUsername}
                onChange={(e) => setResetUsername(e.target.value)}
                placeholder="ユーザー名を入力"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="reset-new-password" className="block text-sm font-medium text-slate-700 mb-1">
                新しいパスワード
              </label>
              <div className="relative">
                <input
                  id="reset-new-password"
                  type={showResetPassword ? 'text' : 'password'}
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="新しいパスワードを入力"
                  className="w-full rounded-lg border border-slate-300 bg-white pr-10 pl-4 py-2.5 text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showResetPassword ? 'パスワードを非表示' : 'パスワードを表示'}
                >
                  {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="reset-confirm-password" className="block text-sm font-medium text-slate-700 mb-1">
                新しいパスワード（確認）
              </label>
              <div className="relative">
                <input
                  id="reset-confirm-password"
                  type={showResetConfirmPassword ? 'text' : 'password'}
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canReset) void handleReset()
                  }}
                  placeholder="新しいパスワードを再入力"
                  className="w-full rounded-lg border border-slate-300 bg-white pr-10 pl-4 py-2.5 text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowResetConfirmPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showResetConfirmPassword ? 'パスワードを非表示' : 'パスワードを表示'}
                >
                  {showResetConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {resetError && (
              <p className="text-sm text-red-600" role="alert">
                {resetError}
              </p>
            )}
            {resetSuccess && (
              <p className="text-sm text-green-600" role="status">
                {resetSuccess}
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleReset()}
              disabled={!canReset}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResetting ? 'リセット中...' : 'リセットする'}
            </button>
            <p className="text-center">
              <button
                type="button"
                onClick={() => { setMode('login'); setResetError(''); setResetSuccess('') }}
                className="text-xs text-slate-400 hover:text-slate-600 underline"
              >
                ログインに戻る
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
