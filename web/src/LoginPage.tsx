import { useEffect, useState, useRef } from 'react'
import { useSafeNavigate } from './hooks/useSafeNavigate'
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
  const navigate = useSafeNavigate()
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
      addTrainee(name)

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
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 50%, #e0f2fe 100%)' }}>
      <div className="w-full bg-white" style={{ maxWidth: 440, borderRadius: 16, padding: '56px', border: '1px solid rgba(14,165,233,0.15)' }}>
          <div className="flex justify-center mb-10">
            <NeOSLogo height={160} noLink={true} />
          </div>

        {mode === 'login' ? (
          <div className="space-y-6">
            <div>
              <label htmlFor="login-username" className="block font-medium mb-2 text-body md:text-body-pc" style={{ letterSpacing: '0.01em', color: '#334155' }}>
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
                className="w-full bg-white text-slate-900 placeholder:text-slate-400 disabled:bg-slate-50 outline-none transition-all text-input"
                style={{ height: 52, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0 16px' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#7dd3fc'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(125,211,252,0.1)' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}
                autoComplete="username"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block font-medium mb-2 text-body md:text-body-pc" style={{ letterSpacing: '0.01em', color: '#334155' }}>
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
                  className="w-full bg-white text-slate-900 placeholder:text-slate-400 disabled:bg-slate-50 outline-none transition-all text-input"
                  style={{ height: 52, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0 48px 0 16px' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#7dd3fc'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(125,211,252,0.1)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}
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
                  className="absolute inset-y-0 right-0 flex items-center pr-4 transition-colors"
                  style={{ color: '#64748b' }}
                  aria-label={showPassword ? 'パスワードを非表示' : 'パスワードを表示'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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
              className="w-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              style={{ height: 52, borderRadius: 10, background: '#7dd3fc', letterSpacing: '0.02em', border: 'none', cursor: 'pointer', color: '#0f172a' }}
              onMouseEnter={e => { if (canSubmit) { e.currentTarget.style.background = '#38bdf8'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
              onMouseLeave={e => { e.currentTarget.style.background = '#7dd3fc'; e.currentTarget.style.transform = 'translateY(0)' }}
              onMouseDown={e => { e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {isLoggingIn ? 'ログイン中...' : 'ログイン'}
            </button>
            <p className="text-center">
              <button
                type="button"
                onClick={() => { setMode('reset'); setLoginError('') }}
                className="text-button md:text-button-pc transition-all duration-200"
                style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#7dd3fc'; e.currentTarget.style.textDecoration = 'underline' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.textDecoration = 'none' }}
              >
                パスワードを忘れた方はこちら
              </button>
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <h2 className="text-sm font-semibold text-slate-700">パスワードのリセット</h2>
            <div>
              <label htmlFor="reset-username" className="block font-medium mb-2 text-body md:text-body-pc" style={{ letterSpacing: '0.01em', color: '#334155' }}>
                ユーザー名
              </label>
              <input
                id="reset-username"
                type="text"
                value={resetUsername}
                onChange={(e) => setResetUsername(e.target.value)}
                placeholder="ユーザー名を入力"
                className="w-full bg-white text-slate-800 placeholder:text-slate-400 outline-none transition-all text-input"
                style={{ height: 52, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0 16px' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#7dd3fc'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(125,211,252,0.1)' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="reset-new-password" className="block font-medium mb-2 text-body md:text-body-pc" style={{ letterSpacing: '0.01em', color: '#334155' }}>
                新しいパスワード
              </label>
              <div className="relative">
                <input
                  id="reset-new-password"
                  type={showResetPassword ? 'text' : 'password'}
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="新しいパスワードを入力"
                  className="w-full bg-white text-slate-800 placeholder:text-slate-400 outline-none transition-all text-input"
                  style={{ height: 52, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0 48px 0 16px' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#7dd3fc'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(125,211,252,0.1)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 transition-colors"
                  style={{ color: '#64748b' }}
                  aria-label={showResetPassword ? 'パスワードを非表示' : 'パスワードを表示'}
                >
                  {showResetPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="reset-confirm-password" className="block font-medium mb-2 text-body md:text-body-pc" style={{ letterSpacing: '0.01em', color: '#334155' }}>
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
                  className="w-full bg-white text-slate-800 placeholder:text-slate-400 outline-none transition-all text-input"
                  style={{ height: 52, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0 48px 0 16px' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#7dd3fc'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(125,211,252,0.1)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowResetConfirmPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 transition-colors"
                  style={{ color: '#64748b' }}
                  aria-label={showResetConfirmPassword ? 'パスワードを非表示' : 'パスワードを表示'}
                >
                  {showResetConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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
              className="w-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              style={{ height: 52, borderRadius: 10, background: '#7dd3fc', letterSpacing: '0.02em', border: 'none', cursor: 'pointer', color: '#0f172a' }}
              onMouseEnter={e => { if (canReset) { e.currentTarget.style.background = '#38bdf8'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
              onMouseLeave={e => { e.currentTarget.style.background = '#7dd3fc'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {isResetting ? 'リセット中...' : 'リセットする'}
            </button>
            <p className="text-center">
              <button
                type="button"
                onClick={() => { setMode('login'); setResetError(''); setResetSuccess('') }}
                className="text-button md:text-button-pc transition-all duration-200"
                style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#7dd3fc'; e.currentTarget.style.textDecoration = 'underline' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.textDecoration = 'none' }}
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
