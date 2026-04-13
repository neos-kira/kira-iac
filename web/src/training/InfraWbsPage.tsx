import { useEffect, useState } from 'react'
import {
  getTaskProgressList,
  getTrainingStartDate,
  getTotalTaskCountForUser,
  getTotalCleared,
  TRAINING_TASKS,
  addBusinessDays,
} from './trainingWbsData'
import { OpenInNewTabButton } from '../components/OpenInNewTabButton'
import { getCurrentUsername } from '../auth'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'
import { fetchMyProgress, isProgressApiAvailable } from '../progressApi'

// ─── 型定義 ────────────────────────────────────────────────────────────────────

type WBSStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed'

type WBSRow = {
  id: string
  level: 0 | 1
  name: string
  plannedStart: string   // YYYY-MM-DD
  plannedEnd: string
  status: WBSStatus
  progressPct: number
  delayDays: number
  path?: string
}

// ─── ユーティリティ ────────────────────────────────────────────────────────────

function getTrainingUrl(path: string) {
  const base =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname || '/'}`.replace(/\/$/, '')
      : ''
  return `${base}#${path}`
}

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 2日付間のカレンダー日数（正=遅延, 負=前倒し） */
function diffDays(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

/** YYYY-MM-DD → M/D */
function fmtDate(s: string): string {
  if (!s || s === '—') return '—'
  const [, m, d] = s.split('-')
  return `${Number(m)}/${Number(d)}`
}

// ─── WBS データ生成 ────────────────────────────────────────────────────────────

function buildWBSRows(startDate: string | null): WBSRow[] {
  const progressList = getTaskProgressList()
  const todayStr = today()
  const rows: WBSRow[] = []

  if (!startDate) {
    // 開始日未設定: 予定日なしで一覧だけ出す
    TRAINING_TASKS.forEach((task) => {
      rows.push({
        id: task.id,
        level: 0,
        name: task.label,
        plannedStart: '—',
        plannedEnd: '—',
        status: 'not_started',
        progressPct: 0,
        delayDays: 0,
        path: task.path,
      })
      task.subTasks.forEach((sub, i) => {
        rows.push({
          id: `${task.id}-sub-${i}`,
          level: 1,
          name: sub.label,
          plannedStart: '—',
          plannedEnd: '—',
          status: 'not_started',
          progressPct: 0,
          delayDays: 0,
        })
      })
    })
    return rows
  }

  // 各課題の計画開始日・終了日を算出
  // estimatedDays は研修開始日からの累積営業日
  // cumDays[i]=開始オフセット, cumDays[i+1]=終了オフセット
  const cumDays = [0, ...TRAINING_TASKS.map((t) => t.estimatedDays)]

  TRAINING_TASKS.forEach((task, taskIndex) => {
    const taskProgress = progressList[taskIndex]
    const pStart = addBusinessDays(startDate, cumDays[taskIndex])
    const pEnd   = addBusinessDays(startDate, cumDays[taskIndex + 1])

    const cleared = taskProgress?.cleared ?? false
    const subsDone = taskProgress?.subTasks.filter((s) => s.status === 'cleared').length ?? 0
    const subsTotal = taskProgress?.subTasks.length ?? 1
    const subsInProgress = taskProgress?.subTasks.some((s) => s.status === 'in_progress') ?? false

    let status: WBSStatus = 'not_started'
    if (cleared) {
      status = 'completed'
    } else if (todayStr > pEnd) {
      status = 'delayed'
    } else if (subsDone > 0 || subsInProgress) {
      status = 'in_progress'
    }

    const delayDays = (!cleared && todayStr > pEnd) ? diffDays(pEnd, todayStr) : 0
    const progressPct = cleared ? 100 : Math.round((subsDone / subsTotal) * 100)

    rows.push({
      id: task.id,
      level: 0,
      name: task.label,
      plannedStart: pStart,
      plannedEnd: pEnd,
      status,
      progressPct,
      delayDays,
      path: task.path,
    })

    // サブタスク: 課題の期間を均等分割
    const subSpanDays = Math.max(1, diffDays(pStart, pEnd))
    const subDaysEach = subSpanDays / task.subTasks.length

    task.subTasks.forEach((sub, i) => {
      const subPStart = addBusinessDays(pStart, Math.floor(i * subDaysEach))
      const subPEnd   = addBusinessDays(pStart, Math.max(1, Math.floor((i + 1) * subDaysEach)))
      const subProg = taskProgress?.subTasks[i]
      let subStatus: WBSStatus = 'not_started'
      if (subProg?.status === 'cleared') {
        subStatus = 'completed'
      } else if (subProg?.status === 'in_progress') {
        subStatus = 'in_progress'
      } else if (!cleared && todayStr > subPEnd) {
        subStatus = 'delayed'
      }
      rows.push({
        id: `${task.id}-sub-${i}`,
        level: 1,
        name: sub.label,
        plannedStart: subPStart,
        plannedEnd: subPEnd,
        status: subStatus,
        progressPct: subStatus === 'completed' ? 100 : subStatus === 'in_progress' ? 50 : 0,
        delayDays: subStatus === 'delayed' ? diffDays(subPEnd, todayStr) : 0,
      })
    })
  })

  return rows
}

// ─── ステータス設定 ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<WBSStatus, { label: string; bg: string; text: string; dot: string }> = {
  not_started: { label: '未着手', bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' },
  in_progress: { label: '進行中', bg: 'bg-blue-100',  text: 'text-blue-700',  dot: 'bg-blue-500' },
  completed:   { label: '完了',   bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  delayed:     { label: '遅延',   bg: 'bg-red-100',   text: 'text-red-700',   dot: 'bg-red-500' },
}

// ─── ガントチャート ────────────────────────────────────────────────────────────

function GanttChart({ rows, ganttStart, ganttEnd }: { rows: WBSRow[]; ganttStart: string; ganttEnd: string }) {
  const todayStr = today()
  const totalMs = new Date(ganttEnd).getTime() - new Date(ganttStart).getTime()
  if (totalMs <= 0) return null

  const pct = (dateStr: string) => {
    const ms = new Date(dateStr).getTime() - new Date(ganttStart).getTime()
    return Math.max(0, Math.min(100, (ms / totalMs) * 100))
  }
  const widthPct = (s: string, e: string) => {
    const w = Math.max(0.5, pct(e) - pct(s))
    return w
  }

  // 週単位ヘッダー生成
  const weeks: { label: string; leftPct: number; widthPct: number }[] = []
  const cur = new Date(ganttStart)
  // 月曜日に揃える
  cur.setDate(cur.getDate() - cur.getDay() + 1)
  while (cur.getTime() <= new Date(ganttEnd).getTime() + 7 * 86400000) {
    const wStart = cur.toISOString().split('T')[0]
    const wEnd = new Date(cur.getTime() + 7 * 86400000).toISOString().split('T')[0]
    const l = pct(wStart)
    const w = widthPct(wStart, wEnd)
    if (l < 100 && w > 0) {
      weeks.push({ label: `${cur.getMonth() + 1}/${cur.getDate()}週`, leftPct: l, widthPct: w })
    }
    cur.setDate(cur.getDate() + 7)
    if (weeks.length > 20) break
  }

  const todayPct = pct(todayStr)

  const BAR_COLORS: Record<WBSStatus, string> = {
    completed:   '#10b981',
    in_progress: '#3b82f6',
    delayed:     '#ef4444',
    not_started: '#94a3b8',
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div style={{ minWidth: 800 }}>
        {/* ヘッダー行 */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-[10px] font-medium text-slate-500">
          <div style={{ width: 220, flexShrink: 0 }} className="border-r border-slate-200 p-2">タスク</div>
          <div style={{ flex: 1, position: 'relative', height: 28 }}>
            {weeks.map((w, i) => (
              <div
                key={i}
                style={{ position: 'absolute', left: `${w.leftPct}%`, width: `${w.widthPct}%`, top: 0, bottom: 0 }}
                className="border-r border-slate-200 flex items-center px-1 overflow-hidden"
              >
                {w.label}
              </div>
            ))}
            {/* 今日の縦線（ヘッダー） */}
            {todayPct >= 0 && todayPct <= 100 && (
              <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, width: 1, background: '#0d9488', zIndex: 10 }} />
            )}
          </div>
        </div>

        {/* タスク行 */}
        {rows.map((row) => (
          <div
            key={row.id}
            className={`flex border-b border-slate-100 ${row.level === 0 ? 'bg-slate-50' : 'bg-white'}`}
            style={{ minHeight: 36 }}
          >
            {/* タスク名 */}
            <div
              style={{ width: 220, flexShrink: 0, paddingLeft: row.level === 1 ? 24 : 8 }}
              className="border-r border-slate-200 flex items-center text-[11px] py-1 pr-2"
            >
              {row.level === 1 && <span className="text-slate-400 mr-1">└</span>}
              <span className={`${row.level === 0 ? 'font-semibold text-slate-700' : 'text-slate-600'} truncate`}>
                {row.name}
              </span>
            </div>

            {/* バー */}
            <div style={{ flex: 1, position: 'relative', minHeight: 36 }}>
              {/* 今日の縦線 */}
              {todayPct >= 0 && todayPct <= 100 && (
                <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, width: 1, background: '#0d9488', opacity: 0.6, zIndex: 5 }} />
              )}
              {row.plannedStart !== '—' && (
                <>
                  {/* 予定バー（薄グレー背景） */}
                  <div
                    style={{
                      position: 'absolute',
                      left: `${pct(row.plannedStart)}%`,
                      width: `${widthPct(row.plannedStart, row.plannedEnd)}%`,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      height: row.level === 0 ? 14 : 10,
                      background: '#e2e8f0',
                      borderRadius: 4,
                      zIndex: 2,
                    }}
                  />
                  {/* 進捗バー */}
                  {row.progressPct > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${pct(row.plannedStart)}%`,
                        width: `${widthPct(row.plannedStart, row.plannedEnd) * row.progressPct / 100}%`,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        height: row.level === 0 ? 14 : 10,
                        background: BAR_COLORS[row.status],
                        borderRadius: 4,
                        zIndex: 3,
                      }}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        {/* 凡例 */}
        <div className="flex items-center gap-4 px-4 py-2 text-[10px] text-slate-500 border-t border-slate-100">
          <span className="flex items-center gap-1"><span style={{ width: 12, height: 8, background: '#e2e8f0', borderRadius: 2, display: 'inline-block' }} /> 予定</span>
          <span className="flex items-center gap-1"><span style={{ width: 12, height: 8, background: '#10b981', borderRadius: 2, display: 'inline-block' }} /> 完了</span>
          <span className="flex items-center gap-1"><span style={{ width: 12, height: 8, background: '#3b82f6', borderRadius: 2, display: 'inline-block' }} /> 進行中</span>
          <span className="flex items-center gap-1"><span style={{ width: 12, height: 8, background: '#ef4444', borderRadius: 2, display: 'inline-block' }} /> 遅延</span>
          <span className="flex items-center gap-1"><span style={{ width: 1, height: 12, background: '#0d9488', display: 'inline-block' }} /> 今日</span>
        </div>
      </div>
    </div>
  )
}

// ─── メインコンポーネント ───────────────────────────────────────────────────────

export function InfraWbsPage() {
  const [serverSnapshot, setServerSnapshot] = useState<TraineeProgressSnapshot | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'gantt'>('table')
  const startDate = getTrainingStartDate()

  const wbsRows = buildWBSRows(startDate)
  const taskRows = wbsRows.filter((r) => r.level === 0)

  const totalTasks = getTotalTaskCountForUser()
  const cleared = getTotalCleared()
  const delayedCount = taskRows.filter((r) => r.status === 'delayed').length
  const overallPct = totalTasks > 0 ? Math.round((cleared / totalTasks) * 100) : 0

  // 研修終了予定日（最後のタスクのplannedEnd）
  const lastTask = taskRows[taskRows.length - 1]
  const remainingDays = (startDate && lastTask?.plannedEnd && lastTask.plannedEnd !== '—')
    ? Math.max(0, diffDays(today(), lastTask.plannedEnd))
    : null

  // ガントチャート用: 全タスクの開始日〜終了日
  const validDates = wbsRows.filter((r) => r.plannedStart !== '—' && r.level === 0)
  const ganttStart = validDates.length > 0 ? validDates[0].plannedStart : today()
  const ganttEnd   = validDates.length > 0
    ? validDates[validDates.length - 1].plannedEnd
    : addBusinessDays(today(), 15)

  useEffect(() => {
    document.title = '研修WBS'
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

  // serverSnapshot を利用したステータス補完（将来拡張用）
  void serverSnapshot

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 text-slate-800">
      <div className="mx-auto max-w-5xl space-y-5">

        {/* ページタイトル + ビュー切替 */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-slate-500">研修管理</p>
            <h1 className="text-xl font-bold text-slate-800">研修 WBS</h1>
            {startDate && <p className="text-xs text-slate-400 mt-0.5">研修開始日: {startDate}</p>}
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              表形式
            </button>
            <button
              type="button"
              onClick={() => setViewMode('gantt')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'gantt' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              ガントチャート
            </button>
          </div>
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-medium text-slate-500 mb-1">全体進捗</p>
            <p className="text-3xl font-bold text-slate-800 tabular-nums">{overallPct}<span className="text-lg font-normal text-slate-400">%</span></p>
            <p className="text-[10px] text-slate-400 mt-1">{cleared} / {totalTasks} 課題完了</p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all" style={{ width: `${overallPct}%` }} />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-medium text-slate-500 mb-1">遅延タスク</p>
            <p className={`text-3xl font-bold tabular-nums ${delayedCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>
              {delayedCount}<span className="text-lg font-normal text-slate-400">件</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              {delayedCount > 0 ? '要対応' : '問題なし'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-medium text-slate-500 mb-1">終了予定まで</p>
            <p className="text-3xl font-bold text-slate-800 tabular-nums">
              {remainingDays !== null ? remainingDays : '—'}
              <span className="text-lg font-normal text-slate-400">日</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              {lastTask?.plannedEnd && lastTask.plannedEnd !== '—' ? `終了予定: ${lastTask.plannedEnd}` : '開始日未設定'}
            </p>
          </div>
        </div>

        {/* 開始日未設定の警告 */}
        {!startDate && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            課題1を開くと研修開始日が設定され、予定日・遅延判定が有効になります。
          </div>
        )}

        {/* ─── 表形式 ─── */}
        {viewMode === 'table' && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-3 py-2.5 font-semibold text-slate-600 w-[35%]">タスク</th>
                  <th className="text-center px-2 py-2.5 font-semibold text-slate-600 whitespace-nowrap">予定開始</th>
                  <th className="text-center px-2 py-2.5 font-semibold text-slate-600 whitespace-nowrap">予定終了</th>
                  <th className="text-center px-2 py-2.5 font-semibold text-slate-600 whitespace-nowrap hidden md:table-cell">ステータス</th>
                  <th className="text-center px-2 py-2.5 font-semibold text-slate-600 whitespace-nowrap hidden md:table-cell">進捗</th>
                  <th className="text-center px-2 py-2.5 font-semibold text-slate-600 whitespace-nowrap">遅延</th>
                  <th className="text-center px-2 py-2.5 font-semibold text-slate-600 whitespace-nowrap hidden lg:table-cell"></th>
                </tr>
              </thead>
              <tbody>
                {wbsRows.map((row) => {
                  const cfg = STATUS_CONFIG[row.status]
                  const isParent = row.level === 0
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-slate-100 ${isParent ? 'bg-slate-50/60' : 'bg-white'} ${row.status === 'delayed' ? 'bg-red-50/40' : ''}`}
                    >
                      {/* タスク名 */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5" style={{ paddingLeft: row.level === 1 ? 16 : 0 }}>
                          {row.level === 1 && <span className="text-slate-300 text-[10px]">└</span>}
                          <span className={`${isParent ? 'font-semibold text-slate-700' : 'text-slate-600'}`}>
                            {row.name}
                          </span>
                        </div>
                      </td>

                      {/* 予定開始 */}
                      <td className="px-2 py-2 text-center text-slate-500 whitespace-nowrap tabular-nums">
                        {fmtDate(row.plannedStart)}
                      </td>

                      {/* 予定終了 */}
                      <td className="px-2 py-2 text-center text-slate-500 whitespace-nowrap tabular-nums">
                        {fmtDate(row.plannedEnd)}
                      </td>

                      {/* ステータス */}
                      <td className="px-2 py-2 text-center hidden md:table-cell">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>

                      {/* 進捗バー */}
                      <td className="px-2 py-2 text-center hidden md:table-cell">
                        <div className="flex items-center gap-1.5 justify-center">
                          <div className="w-16 h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${row.progressPct}%`,
                                background: row.status === 'completed' ? '#10b981' : row.status === 'delayed' ? '#ef4444' : '#3b82f6',
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 tabular-nums w-7 text-right">{row.progressPct}%</span>
                        </div>
                      </td>

                      {/* 遅延日数 */}
                      <td className="px-2 py-2 text-center tabular-nums font-medium whitespace-nowrap">
                        {row.delayDays > 0
                          ? <span className="text-red-600">+{row.delayDays}日</span>
                          : row.status === 'completed'
                            ? <span className="text-emerald-600">完了</span>
                            : <span className="text-slate-400">—</span>
                        }
                      </td>

                      {/* リンク */}
                      <td className="px-2 py-2 text-center hidden lg:table-cell">
                        {row.path && (
                          <OpenInNewTabButton
                            url={getTrainingUrl(row.path)}
                            className="rounded-lg bg-teal-50 px-2.5 py-1 text-[10px] font-medium text-teal-700 hover:bg-teal-100 whitespace-nowrap"
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── ガントチャート ─── */}
        {viewMode === 'gantt' && (
          <>
            {startDate ? (
              <GanttChart rows={wbsRows} ganttStart={ganttStart} ganttEnd={ganttEnd} />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 text-sm">
                課題1を開くと研修開始日が設定され、ガントチャートが表示されます。
              </div>
            )}
          </>
        )}

        {/* 注記 */}
        <p className="text-[10px] text-slate-400 text-center pb-4">
          ※ 予定日は研修開始日をもとに自動計算されます。実績日（着手日・完了日）の個別記録には今後対応予定です。
        </p>
      </div>
    </div>
  )
}
