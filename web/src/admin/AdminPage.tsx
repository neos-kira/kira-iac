import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTraineeList, getProgressSnapshotLive } from '../traineeProgressStorage'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'
import { fetchProgressFromApi, isProgressApiAvailable } from '../progressApi'
import { createAccount, fetchAccounts, type Account, isAccountApiAvailable } from '../accountsApi'

const USER_DISPLAY_NAME_KEY = 'kira-user-display-name'

function getDisplayName(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(USER_DISPLAY_NAME_KEY) || ''
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
  const [traineeList, setTraineeList] = useState<string[]>(() => getTraineeList())
  const [apiProgress, setApiProgress] = useState<Record<string, TraineeProgressSnapshot>>({})
  const [, setProgressTick] = useState(0)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [newAccountName, setNewAccountName] = useState('')
  const [accountMessage, setAccountMessage] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (getDisplayName()?.toLowerCase() !== 'admin') {
      navigate('/', { replace: true })
      return
    }
    const refresh = async () => {
      const list = getTraineeList()
      if (isProgressApiAvailable()) {
        const trainees = await fetchProgressFromApi()
        const byId: Record<string, TraineeProgressSnapshot> = {}
        const ids = new Set(list)
        for (const t of trainees) {
          const id = (t.traineeId || '').trim().toLowerCase()
          if (id && id !== 'admin') {
            ids.add(id)
            byId[id] = t
          }
        }
        setTraineeList([...ids].sort())
        setApiProgress(byId)
      } else {
        setTraineeList(list)
        setApiProgress({})
      }
      setProgressTick((t) => t + 1)
    }
    void refresh()
    const id = setInterval(() => void refresh(), 2000)
    return () => clearInterval(id)
  }, [navigate])

  useEffect(() => {
    if (!isAccountApiAvailable()) return
    let cancelled = false
    const load = async () => {
      const list = await fetchAccounts()
      if (!cancelled) {
        setAccounts(list)
      }
    }
    void load()
    const id = window.setInterval(() => {
      void load()
    }, 5000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    setAccountMessage(null)
    const name = newAccountName.trim().toLowerCase()
    if (!name || name === 'admin') {
      setAccountMessage('有効なユーザー名を入力してください。（admin は除外）')
      return
    }
    const ok = await createAccount(name)
    if (!ok) {
      setAccountMessage('アカウント作成に失敗しました。API設定やネットワークを確認してください。')
      return
    }
    setNewAccountName('')
    setAccountMessage('アカウントを作成しました。')
    const list = await fetchAccounts()
    setAccounts(list)
  }

  if (typeof window !== 'undefined' && getDisplayName()?.toLowerCase() !== 'admin') {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <header className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <h1 className="text-base font-semibold text-slate-800">受講生進捗（WBS）</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              トップへ
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6">
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">アカウント管理</h2>
          <p className="mt-1 text-xs text-slate-600">
            admin で作成したアカウントのみ、受講生画面からログインできます。
          </p>
          {!isAccountApiAvailable() && (
            <p className="mt-2 text-xs text-rose-600">
              アカウントAPIが未設定のため、ここからアカウントを作成できません。VITE_PROGRESS_API_URL を確認してください。
            </p>
          )}
          <form onSubmit={handleCreateAccount} className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="新しいユーザー名（例: kira-test）"
              className="w-48 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!isAccountApiAvailable() || !newAccountName.trim()}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              アカウント作成
            </button>
            {accountMessage && <span className="text-[11px] text-slate-600">{accountMessage}</span>}
          </form>
          <div className="mt-3">
            <p className="text-[11px] font-medium text-slate-700">作成済みアカウント一覧</p>
            {accounts.length === 0 ? (
              <p className="mt-1 text-[11px] text-slate-500">まだアカウントがありません。</p>
            ) : (
              <ul className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-slate-700">
                {accounts.map((a) => (
                  <li
                    key={a.username}
                    className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1"
                  >
                    <span className="font-medium">{a.username}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <p className="mb-4 text-sm text-slate-600">
          登録されている受講生の<strong>基礎課題1〜4</strong>の進捗と遅延を表示します。
          {isProgressApiAvailable()
            ? '進捗はサーバーに保存されているため、どの端末からでも確認できます。'
            : '進捗API未設定時は、受講生が利用したのと同じブラウザで開いた場合のみ表示されます。'}
        </p>
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 font-semibold text-slate-700">受講生</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">はじめに</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">全体進捗</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">課題1</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">課題2</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">課題3</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">課題4</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">遅延</th>
                </tr>
              </thead>
              <tbody>
                {traineeList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-600">
                      受講生がまだ登録されていません。受講生がログインするとここに表示されます。
                    </td>
                  </tr>
                ) : (
                  traineeList.map((traineeId) => {
                    const snap = apiProgress[traineeId] ?? getProgressSnapshotLive(traineeId)
                    const hasDelay = snap.delayedIds.length > 0
                    return (
                      <tr key={traineeId} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-medium text-slate-800">{traineeId}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {snap?.introConfirmed ? (
                            <span className="inline-flex items-center gap-1">
                              <span aria-hidden>✅</span> {formatIntroDate(snap.introAt)}
                            </span>
                          ) : (
                            <span className="text-slate-500">{snap ? '未合格' : '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {snap ? (
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 w-20 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className="h-full rounded-full bg-indigo-500 transition-all"
                                  style={{ width: `${snap.wbsPercent}%` }}
                                />
                              </div>
                              <span className="tabular-nums font-medium text-slate-800">{snap.wbsPercent}%</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—%</span>
                          )}
                        </td>
                        {snap?.chapterProgress?.length
                          ? snap.chapterProgress.map((ch) => {
                            const isOutOfScope = ch.label.includes('対象外')
                            const status = isOutOfScope ? 'out_of_scope' : ch.cleared ? 'done' : ch.percent > 0 ? 'in_progress' : 'not_started'
                            const dotClass =
                              status === 'done'
                                ? 'bg-emerald-500'
                                : status === 'in_progress'
                                  ? 'bg-amber-500'
                                  : status === 'out_of_scope'
                                    ? 'bg-slate-200'
                                    : 'bg-slate-300'
                            const statusLabel = isOutOfScope ? '対象外' : ch.cleared ? '完了' : ch.percent > 0 ? '実施中' : '未着手'
                            return (
                              <td key={ch.chapter} className="px-4 py-3">
                                <div className="flex flex-col gap-0.5">
                                  <span className="inline-flex items-center gap-1.5 text-slate-800">
                                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass}`} aria-hidden />
                                    <span className="text-xs font-medium">{Math.round(ch.percent)}%</span>
                                  </span>
                                  <span className="text-[11px] text-slate-500">{statusLabel}</span>
                                  {ch.chapter === 4 && !isOutOfScope && (
                                    <span className="text-[11px] text-slate-500">Day {snap.currentDay}/10</span>
                                  )}
                                </div>
                              </td>
                            )
                          })
                          : Array.from({ length: 4 }, (_, i) => (
                            <td key={i} className="px-4 py-3 text-slate-400">—%</td>
                          ))}
                        <td className="px-4 py-3">
                          {hasDelay ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800">
                              <span aria-hidden>⚠</span> あり
                            </span>
                          ) : (
                            <span className="text-slate-600">なし</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
