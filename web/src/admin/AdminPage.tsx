import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getIntroConfirmed, getIntroConfirmedAt } from '../training/introGate'
import {
  getWbsProgressPercent,
  getChapterProgressList,
  getCurrentProjectDay,
  getDelayedTaskIds,
  INSTRUCTOR_REFERENCE,
  AUDIT_REFERENCE,
} from '../training/trainingWbsData'

const ADMIN_SESSION_KEY = 'kira-admin-logged-in'
const USER_DISPLAY_NAME_KEY = 'kira-user-display-name'

/** この端末で記録されている受講生名。admin の場合は null（管理者の進捗は表示しない） */
function getTraineeDisplayName(): string | null {
  if (typeof window === 'undefined') return null
  const name = window.localStorage.getItem(USER_DISPLAY_NAME_KEY)?.trim() || ''
  if (name.toLowerCase() === 'admin' || name === '') return null
  return name
}

/** 合格日を MM/DD 形式で返す */
function formatIntroDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${m}/${day}`
  } catch {
    return '—'
  }
}

export function AdminPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [authed, setAuthed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true'
  })
  const [refModalOpen, setRefModalOpen] = useState(false)
  const [introConfirmed, setIntroConfirmed] = useState(false)
  const [introAt, setIntroAt] = useState<string | null>(null)
  const [wbsPercent, setWbsPercent] = useState(0)
  const [chapterProgress, setChapterProgress] = useState<ReturnType<typeof getChapterProgressList>>([])
  const [currentDay, setCurrentDay] = useState(0)
  const [delayedIds, setDelayedIds] = useState<string[]>([])
  const [traineeName, setTraineeName] = useState<string | null>(() => getTraineeDisplayName())

  function refreshProgress() {
    setIntroConfirmed(getIntroConfirmed())
    setIntroAt(getIntroConfirmedAt())
    setWbsPercent(getWbsProgressPercent())
    setChapterProgress(getChapterProgressList())
    setCurrentDay(getCurrentProjectDay())
    setDelayedIds(getDelayedTaskIds())
    setTraineeName(getTraineeDisplayName())
  }

  useEffect(() => {
    if (!authed || typeof window === 'undefined') return
    refreshProgress()
    const id = setInterval(refreshProgress, 2000)
    return () => clearInterval(id)
  }, [authed])

  useEffect(() => {
    if (authed && (location.state as { openRef?: boolean } | null)?.openRef) {
      setRefModalOpen(true)
      navigate(location.pathname + location.search, { replace: true, state: {} })
    }
  }, [authed, location.state, location.pathname, location.search, navigate])

  function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault()
    const u = username.trim()
    const p = password.trim()
    const ok = u === 'admin' && (p === 'admin' || p === '')
    if (ok) {
      setAuthed(true)
      setError(null)
      setPassword('')
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(ADMIN_SESSION_KEY, 'true')
      }
    } else {
      setError('ユーザー名が正しくありません。（ユーザー名: admin、パスワード: 任意）')
    }
  }

  function handleLogout() {
    if (typeof window === 'undefined') return
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY)
    const base = (window.location.origin + window.location.pathname + (window.location.search || '')).replace(/\/$/, '') || window.location.origin
    window.location.href = base + '#/admin'
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center">
          <div className="rounded-2xl border border-slate-700 bg-slate-800/90 p-6 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">ADMIN · LOGIN</p>
            <h1 className="mt-2 text-lg font-semibold text-white">講師用管理ページログイン</h1>
            <p className="mt-2 text-xs text-slate-400">
              ユーザー名とパスワードを入力して講師用メニューにアクセスします。
            </p>
            <form onSubmit={handleLoginSubmit} className="mt-4 space-y-3">
              <label className="block text-[11px] text-slate-400">
                ユーザー名
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                  placeholder="admin"
                />
              </label>
              <label className="block text-[11px] text-slate-400">
                パスワード
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                  placeholder="admin"
                />
              </label>
              {error && <p className="text-[11px] text-rose-400">{error}</p>}
              <div className="mt-2 flex gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-violet-500 hover:to-purple-500"
                >
                  ログイン
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="rounded-lg border border-slate-600 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                >
                  トップへ戻る
                </button>
              </div>
              <p className="mt-3 text-[10px] text-slate-500">初期: admin / admin</p>
            </form>
          </div>
        </div>
      </div>
    )
  }

  const hasDelay = delayedIds.length > 0

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-700/80 bg-slate-900/50 px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <h1 className="text-base font-semibold text-white">受講生進捗（WBS）</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRefModalOpen(true)}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
            >
              リファレンス
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
            >
              受講者画面へ
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6">
        <p className="mb-4 text-xs text-slate-500">
          受講生（管理者以外）のWBS進捗を表示します。各端末で受講生としてログインした際の進捗が記録されます。
        </p>
        <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/60 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/80">
                  <th className="px-4 py-3 font-semibold text-slate-300">受講生</th>
                  <th className="px-4 py-3 font-semibold text-slate-300">はじめに</th>
                  <th className="px-4 py-3 font-semibold text-slate-300">全体進捗</th>
                  <th className="px-4 py-3 font-semibold text-slate-300">Ch1</th>
                  <th className="px-4 py-3 font-semibold text-slate-300">Ch2</th>
                  <th className="px-4 py-3 font-semibold text-slate-300">Ch3</th>
                  <th className="px-4 py-3 font-semibold text-slate-300">Ch4</th>
                  <th className="px-4 py-3 font-semibold text-slate-300">遅延</th>
                </tr>
              </thead>
              <tbody>
                {traineeName === null ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      この端末は管理者でログイン中のため、受講生の進捗データはありません。
                      <br />
                      <span className="text-[11px]">受講生として別の端末でログインすると、その端末で本画面を開いた際に進捗が表示されます。</span>
                    </td>
                  </tr>
                ) : (
                  <tr className="border-b border-slate-700/80 hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-medium text-white">{traineeName}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {introConfirmed ? (
                        <span className="inline-flex items-center gap-1">
                          <span aria-hidden>✅</span> {formatIntroDate(introAt)}
                        </span>
                      ) : (
                        <span className="text-slate-500">未合格</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-700">
                          <div
                            className="h-full rounded-full bg-indigo-500 transition-all"
                            style={{ width: `${wbsPercent}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-white">{wbsPercent}%</span>
                      </div>
                    </td>
                    {chapterProgress.map((ch) => {
                      const status = ch.cleared ? 'done' : ch.percent > 0 ? 'in_progress' : 'not_started'
                      const dotClass =
                        status === 'done'
                          ? 'bg-emerald-500'
                          : status === 'in_progress'
                            ? 'bg-indigo-500'
                            : 'bg-slate-600'
                      return (
                        <td key={ch.chapter} className="px-4 py-3 text-slate-300">
                          <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} title={`${Math.round(ch.percent)}%`} />
                          {ch.chapter === 4 && (
                            <span className="ml-1.5 text-[11px] text-slate-500">Day {currentDay}/10</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3">
                      {hasDelay ? (
                        <span className="text-amber-400">遅延あり</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* 講師用リファレンス: モーダル */}
      {refModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => setRefModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ref-modal-title"
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
              <h2 id="ref-modal-title" className="text-sm font-bold text-white">
                講師用リファレンス
              </h2>
              <button
                type="button"
                onClick={() => setRefModalOpen(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                閉じる
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-5 max-h-[calc(85vh-52px)]">
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                <h3 className="text-xs font-bold text-violet-400 mb-2">{AUDIT_REFERENCE.aiGovernance.title}</h3>
                <p className="text-[11px] text-slate-300 mb-1.5">
                  IPアドレス（192.168.1.1 → 192.168.X.X）の抽象化、顧客名の匿名化（株式会社A → クライアントX）。
                </p>
                <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-0.5">
                  {AUDIT_REFERENCE.aiGovernance.points.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                <h3 className="text-xs font-bold text-violet-400 mb-2">{INSTRUCTOR_REFERENCE.chapter4Quality.title}</h3>
                <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-0.5">
                  {INSTRUCTOR_REFERENCE.chapter4Quality.points.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-bold text-violet-400 mb-2">{INSTRUCTOR_REFERENCE.chapter1.title}</h3>
                <pre className="rounded-lg bg-slate-950 p-3 text-[11px] text-slate-400 whitespace-pre-wrap border border-slate-700">
                  {INSTRUCTOR_REFERENCE.chapter1.content}
                </pre>
              </div>
              <div>
                <h3 className="text-xs font-bold text-violet-400 mb-2">{INSTRUCTOR_REFERENCE.chapter2.title}</h3>
                <pre className="rounded-lg bg-slate-950 p-3 text-[11px] text-slate-400 whitespace-pre-wrap border border-slate-700">
                  {INSTRUCTOR_REFERENCE.chapter2.content}
                </pre>
              </div>
              <div>
                <h3 className="text-xs font-bold text-violet-400 mb-2">{INSTRUCTOR_REFERENCE.chapter3.title}</h3>
                <pre className="rounded-lg bg-slate-950 p-3 text-[11px] text-slate-400 whitespace-pre-wrap border border-slate-700">
                  {INSTRUCTOR_REFERENCE.chapter3.content}
                </pre>
              </div>
              <div>
                <h3 className="text-xs font-bold text-violet-400 mb-2">{INSTRUCTOR_REFERENCE.al2023Script.title}</h3>
                <pre className="rounded-lg bg-slate-950 p-3 text-[11px] text-slate-400 whitespace-pre-wrap border border-slate-700 font-mono">
                  {INSTRUCTOR_REFERENCE.al2023Script.content}
                </pre>
              </div>
              <div>
                <h3 className="text-xs font-bold text-violet-400 mb-2">{AUDIT_REFERENCE.backupAndDiff.title}</h3>
                <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-0.5">
                  {AUDIT_REFERENCE.backupAndDiff.points.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
