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

// ─── 共通スタイル ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  height: 48,
  border: '1.5px solid #E2E8F0',
  borderRadius: 12,
  padding: '0 16px',
  width: '100%',
  background: 'white',
  color: '#0F172A',
  fontSize: 15,
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  boxSizing: 'border-box',
}

const inputWithIconStyle: React.CSSProperties = {
  ...inputStyle,
  padding: '0 48px 0 16px',
}

function onInputFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = '#2563EB'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.10)'
}

function onInputBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = '#E2E8F0'
  e.currentTarget.style.boxShadow = 'none'
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 14,
  fontWeight: 500,
  color: '#374151',
  marginBottom: 6,
  letterSpacing: '0.01em',
}

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
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 md:p-6"
      style={{ background: '#F8FAFC' }}
    >
      <div
        className="w-full"
        style={{
          maxWidth: 420,
          background: 'white',
          borderRadius: 16,
          padding: '40px 40px 36px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 20px rgba(0,0,0,0.07)',
        }}
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <NeOSLogo height={136} noLink={true} />
        </div>

        {mode === 'login' ? (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Username */}
              <div>
                <label htmlFor="login-username" style={labelStyle}>ユーザー名</label>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={handleUsernameChange}
                  onKeyDown={handleKeyDown}
                  placeholder="ユーザー名を入力"
                  disabled={isLoggingIn}
                  style={{ ...inputStyle, background: isLoggingIn ? '#F8FAFC' : 'white' }}
                  onFocus={onInputFocus}
                  onBlur={onInputBlur}
                  autoComplete="username"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="login-password" style={labelStyle}>パスワード</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={handlePasswordChange}
                    onKeyDown={handleKeyDown}
                    placeholder="パスワードを入力"
                    disabled={isLoggingIn}
                    style={{ ...inputWithIconStyle, background: isLoggingIn ? '#F8FAFC' : 'white' }}
                    onFocus={onInputFocus}
                    onBlur={onInputBlur}
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
                    style={{ position: 'absolute', top: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', paddingRight: 14, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer' }}
                    aria-label={showPassword ? 'パスワードを非表示' : 'パスワードを表示'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {loginError && (
                <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }} role="alert">
                  {loginError}
                </p>
              )}

              {/* Login button */}
              <button
                type="button"
                onClick={() => void handleLogin()}
                disabled={!canSubmit || isLoggingIn}
                style={{
                  height: 48,
                  borderRadius: 12,
                  background: canSubmit ? '#2563EB' : '#93C5FD',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: 15,
                  letterSpacing: '0.01em',
                  border: 'none',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  width: '100%',
                  transition: 'background 0.15s, transform 0.1s',
                  marginTop: 4,
                }}
                onMouseEnter={e => { if (canSubmit) e.currentTarget.style.background = '#1D4ED8' }}
                onMouseLeave={e => { e.currentTarget.style.background = canSubmit ? '#2563EB' : '#93C5FD' }}
                onMouseDown={e => { if (canSubmit) e.currentTarget.style.transform = 'scale(0.99)' }}
                onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                {isLoggingIn ? 'ログイン中...' : 'ログイン'}
              </button>

              {/* Reset link */}
              <p style={{ textAlign: 'center', margin: '4px 0 0' }}>
                <button
                  type="button"
                  onClick={() => { setMode('reset'); setLoginError('') }}
                  style={{ fontSize: 13, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#2563EB'; e.currentTarget.style.textDecoration = 'underline' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.textDecoration = 'none' }}
                >
                  パスワードを忘れた方はこちら
                </button>
              </p>
            </div>
          </div>
        ) : (
          <div>
            {/* Title */}
            <h1 style={{ fontSize: 19, fontWeight: 600, color: '#0F172A', marginBottom: 24, textAlign: 'center', letterSpacing: '-0.01em' }}>
              パスワードのリセット
            </h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Username */}
              <div>
                <label htmlFor="reset-username" style={labelStyle}>ユーザー名</label>
                <input
                  id="reset-username"
                  type="text"
                  value={resetUsername}
                  onChange={(e) => setResetUsername(e.target.value)}
                  placeholder="ユーザー名を入力"
                  style={inputStyle}
                  onFocus={onInputFocus}
                  onBlur={onInputBlur}
                  autoComplete="username"
                />
              </div>

              {/* New password */}
              <div>
                <label htmlFor="reset-new-password" style={labelStyle}>新しいパスワード</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="reset-new-password"
                    type={showResetPassword ? 'text' : 'password'}
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="新しいパスワードを入力"
                    style={inputWithIconStyle}
                    onFocus={onInputFocus}
                    onBlur={onInputBlur}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword((v) => !v)}
                    style={{ position: 'absolute', top: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', paddingRight: 14, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer' }}
                    aria-label={showResetPassword ? 'パスワードを非表示' : 'パスワードを表示'}
                  >
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label htmlFor="reset-confirm-password" style={labelStyle}>新しいパスワード（確認）</label>
                <div style={{ position: 'relative' }}>
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
                    style={inputWithIconStyle}
                    onFocus={onInputFocus}
                    onBlur={onInputBlur}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetConfirmPassword((v) => !v)}
                    style={{ position: 'absolute', top: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', paddingRight: 14, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer' }}
                    aria-label={showResetConfirmPassword ? 'パスワードを非表示' : 'パスワードを表示'}
                  >
                    {showResetConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Messages */}
              {resetError && (
                <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }} role="alert">
                  {resetError}
                </p>
              )}
              {resetSuccess && (
                <p style={{ fontSize: 13, color: '#16A34A', margin: 0 }} role="status">
                  {resetSuccess}
                </p>
              )}

              {/* Reset button */}
              <button
                type="button"
                onClick={() => void handleReset()}
                disabled={!canReset}
                style={{
                  height: 48,
                  borderRadius: 12,
                  background: canReset ? '#2563EB' : '#93C5FD',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: 15,
                  letterSpacing: '0.01em',
                  border: 'none',
                  cursor: canReset ? 'pointer' : 'not-allowed',
                  width: '100%',
                  transition: 'background 0.15s',
                  marginTop: 4,
                }}
                onMouseEnter={e => { if (canReset) e.currentTarget.style.background = '#1D4ED8' }}
                onMouseLeave={e => { e.currentTarget.style.background = canReset ? '#2563EB' : '#93C5FD' }}
              >
                {isResetting ? 'リセット中...' : 'リセットする'}
              </button>

              {/* Back to login */}
              <p style={{ textAlign: 'center', margin: '4px 0 0' }}>
                <button
                  type="button"
                  onClick={() => { setMode('login'); setResetError(''); setResetSuccess('') }}
                  style={{ fontSize: 13, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#2563EB'; e.currentTarget.style.textDecoration = 'underline' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.textDecoration = 'none' }}
                >
                  ログインに戻る
                </button>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
