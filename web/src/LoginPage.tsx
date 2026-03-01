import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NeOSLogo } from './components/NeOSLogo'
import { setLoggedIn } from './auth'
import { addTrainee } from './traineeProgressStorage'

const USER_DISPLAY_NAME_KEY = 'kira-user-display-name'
const ADMIN_SESSION_KEY = 'kira-admin-logged-in'

export function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    document.title = 'NICプラットフォーム'
  }, [])

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const name = username.trim()
    if (!name) return
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(USER_DISPLAY_NAME_KEY, name)
      setLoggedIn()
      if (name === 'admin') {
        window.sessionStorage.setItem(ADMIN_SESSION_KEY, 'true')
        window.location.href = (window.location.origin + window.location.pathname + (window.location.search || '')).replace(/\/$/, '') + '#/admin'
        return
      }
      addTrainee(name)
    }
    navigate('/', { replace: true })
  }

  const canSubmit = username.trim().length > 0

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex justify-center mb-6">
          <NeOSLogo height={128} />
        </div>
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label htmlFor="login-username" className="block text-sm font-medium text-slate-700 mb-1">
              ユーザー名
            </label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ユーザー名を入力"
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1">
              パスワード
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワードを入力"
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ログイン
          </button>
        </form>
      </div>
    </div>
  )
}
