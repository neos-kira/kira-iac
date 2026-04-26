import { useState, useEffect } from 'react'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
import { getCurrentUsername } from '../auth'
import { fetchMyProgress } from '../progressApi'
import { getTaskProgressList } from '../training/trainingWbsData'

export function ProgressPage() {
  const navigate = useSafeNavigate()
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    document.title = '進捗状況'
    const username = getCurrentUsername()
    if (!username) { setIsLoaded(true); return }
    // DynamoDB から取得してキャッシュ状態を最新化
    fetchMyProgress(username)
      .catch(() => {})
      .finally(() => setIsLoaded(true))
  }, [])

  const taskList = getTaskProgressList()
  const clearedCount = taskList.filter((t) => t.cleared).length
  const totalCount = taskList.length
  const overallPct = totalCount > 0 ? Math.round((clearedCount / totalCount) * 100) : 0

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6">
      <div className="mx-auto max-w-3xl space-y-5">

        {/* 戻るボタン */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          ホームに戻る
        </button>

        {/* ページタイトル */}
        <h1 className="text-2xl font-semibold text-[#0F172A]">進捗状況</h1>

        {/* 全体進捗カード */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
          <p className="text-[11px] font-medium text-[#64748B] mb-1 uppercase tracking-wider">全体進捗</p>
          <p className="text-3xl font-bold text-[#0F172A] tabular-nums">
            {isLoaded ? overallPct : '—'}
            <span className="text-lg font-normal text-slate-400">%</span>
          </p>
          <p className="text-[12px] text-[#64748B] mt-1">
            {clearedCount} / {totalCount} ステージ完了
          </p>
          <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#2563EB] transition-all duration-500"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>

        {/* ステージ一覧 */}
        {!isLoaded ? (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.05)] animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-slate-100 rounded" style={{ width: `${60 + i * 8}%` }} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.05)] overflow-hidden">
            {taskList.map((task, i) => {
              const clearedSubs = task.subTasks.filter((s) => s.status === 'cleared').length
              const totalSubs = task.subTasks.length
              const inProgress = !task.cleared && (clearedSubs > 0 || task.subTasks.some((s) => s.status === 'in_progress'))
              const pct = task.cleared ? 100 : Math.round((clearedSubs / Math.max(1, totalSubs)) * 100)

              return (
                <div
                  key={task.id}
                  className={`px-6 py-4 ${i < taskList.length - 1 ? 'border-b border-[#E2E8F0]' : ''}`}
                >
                  {/* ステージ名 + バッジ */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[14px] font-semibold text-[#0F172A]">{task.label}</span>
                    {task.cleared ? (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">完了</span>
                    ) : inProgress ? (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">進行中</span>
                    ) : (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-[#64748B]">未着手</span>
                    )}
                  </div>

                  {/* 進捗バー */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#2563EB] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[12px] text-[#64748B] tabular-nums shrink-0">
                      {clearedSubs} / {totalSubs} 完了
                    </span>
                  </div>

                  {/* サブタスク */}
                  <div className="space-y-1">
                    {task.subTasks.map((sub, j) => (
                      <div key={j} className="flex items-center gap-2 pl-3">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          sub.status === 'cleared' ? 'bg-emerald-500' :
                          sub.status === 'in_progress' ? 'bg-blue-400' : 'bg-slate-300'
                        }`} />
                        <span className={`text-[12px] ${sub.status === 'cleared' ? 'text-slate-500 line-through' : 'text-[#64748B]'}`}>
                          {sub.label}
                        </span>
                        {sub.status === 'cleared' && (
                          <span className="ml-auto text-[10px] text-emerald-600 font-medium">完了</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
