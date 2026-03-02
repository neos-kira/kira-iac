import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTraineeList, getProgressSnapshotLive } from '../traineeProgressStorage'

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
  const [, setProgressTick] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (getDisplayName()?.toLowerCase() !== 'admin') {
      navigate('/', { replace: true })
      return
    }
    const refresh = () => {
      setTraineeList(getTraineeList())
      setProgressTick((t) => t + 1)
    }
    refresh()
    const id = setInterval(refresh, 2000)
    return () => clearInterval(id)
  }, [navigate])

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
        <p className="mb-4 text-sm text-slate-600">
          登録されている受講生の<strong>基礎課題1〜4</strong>の進捗と遅延をリアルタイムで表示します。進捗は<strong>受講生がログインして利用したのと同じブラウザ（同じ端末）</strong>にのみ保存されるため、この画面もその同じブラウザで開いた場合にのみ正しく表示されます。別の端末で開くと「未合格」「0%」となります。
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
                    const snap = getProgressSnapshotLive(traineeId)
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
