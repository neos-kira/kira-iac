import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { L1_CLEARED_KEY, L1_PROGRESS_KEY } from '../training/linuxLevel1Data'
import { L2_CLEARED_KEY, L2_PROGRESS_KEY } from '../training/linuxLevel2Data'
import { INFRA_BASIC_1_CLEARED_KEY, loadInfraBasic1State } from '../training/infraBasic1Data'
import { loadInfraBasic21State } from '../training/infraBasic21Data'

type Snapshot = {
  l1Cleared: boolean
  l1ProgressRaw: string | null
  l2Cleared: boolean
  l2ProgressRaw: string | null
  infra1Cleared: boolean
  infra1State: unknown
  infra21State: unknown
}

const ADMIN_SESSION_KEY = 'kira-admin-logged-in'

export function AdminPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [authed, setAuthed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true'
  })
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)

  useEffect(() => {
    if (!authed || typeof window === 'undefined') return
    try {
      const l1Cleared = window.localStorage.getItem(L1_CLEARED_KEY) === 'true'
      const l1ProgressRaw = window.localStorage.getItem(L1_PROGRESS_KEY)
      const l2Cleared = window.localStorage.getItem(L2_CLEARED_KEY) === 'true'
      const l2ProgressRaw = window.localStorage.getItem(L2_PROGRESS_KEY)
      const infra1Cleared = window.localStorage.getItem(INFRA_BASIC_1_CLEARED_KEY) === 'true'

      const infra1State = loadInfraBasic1State()
      const infra21State = loadInfraBasic21State()

      setSnapshot({
        l1Cleared,
        l1ProgressRaw,
        l2Cleared,
        l2ProgressRaw,
        infra1Cleared,
        infra1State,
        infra21State,
      })
    } catch {
      // ignore
    }
  }, [authed])

  const formattedInfra1 = useMemo(
    () => (snapshot ? JSON.stringify(snapshot.infra1State, null, 2) : ''),
    [snapshot],
  )
  const formattedInfra21 = useMemo(
    () => (snapshot ? JSON.stringify(snapshot.infra21State, null, 2) : ''),
    [snapshot],
  )

  function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault()
    const u = username.trim()
    const p = password
    if (u === 'admin' && p === 'admin') {
      setAuthed(true)
      setError(null)
      setPassword('')
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(ADMIN_SESSION_KEY, 'true')
      }
    } else {
      setError('ユーザー名またはパスワードが正しくありません。（admin/admin）')
    }
  }

  function handleLogout() {
    setAuthed(false)
    setSnapshot(null)
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(ADMIN_SESSION_KEY)
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 text-slate-50 p-6">
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-6 shadow-soft-card">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">ADMIN · LOGIN</p>
            <h1 className="mt-2 text-lg font-semibold text-slate-50">講師用管理ページログイン</h1>
            <p className="mt-2 text-xs text-slate-400">
              ユーザー名とパスワードを入力して講師用メニューにアクセスします。受講者には共有しないでください。
            </p>
            <form onSubmit={handleLoginSubmit} className="mt-4 space-y-3">
              <label className="block text-[11px] text-slate-300">
                ユーザー名
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                  placeholder="admin"
                />
              </label>
              <label className="block text-[11px] text-slate-300">
                パスワード
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                  placeholder="admin"
                />
              </label>
              {error && <p className="text-[11px] text-rose-300">{error}</p>}
              <div className="mt-2 flex gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-xs font-semibold text-white hover:from-brand-400 hover:to-brand-600"
                >
                  ログイン
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-medium text-slate-200 hover:border-slate-500 hover:text-slate-50"
                >
                  トップへ戻る
                </button>
              </div>
              <p className="mt-3 text-[10px] text-slate-500">初期ユーザー: admin / パスワード: admin</p>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 text-slate-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">TRAINING · ADMIN</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-50">講師用管理ページ</h1>
            <p className="mt-1 text-xs text-slate-400">
              このブラウザ上で実施された研修の進捗・回答内容を確認できます。（localStorage ベース）
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-xl border border-slate-700 px-3 py-1.5 text-[11px] font-medium text-slate-200 hover:border-slate-500 hover:text-slate-50"
            >
              受講者画面へ戻る
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="text-[10px] text-slate-500 hover:text-rose-300"
            >
              admin からログアウト
            </button>
          </div>
        </header>

        {!snapshot ? (
          <p className="text-xs text-slate-400">進捗データを読み込み中、またはまだ入力がありません。</p>
        ) : (
          <>
            {/* インフラ基礎課題1 */}
            <section className="space-y-2 rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 shadow-soft-card">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-50">インフラ基礎課題1（ツール演習）</h2>
                <p className="text-[11px] text-slate-400">
                  状態: {snapshot.infra1Cleared ? 'クリア済み' : '未クリア'}
                </p>
              </div>
              <p className="text-[11px] text-slate-400">
                チェックボックスや「セクション完了」の状態を含むローカルの保存内容です。
              </p>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] text-slate-200">
                {formattedInfra1}
              </pre>
            </section>

            {/* インフラ基礎課題2-1 */}
            <section className="space-y-2 rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 shadow-soft-card">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-50">インフラ基礎課題2-1 ネットワーク実践編</h2>
                <p className="text-[11px] text-slate-400">実機調査フォームと記述式小テストの回答内容です。</p>
              </div>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] text-slate-200">
                {formattedInfra21}
              </pre>
            </section>

            {/* インフラ基礎課題2-2 / TCP-IP クイズ */}
            <section className="space-y-2 rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 shadow-soft-card">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-50">インフラ基礎課題2-2 TCP/IP 理解度チェック10問</h2>
                <p className="text-[11px] text-slate-400">
                  状態:{' '}
                  {snapshot.l2Cleared ? '満点クリア（localStorage の L2_CLEARED_KEY が true）' : '未クリア／未受講'}
                </p>
              </div>
              <p className="text-[11px] text-slate-400">
                進捗（何問まで回答したか等）は JSON 形式で保存されています。必要に応じて開発者ツールで詳細を参照できます。
              </p>
              <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] text-slate-200">
                {snapshot.l2ProgressRaw ?? '(進捗データなし)'}
              </pre>
            </section>

            {/* インフラ研修1 / Linux30問 */}
            <section className="space-y-2 rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 shadow-soft-card">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-50">インフラ研修1 Linuxコマンド30問</h2>
                <p className="text-[11px] text-slate-400">
                  状態:{' '}
                  {snapshot.l1Cleared ? '満点クリア（L1_CLEARED_KEY が true）' : '未クリア／未受講'}
                </p>
              </div>
              <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] text-slate-200">
                {snapshot.l1ProgressRaw ?? '(進捗データなし)'}
              </pre>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

