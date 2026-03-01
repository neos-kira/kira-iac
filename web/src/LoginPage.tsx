import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NeOSLogo } from './components/NeOSLogo'
import { setLoggedIn } from './auth'

const USER_DISPLAY_NAME_KEY = 'kira-user-display-name'

export function LoginPage() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem(USER_DISPLAY_NAME_KEY) || ''
  })

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const name = (displayName || 'kira-test').trim()
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(USER_DISPLAY_NAME_KEY, name)
      setLoggedIn()
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex justify-center mb-6">
          <NeOSLogo height={64} />
        </div>
        <h1 className="text-xl font-bold text-slate-800 text-center">NICプラットフォーム</h1>
        <p className="mt-2 text-sm text-slate-600 text-center">ログインして利用を開始してください</p>
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label htmlFor="login-name" className="block text-sm font-medium text-slate-700 mb-1">
              表示名（任意）
            </label>
            <input
              id="login-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="kira-test"
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoComplete="username"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            ログイン
          </button>
        </form>
      </div>
    </div>
  )
}
