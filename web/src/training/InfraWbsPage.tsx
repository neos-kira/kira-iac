import { useEffect, useState } from 'react'
import {
  getTaskProgressList,
  getTrainingStartDate,
  getTotalTaskCountForUser,
  getTotalCleared,
} from './trainingWbsData'
import { OpenInNewTabButton } from '../components/OpenInNewTabButton'
import { getCurrentUsername } from '../auth'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'
import { fetchMyProgress, isProgressApiAvailable } from '../progressApi'

function getTrainingUrl(path: string) {
  const base =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname || '/'}`.replace(/\/$/, '') ||
      window.location.origin
      : ''
  return `${base}#${path}`
}

export function InfraWbsPage() {
  const [progressList, setProgressList] = useState(() => getTaskProgressList())
  const [serverSnapshot, setServerSnapshot] = useState<TraineeProgressSnapshot | null>(null)
  const startDate = getTrainingStartDate()

  // 分母は常に TRAINING_TASKS.length を使い、DynamoDB の古い chapterProgress に依存しない
  const totalTasks = getTotalTaskCountForUser()

  // サブタスク総数・完了数
  const allSubTasks = progressList.flatMap((t) => t.subTasks)
  const subDone = allSubTasks.filter((s) => s.status === 'cleared').length
  const subTotal = allSubTasks.length

  // 課題クリア数（localStorageベースを優先、serverSnapshotはフォールバック）
  const clearedLocal = getTotalCleared()
  const cleared = clearedLocal > 0
    ? clearedLocal
    : serverSnapshot
      ? serverSnapshot.chapterProgress.filter((c) => c.cleared).length
      : 0

  // 進捗率: サブタスクベースで細かく算出
  const percent = subTotal > 0 ? Math.round((subDone / subTotal) * 100) : 0

  useEffect(() => {
    document.title = 'インフラ基礎 研修WBS'
  }, [])

  useEffect(() => {
    setProgressList(getTaskProgressList())
  }, [])

  useEffect(() => {
    if (!isProgressApiAvailable() || typeof window === 'undefined') return
    const name = getCurrentUsername().trim().toLowerCase()
    if (!name || name === 'admin') return
    let cancelled = false
    const load = async () => {
      const snap = await fetchMyProgress(name)
      if (!cancelled && snap) setServerSnapshot(snap)
    }
    void load()
    const id = window.setInterval(() => { void load() }, 5000)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [])

  /** 課題のステータス判定 */
  const getTaskStatus = (task: typeof progressList[0]) => {
    if (task.cleared) return 'cleared' as const
    if (task.subTasks.some((s) => s.status !== 'not_started')) return 'in_progress' as const
    return 'not_started' as const
  }

  /** 課題の色テーマ */
  const TASK_THEMES = {
    cleared: {
      border: 'border-emerald-300',
      barBg: 'bg-emerald-100',
      barFill: 'bg-emerald-500',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      badgeLabel: '完了',
    },
    in_progress: {
      border: 'border-teal-300',
      barBg: 'bg-teal-100',
      barFill: 'bg-teal-500',
      badge: 'bg-teal-50 text-teal-700 border-teal-200',
      badgeLabel: '進行中',
    },
    not_started: {
      border: 'border-slate-200',
      barBg: 'bg-slate-100',
      barFill: 'bg-slate-300',
      badge: 'bg-slate-50 text-slate-500 border-slate-200',
      badgeLabel: '未着手',
    },
    delayed: {
      border: 'border-amber-300',
      barBg: 'bg-amber-100',
      barFill: 'bg-amber-500',
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      badgeLabel: '確認が必要',
    },
  }

  const getTheme = (task: typeof progressList[0]) => {
    if (task.isDelayed && !task.cleared) return TASK_THEMES.delayed
    return TASK_THEMES[getTaskStatus(task)]
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-800">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <p className="text-xs text-slate-500">研修管理</p>
          <h1 className="text-xl font-bold text-slate-800">研修WBS</h1>
        </div>

        {/* 全体進捗 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600">全体進捗</h2>
          <div className="mt-4">
            <div className="flex items-end justify-between mb-2">
              <p className="text-3xl font-bold tabular-nums text-slate-800">{percent}%</p>
              <p className="text-sm text-slate-500">{subDone} / {subTotal} サブタスク完了</p>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span>{startDate ? `開始日 ${startDate}` : '開始日未設定（課題1を開くと設定されます）'}</span>
              <span>{cleared} / {totalTasks} 課題クリア</span>
            </div>
          </div>
        </section>

        {/* 課題一覧 */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            課題一覧
          </h2>
          {progressList.map((task, taskIndex) => {
            const theme = getTheme(task)
            const taskSubDone = task.subTasks.filter((s) => s.status === 'cleared').length
            const taskSubTotal = task.subTasks.length
            const taskPct = taskSubTotal > 0 ? Math.round((taskSubDone / taskSubTotal) * 100) : 0
            const rag = task.id === 'infra-basic-4' ? (serverSnapshot?.infra4Rag ?? null) : null

            return (
              <article
                key={task.id}
                className={`rounded-2xl border bg-white shadow-sm ${theme.border}`}
              >
                {/* ヘッダー */}
                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-semibold text-slate-500">課題{taskIndex + 1}</span>
                        <span className="text-sm font-semibold text-slate-800">{task.label}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${theme.badge}`}>
                          {task.cleared ? '完了 ✅' : theme.badgeLabel}
                        </span>
                        {rag && (
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            rag === 'green' ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : rag === 'yellow' ? 'border-amber-300 bg-amber-50 text-amber-700'
                                : 'border-rose-300 bg-rose-50 text-rose-700'
                          }`}>
                            {rag.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                    <OpenInNewTabButton
                      url={getTrainingUrl(task.path)}
                      className="shrink-0 rounded-xl bg-teal-600 px-4 py-2 text-xs font-medium text-white hover:bg-teal-700"
                    />
                  </div>

                  {/* プログレスバー */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium text-slate-600">{taskPct}%</span>
                      <span className="text-[11px] text-slate-500">{taskSubDone}/{taskSubTotal}</span>
                    </div>
                    <div className={`h-2 w-full overflow-hidden rounded-full ${theme.barBg}`}>
                      <div
                        className={`h-full rounded-full ${theme.barFill} transition-all duration-300`}
                        style={{ width: `${taskPct}%` }}
                      />
                    </div>
                  </div>

                  {/* 期限情報 */}
                  <div className="mt-2 flex flex-wrap gap-x-4 text-[11px] text-slate-500">
                    <span>期限: {task.deadline}</span>
                    <span>目安: 開始から {task.estimatedDays} 営業日目</span>
                  </div>
                </div>

                {/* サブタスク一覧 */}
                <div className="border-t border-slate-100 px-4 py-3">
                  <ul className="space-y-1.5">
                    {task.subTasks.map((sub, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2 text-[12px]"
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                            sub.status === 'cleared'
                              ? 'bg-emerald-100 text-emerald-600'
                              : sub.status === 'in_progress'
                                ? 'bg-teal-100 text-teal-600'
                                : 'bg-slate-200 text-slate-400'
                          }`}
                        >
                          {sub.status === 'cleared' ? '✓' : sub.status === 'in_progress' ? '◐' : '—'}
                        </span>
                        <span className={`flex-1 ${sub.status === 'cleared' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                          {sub.label}
                        </span>
                        <span className={`shrink-0 text-[10px] font-medium ${
                          sub.status === 'cleared' ? 'text-emerald-600' : sub.status === 'in_progress' ? 'text-teal-600' : 'text-slate-400'
                        }`}>
                          {sub.status === 'cleared' ? '済 ✅' : sub.status === 'in_progress' ? '実施中' : '未着手'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            )
          })}
        </section>
      </div>
    </div>
  )
}
