import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getTaskProgressList,
  getTrainingStartDate,
  getTotalTaskCountForUser,
  getTotalCleared,
} from './trainingWbsData'
import { OpenInNewTabButton } from '../components/OpenInNewTabButton'

function getTrainingUrl(path: string) {
  const base =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname || '/'}`.replace(/\/$/, '') ||
      window.location.origin
      : ''
  return `${base}#${path}`
}

export function InfraWbsPage() {
  const navigate = useNavigate()
  const [progressList, setProgressList] = useState(() => getTaskProgressList())
  const startDate = getTrainingStartDate()
  const cleared = getTotalCleared()
  const totalTasks = getTotalTaskCountForUser()
  const percent = totalTasks > 0 ? Math.round((cleared / totalTasks) * 100) : 0

  useEffect(() => {
    document.title = 'インフラ基礎 研修WBS'
  }, [])

  useEffect(() => {
    setProgressList(getTaskProgressList())
  }, [])

  const ganttStart = startDate || null
  const ganttEnd =
    progressList.length > 0 && progressList[progressList.length - 1].deadline !== '—'
      ? progressList[progressList.length - 1].deadline
      : null
  const minTs = ganttStart ? new Date(ganttStart).getTime() : 0
  const maxTs = ganttEnd ? new Date(ganttEnd).getTime() : 0
  const rangeMs = maxTs - minTs || 1

  const nextDay = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const formatDateLabel = (d: string) => {
    const [, m, day] = d.split('-')
    return `${m}/${day}`
  }

  const DAY_WIDTH_PX = 40
  const timelineDates: string[] = []
  if (ganttStart && ganttEnd) {
    const start = new Date(ganttStart)
    const end = new Date(ganttEnd)
    for (let t = start.getTime(); t <= end.getTime(); t += 86400 * 1000) {
      const d = new Date(t)
      timelineDates.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      )
    }
  }
  const chartWidthPx = timelineDates.length * DAY_WIDTH_PX

  /** 本日の日付（YYYY-MM-DD）とガント上での左位置px。範囲外なら null */
  const todayStr =
    typeof window !== 'undefined'
      ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
      : ''
  const todayTs = todayStr ? new Date(todayStr + 'T12:00:00').getTime() : 0
  const todayLeftPx =
    ganttStart && ganttEnd && todayTs >= minTs && todayTs <= maxTs
      ? ((todayTs - minTs) / rangeMs) * chartWidthPx
      : null

  const getBarStylePx = (taskIndex: number) => {
    if (!ganttStart || !ganttEnd) return { left: 0, width: 0 }
    const taskEnd = progressList[taskIndex].deadline
    if (taskEnd === '—') return { left: 0, width: 0 }
    const taskStart =
      taskIndex === 0 ? ganttStart : nextDay(progressList[taskIndex - 1].deadline)
    const startTs = new Date(taskStart).getTime()
    const endTs = new Date(taskEnd).getTime()
    const leftPx = ((startTs - minTs) / rangeMs) * chartWidthPx
    const widthPx = ((endTs - startTs) / rangeMs) * chartWidthPx
    return { left: leftPx, width: Math.max(widthPx, 4) }
  }

  /** ガント用: 1-1レベルで展開した行（課題1-1, 1-2, 課題2-1, 2-2, 課題3-1, 3-2） */
  const ganttRows: {
    taskIndex: number
    subLabel: string
    subStatus: string
    parentDeadline: string
    parentCleared: boolean
    parentDelayed: boolean
  }[] = []
  progressList.forEach((task, taskIndex) => {
    if (task.deadline === '—') return
    task.subTasks.forEach((sub) => {
      ganttRows.push({
        taskIndex,
        subLabel: sub.label,
        subStatus: sub.status,
        parentDeadline: task.deadline,
        parentCleared: task.cleared,
        parentDelayed: task.isDelayed,
      })
    })
  })

  /** 課題ごとのWBS用アクセント色（単調さを解消） */
  const TASK_COLORS = [
    { bar: 'bg-sky-500/90', barCleared: 'bg-emerald-500/90', barDelayed: 'bg-rose-500/90', border: 'border-sky-300', bg: 'bg-sky-50', accent: 'bg-sky-100', text: 'text-sky-800' },
    { bar: 'bg-amber-500/90', barCleared: 'bg-emerald-500/90', barDelayed: 'bg-rose-500/90', border: 'border-amber-300', bg: 'bg-amber-50', accent: 'bg-amber-100', text: 'text-amber-800' },
    { bar: 'bg-violet-500/90', barCleared: 'bg-emerald-500/90', barDelayed: 'bg-rose-500/90', border: 'border-violet-300', bg: 'bg-violet-50', accent: 'bg-violet-100', text: 'text-violet-800' },
    { bar: 'bg-emerald-500/90', barCleared: 'bg-emerald-500/90', barDelayed: 'bg-rose-500/90', border: 'border-emerald-300', bg: 'bg-emerald-50', accent: 'bg-emerald-100', text: 'text-emerald-800' },
  ]
  const getColors = (taskIndex: number) => TASK_COLORS[taskIndex] ?? TASK_COLORS[0]

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-800">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-8000">
              TRAINING · WBS
            </p>
            <h1 className="mt-1 text-xl font-semibold text-slate-800">インフラ基礎 研修WBS</h1>
            <p className="mt-1 text-[11px] text-slate-8000">
              ※ 期限は土日祝日を除く営業日で計算しています
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            トップへ戻る
          </button>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600">全体進捗</h2>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-2xl font-bold tabular-nums text-slate-800">{percent}%</p>
              <p className="mt-1 text-sm text-slate-600">
                {cleared} / {totalTasks} 課題クリア
              </p>
              <p className="mt-0.5 text-[11px] text-slate-8000">
                {startDate ? `開始日 ${startDate}` : '開始日未設定（課題1を開くと設定されます）'}
              </p>
            </div>
            <div className="w-full max-w-[200px] shrink-0">
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            ガントチャート
          </h2>
          <p className="mt-1 text-[10px] text-slate-8000">
            横にスクロールして開始から終了まで確認できます
          </p>
          {ganttStart && ganttEnd ? (
            <div className="mt-4 overflow-x-auto overflow-y-visible rounded-lg border border-slate-200 bg-slate-100">
              <div className="flex min-w-0" style={{ minWidth: 180 + chartWidthPx + 100 }}>
                {/* 左: 日付ヘッダー用の空白 + 日付軸 */}
                <div className="flex shrink-0 flex-col" style={{ width: 180 }}>
                  <div className="h-8 border-b border-slate-200 px-2 pt-1.5 text-[10px] font-medium text-slate-8000">
                    課題（1-1レベル）
                  </div>
                  {ganttRows.map((row, idx) => {
                    const colors = getColors(row.taskIndex)
                    return (
                      <div
                        key={`label-${row.taskIndex}-${idx}`}
                        className={`flex h-9 items-center border-b border-slate-200 border-l-4 pl-2 text-[11px] font-medium ${colors.text}`}
                        style={{
                          borderLeftColor:
                            row.taskIndex === 0
                              ? 'rgb(14 165 233)'
                              : row.taskIndex === 1
                                ? 'rgb(245 158 11)'
                                : row.taskIndex === 2
                                  ? 'rgb(139 92 246)'
                                  : 'rgb(16 185 129)',
                        }}
                      >
                        <span className="truncate" title={row.subLabel}>
                          {row.subLabel}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="relative flex flex-1 flex-col overflow-x-auto" style={{ minWidth: chartWidthPx }}>
                  {/* 本日を示す赤線 */}
                  {todayLeftPx != null && (
                    <div
                      className="absolute top-0 bottom-0 z-10 w-0.5 bg-red-500 pointer-events-none"
                      style={{ left: todayLeftPx }}
                      title="本日"
                      aria-hidden
                    />
                  )}
                  {/* 日付軸: 1日＝40px */}
                  <div
                    className="flex shrink-0 border-b border-slate-200"
                    style={{ width: chartWidthPx, height: 32 }}
                  >
                    {timelineDates.map((d) => (
                      <div
                        key={d}
                        className="flex shrink-0 flex-col items-center justify-center border-r border-slate-200 text-[9px] text-slate-8000"
                        style={{ width: DAY_WIDTH_PX }}
                      >
                        {formatDateLabel(d)}
                      </div>
                    ))}
                  </div>
                  {/* 1-1レベルで課題バー行 */}
                  {ganttRows.map((row, idx) => {
                    const stylePx = getBarStylePx(row.taskIndex)
                    const colors = getColors(row.taskIndex)
                    const barClass =
                      row.parentCleared ? colors.barCleared : row.parentDelayed ? colors.barDelayed : colors.bar
                    return (
                      <div
                        key={`bar-${row.taskIndex}-${idx}`}
                        className="relative flex shrink-0 border-b border-slate-200"
                        style={{ height: 36, width: chartWidthPx }}
                      >
                        <div
                          className={`absolute top-1.5 bottom-1.5 rounded-md ${barClass}`}
                          style={{ left: stylePx.left, width: stylePx.width }}
                          title={`${row.subLabel}: ～ ${row.parentDeadline}`}
                        />
                      </div>
                    )
                  })}
                </div>
                {/* 右: 期限列 */}
                <div className="flex w-[100px] shrink-0 flex-col border-l border-slate-200">
                  <div className="flex h-8 items-center border-b border-slate-200 px-2 pt-1.5 text-[10px] font-medium text-slate-8000">
                    期限
                  </div>
                  {ganttRows.map((row, idx) => (
                    <div
                      key={`deadline-${row.taskIndex}-${idx}`}
                      className="flex h-9 items-center border-b border-slate-200 px-2 text-[10px] text-slate-600"
                    >
                      {row.parentDeadline}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-slate-8000">
              開始日を設定するとガントチャートが表示されます（課題1のページで「開始する」を選択してください）。
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-600">
            課題一覧 · 何がどこまで進んでいるか
          </h2>
          <div className="space-y-4">
            {progressList.map((task, taskIndex) => {
              const colors = getColors(taskIndex)
              return (
                <article
                  key={task.id}
                  className={`rounded-2xl border-l-4 p-4 shadow-md transition-colors ${colors.border} ${task.cleared
                    ? 'border-emerald-400 bg-white'
                    : task.isDelayed
                      ? 'border-rose-400 bg-white'
                      : `${colors.bg} border-slate-200`
                    }`}
                  style={{
                    borderLeftColor:
                      taskIndex === 0 ? 'rgb(14 165 233)' : taskIndex === 1 ? 'rgb(245 158 11)' : taskIndex === 2 ? 'rgb(139 92 246)' : 'rgb(16 185 129)',
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colors.accent} ${colors.text}`}>
                          課題{taskIndex + 1}
                        </span>
                        <span className="text-base font-semibold text-slate-800">{task.label}</span>
                        {task.cleared && (
                          <span className="rounded-full bg-emerald-600/25 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                            クリア済
                          </span>
                        )}
                        {task.isDelayed && (
                          <span className="rounded-full bg-rose-600/25 px-2 py-0.5 text-[10px] font-medium text-rose-300">
                            遅延
                          </span>
                        )}
                      </div>
                      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]">
                        <div className="flex gap-1.5">
                          <dt className="text-slate-8000">期限:</dt>
                          <dd className="font-medium text-slate-600">{task.deadline}</dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt className="text-slate-8000">目安:</dt>
                          <dd className="text-slate-600">開始から {task.estimatedDays} 営業日目</dd>
                        </div>
                      </dl>
                    </div>
                    <OpenInNewTabButton
                      url={getTrainingUrl(task.path)}
                      className="btn-wiggle shrink-0 rounded-xl bg-gradient-to-r bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
                    />
                  </div>
                  <ul className="mt-4 space-y-2 border-t border-slate-200 pt-4">
                    {task.subTasks.map((sub, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-3 rounded-r-lg border-l-4 bg-slate-100 px-3 py-2 text-[12px]"
                        style={{
                          borderLeftColor:
                            taskIndex === 0 ? 'rgb(14 165 233)' : taskIndex === 1 ? 'rgb(245 158 11)' : taskIndex === 2 ? 'rgb(139 92 246)' : 'rgb(16 185 129)',
                        }}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${sub.status === 'cleared'
                            ? 'bg-emerald-600/30 text-emerald-300'
                            : sub.status === 'in_progress'
                              ? 'bg-amber-600/30 text-amber-300'
                              : 'bg-slate-200 text-slate-600'
                            }`}
                          aria-hidden
                        >
                          {sub.status === 'cleared' ? '✓' : sub.status === 'in_progress' ? '◐' : '—'}
                        </span>
                        <span
                          className={`flex-1 ${sub.status === 'cleared' ? 'text-slate-8000 line-through' : 'text-slate-700'}`}
                        >
                          {sub.label}
                        </span>
                        <span className="shrink-0 text-[11px] text-slate-8000">
                          {sub.status === 'cleared' ? '済' : sub.status === 'in_progress' ? '実施中' : '未着手'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
