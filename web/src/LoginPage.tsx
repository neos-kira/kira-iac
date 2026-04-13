import { useEffect, useState, useRef } from 'react'
import { NeOSLogo } from './components/NeOSLogo'
import { setLoggedIn, isLoggedIn } from './auth'
import { addTrainee } from './traineeProgressStorage'
import { isJTerada, J_TERADA_PASSWORD } from './specialUsers'
import { checkAccount, isAccountApiAvailable, resetPassword } from './accountsApi'
import { Eye, EyeOff } from 'lucide-react'
import { safeSetItem, safeSessionRemoveItem, setCookieValue } from './utils/storage'

const USER_DISPLAY_NAME_KEY = 'kira-user-display-name'

// デバッグ用：コンポーネントのマウント回数を追跡
let mountCount = 0

// グローバル変数で入力値を保持（コンポーネント再マウント対策）
const globalInputValues = {
  username: '',
  password: '',
}

export function LoginPage() {
  // マウント追跡
  const instanceId = useRef(++mountCount)
  console.log(`[LoginPage] render, instance=${instanceId.current}, globalUsername="${globalInputValues.username}"`)

  // DOM ref で入力値を管理（React state に依存しない）
  const usernameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const resetUsernameRef = useRef<HTMLInputElement>(null)
  const resetNewPasswordRef = useRef<HTMLInputElement>(null)
  const resetConfirmPasswordRef = useRef<HTMLInputElement>(null)

  // マウント時にグローバル変数から値を復元
  useEffect(() => {
    if (usernameRef.current && globalInputValues.username) {
      usernameRef.current.value = globalInputValues.username
      console.log(`[LoginPage] Restored username from global: "${globalInputValues.username}"`)
    }
    if (passwordRef.current && globalInputValues.password) {
      passwordRef.current.value = globalInputValues.password
      console.log(`[LoginPage] Restored password from global: ${globalInputValues.password.length} chars`)
    }
  }, [])

  const [loginError, setLoginError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // パスワードリセット用state
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  // ボタンdisabled判定用（入力の有無）
  const [hasUsername, setHasUsername] = useState(false)
  const [hasPassword, setHasPassword] = useState(false)
  const [hasResetFields, setHasResetFields] = useState(false)

  useEffect(() => {
    console.log(`[LoginPage] useEffect mount, instance=${instanceId.current}`)
    document.title = 'NICプラットフォーム'
    return () => {
      console.log(`[LoginPage] useEffect cleanup (unmount), instance=${instanceId.current}`)
    }
  }, [])

  // 入力変更時にdisabled判定用のstateを更新 + グローバル変数にも保存
  const handleUsernameChange = () => {
    const val = usernameRef.current?.value || ''
    globalInputValues.username = val
    setHasUsername(val.trim().length > 0)
  }
  const handlePasswordChange = () => {
    const val = passwordRef.current?.value || ''
    globalInputValues.password = val
    setHasPassword(val.length > 0)
  }
  const handleResetFieldsChange = () => {
    const u = resetUsernameRef.current?.value || ''
    const p = resetNewPasswordRef.current?.value || ''
    const c = resetConfirmPasswordRef.current?.value || ''
    setHasResetFields(u.trim().length > 0 && p.length > 0 && c.length > 0)
  }

  async function handleLogin() {
    // DOM から直接値を取得、なければグローバル変数からフォールバック
    const refUsername = usernameRef.current?.value || ''
    const refPassword = passwordRef.current?.value || ''
    const name = (refUsername || globalInputValues.username).trim()
    const pass = refPassword || globalInputValues.password

    console.log(`[LoginPage] handleLogin called, instance=${instanceId.current}`)
    console.log(`[LoginPage] refUsername="${refUsername}", globalUsername="${globalInputValues.username}", final="${name}"`)
    console.log(`[LoginPage] refPassword=${refPassword.length}chars, globalPassword=${globalInputValues.password.length}chars, final=${pass.length}chars`)
    console.log(`[LoginPage] usernameRef.current exists:`, !!usernameRef.current)
    console.log(`[LoginPage] passwordRef.current exists:`, !!passwordRef.current)

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

      const ok = await checkAccount(normalized, pass)
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
      // iOS Safari 等での localStorage / Cookie 書き込み直後の遷移問題を避けるため、少し待機する
      await new Promise((resolve) => setTimeout(resolve, 100))

      // ストレージ書き込み成功を確認
      if (!isLoggedIn()) {
        // Private mode等でストレージが使えない場合、ページリロードで再試行
        const url = new URL(window.location.href)
        if (url.searchParams.get('loginRetry')) {
          setLoginError('ログイン処理に失敗しました。ブラウザを再起動するか、通常モードでお試しください。')
          return
        }
        console.warn('[Login] ストレージ書き込み確認失敗、リロードで再試行')
        url.searchParams.set('loginRetry', '1')
        window.location.href = url.toString()
        return
      }

      didNavigate = true
      // ログイン成功時にグローバル変数をクリア
      globalInputValues.username = ''
      globalInputValues.password = ''
      const base =
        (window.location.origin + window.location.pathname + (window.location.search || '')).replace(/\/$/, '') ||
        window.location.origin
      window.location.href = base + '#/'
    } finally {
      if (!didNavigate) setIsLoggingIn(false)
    }
  }

  async function handleReset() {
    const name = (resetUsernameRef.current?.value || '').trim().toLowerCase()
    const newPass = resetNewPasswordRef.current?.value || ''
    const confirmPass = resetConfirmPasswordRef.current?.value || ''

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
        if (resetUsernameRef.current) resetUsernameRef.current.value = ''
        if (resetNewPasswordRef.current) resetNewPasswordRef.current.value = ''
        if (resetConfirmPasswordRef.current) resetConfirmPasswordRef.current.value = ''
        setHasResetFields(false)
      } else {
        setResetError('リセットに失敗しました。ユーザー名を確認してください。')
      }
    } finally {
      setIsResetting(false)
    }
  }

  const needsPassword = isJTerada((usernameRef.current?.value || '').trim())
  const canSubmit = !isLoggingIn && hasUsername && (!needsPassword || hasPassword)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void handleLogin()
    }
  }
  const canReset = !isResetting && hasResetFields

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
                ref={usernameRef}
                id="login-username"
                type="text"
                onChange={handleUsernameChange}
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
                  ref={passwordRef}
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  onChange={handlePasswordChange}
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
                ref={resetUsernameRef}
                id="reset-username"
                type="text"
                onChange={handleResetFieldsChange}
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
                  ref={resetNewPasswordRef}
                  id="reset-new-password"
                  type={showResetPassword ? 'text' : 'password'}
                  onChange={handleResetFieldsChange}
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
                  ref={resetConfirmPasswordRef}
                  id="reset-confirm-password"
                  type={showResetConfirmPassword ? 'text' : 'password'}
                  onChange={handleResetFieldsChange}
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
