import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { NeOSLogo } from './components/NeOSLogo'
import { setLoggedIn, setCurrentRole } from './auth'
import { useAuth } from './AuthContext'
import { addTrainee } from './traineeProgressStorage'
import { isJTerada, J_TERADA_PASSWORD } from './specialUsers'
import { checkAccount, isAccountApiAvailable, resetPassword } from './accountsApi'
import { Eye, EyeOff } from 'lucide-react'
import { safeSetItem, safeSessionRemoveItem, setCookieValue } from './utils/storage'

const USER_DISPLAY_NAME_KEY = 'kira-user-display-name'

let mountCount = 0

export function LoginPage() {
  const instanceId = useRef(++mountCount)
  const navigate = useNavigate()
  const { refreshAuth } = useAuth()
  console.log(`[LoginPage] render, instance=${instanceId.current}`)

  // 表示用のstate（controlled component）
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // パスワードリセット用
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [resetUsername, setResetUsername] = useState('')
  const [resetNewPassword, setResetNewPassword] = useState('')
  const [resetConfirmPassword, setResetConfirmPassword] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  useEffect(() => {
    console.log(`[LoginPage] useEffect mount, instance=${instanceId.current}`)
    document.title = 'NICプラットフォーム'
    return () => {
      console.log(`[LoginPage] useEffect cleanup (unmount), instance=${instanceId.current}`)
    }
  }, [])

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value)
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value)
  }

  async function handleLogin() {
    const name = username.trim()
    const pass = password

    console.log(`[LoginPage] handleLogin called, instance=${instanceId.current}`)
    console.log(`[LoginPage] username="${name}", password=${pass.length}chars`)

    setLoginError('')
    setIsLoggingIn(true)
    let didNavigate = false

    try {
      if (!name) {
        setLoginError('ユーザー名を入力してください。')
        return
      }
      if (isJTerada(name) && pass !== J_TERADA_PASSWORD) {
        setLoginError('ユーザー名かパスワードが間違っています。')
        return
      }
      const normalized = name.toLowerCase()

      if (!isAccountApiAvailable()) {
        setLoginError('アカウントAPIが未設定のためログインできません。管理者に連絡してください。')
        return
      }

      const result = await checkAccount(normalized, pass)
      if (!result.ok) {
        setLoginError('ユーザー名かパスワードが間違っています。')
        return
      }

      // ストレージに保存
      safeSetItem(USER_DISPLAY_NAME_KEY, normalized)
      setCookieValue(USER_DISPLAY_NAME_KEY, normalized)
      setLoggedIn()
      setCurrentRole(result.role)
      safeSessionRemoveItem('kira-login-reload-tried')
      if (normalized !== 'admin') {
        addTrainee(name)
      }

      // ストレージ書き込みを待機
      await new Promise((resolve) => setTimeout(resolve, 50))

      // AuthContextを更新してReactの状態を同期
      refreshAuth()

      // ロールに応じて遷移
      const destination = result.role === 'manager' ? '/admin' : '/'
      console.log('[LoginPage] Navigating to', destination)
      navigate(destination, { replace: true })
    } finally {
      if (!didNavigate) setIsLoggingIn(false)
    }
  }

  async function handleReset() {
    const name = resetUsername.trim().toLowerCase()
    const newPass = resetNewPassword
    const confirmPass = resetConfirmPassword

    setResetError('')
    setResetSuccess('')

    if (!name) { setResetError('ユーザー名を入力してください。'); return }
    if (!newPass) { setResetError('新しいパスワードを入力してください。'); return }
    if (newPass !== confirmPass) { setResetError('パスワードが一致しません。'); return }

    setIsResetting(true)
    try {
      const ok = await resetPassword(name, newPass)
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
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void handleLogin()
    }
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
                onChange={handleUsernameChange}
                onKeyDown={handleKeyDown}
                placeholder="ユーザー名を入力"
                disabled={isLoggingIn}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-100"
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
                  onChange={handlePasswordChange}
                  onKeyDown={handleKeyDown}
                  placeholder="パスワードを入力"
                  disabled={isLoggingIn}
                  className="w-full rounded-lg border border-slate-300 bg-white pr-10 pl-4 py-2.5 text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-100"
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
                    if (e.key === 'Enter' && canReset) {
                      e.preventDefault()
                      void handleReset()
                    }
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
