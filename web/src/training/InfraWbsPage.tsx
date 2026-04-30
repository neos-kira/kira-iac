import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchMeInfo } from '../progressApi'
import {
  getTaskProgressList,
  getTrainingStartDate,
  TRAINING_TASKS,
  addBusinessDays,
} from './trainingWbsData'
import { OpenInNewTabButton } from '../components/OpenInNewTabButton'
import { getCurrentUsername, getCurrentDisplayName, getUserRealName } from '../auth'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'
import { fetchMyProgress, isProgressApiAvailable } from '../progressApi'
import { DashboardShell } from '../components/DashboardShell'

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

function buildWBSRows(startDate: string | null, snap?: TraineeProgressSnapshot): WBSRow[] {
  const progressList = getTaskProgressList(undefined, snap)
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

// ─── メインコンポーネント ───────────────────────────────────────────────────────

// displayMode: 'manager' = 全情報表示, 'corporate' = 予定日あり遅延なし, 'individual' = 予定日・遅延なし
type DisplayMode = 'manager' | 'corporate' | 'individual'

export function InfraWbsPage() {
  const [searchParams] = useSearchParams()
  // 管理者が ?userId=xxx で他ユーザーのWBSを確認できる
  const queryUserId = searchParams.get('userId')
  const [serverSnapshot, setServerSnapshot] = useState<TraineeProgressSnapshot | null>(null)
  // queryUserId があれば管理者閲覧モード確定。なければ auth/me から判定
  const [displayMode, setDisplayMode] = useState<DisplayMode>(queryUserId ? 'manager' : 'individual')
  const startDate = getTrainingStartDate()

  const wbsRows = buildWBSRows(startDate, serverSnapshot ?? undefined)
  const taskRows = wbsRows.filter((r) => r.level === 0)

  const delayedCount = taskRows.filter((r) => r.status === 'delayed').length

  // ── ダッシュボードと同じ serverSnapshot ベースの進捗計算（8アイテム統一ロジック）──
  const overallData = (() => {
    if (!serverSnapshot) return { pct: 0, completed: 0, total: 8 }
    const s = serverSnapshot
    const ch = Array.isArray(s.chapterProgress) ? s.chapterProgress : []
    const infra5Cleared = (s.infra5PhaseDone ?? []).length >= 5 ||
      ['s1', 's2', 's3', 's4', 's5'].every((k) => s.infra5SectionDone?.[k] === true)
    const itBasicsOk = Object.values(
      (s.itBasicsProgress ?? {}) as Record<string, { cleared: boolean }>
    ).filter((v) => v.cleared).length >= 7
    const subCleared = [
      Number(s.introStep ?? 0) >= 5 && s.introConfirmed ? 1 : 0,  // はじめに
      s.infra1Cleared ? 1 : 0,                                     // 1-1 SSH接続確認
      s.l1Cleared ? 1 : 0,                                         // 1-2 Linux30問
      ch[1]?.cleared ? 1 : 0,                                      // 2 ネットワーク基礎
      ch[2]?.cleared ? 1 : 0,                                      // 3 ファイル操作/vi
      ch[3]?.cleared ? 1 : 0,                                      // 4 シェルスクリプト
      infra5Cleared ? 1 : 0,                                       // 5 サーバー構築
      itBasicsOk ? 1 : 0,                                          // IT業界の歩き方
    ].reduce((a, b) => a + b, 0)
    return { pct: Math.round(subCleared / 8 * 100), completed: subCleared, total: 8 }
  })()
  const overallPct = overallData.pct
  const clearedCount = overallData.completed
  const totalCount = overallData.total

  // 研修終了予定日（最後のタスクのplannedEnd）
  const lastTask = taskRows[taskRows.length - 1]
  const remainingDays = (startDate && lastTask?.plannedEnd && lastTask.plannedEnd !== '—')
    ? Math.max(0, diffDays(today(), lastTask.plannedEnd))
    : null

  useEffect(() => {
    document.title = 'WBS'
  }, [])

  // queryUserId がない（自分の画面）場合: role + accountType から displayMode を決定
  useEffect(() => {
    if (queryUserId) { setDisplayMode('manager'); return }
    fetchMeInfo().then((info) => {
      if (!info) return
      if (info.role === 'manager') { setDisplayMode('manager'); return }
      setDisplayMode(info.accountType === 'corporate' ? 'corporate' : 'individual')
    })
  }, [queryUserId])

  useEffect(() => {
    if (!isProgressApiAvailable() || typeof window === 'undefined') return
    const name = (queryUserId || getCurrentUsername()).trim().toLowerCase()
    if (!name) return
    let cancelled = false
    const load = async () => {
      const snap = await fetchMyProgress(name)
      if (!cancelled && snap) setServerSnapshot(snap)
    }
    void load()
    // 管理者閲覧時はポーリングしない（自分のWBSのみ5秒ポーリング）
    if (queryUserId) return () => { cancelled = true }
    const id = window.setInterval(() => { void load() }, 5000)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [queryUserId])

  // displayName: 管理者閲覧時はqueryUserId（username）、自分の場合は本名→usernameフォールバック
  const displayName = queryUserId || getUserRealName() || getCurrentDisplayName()

  return (
    <DashboardShell>
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6 text-slate-800">
      <div className="mx-auto max-w-5xl space-y-5">

        {/* ページタイトル + ビュー切替 */}
        {queryUserId && (
          <div className="flex items-center gap-3">
            <a href="#/admin" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              ← 管理ダッシュボードに戻る
            </a>
            <span className="text-xs text-slate-500">閲覧中: <span className="font-semibold text-slate-700">{queryUserId}</span></span>
          </div>
        )}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-slate-500">研修管理</p>
            <h1 className="text-2xl font-semibold text-slate-900">WBS</h1>
            {displayName && <p className="text-xs text-slate-400 mt-0.5">研修生: {displayName}</p>}
            {startDate && <p className="text-xs text-slate-400 mt-0.5">研修開始日: {startDate}</p>}
          </div>
        </div>
        <p className="text-sm text-slate-500 mt-1 mb-4">WBS（Work Breakdown Structure）とは、研修全体のタスクと進捗を一覧で管理する表です。各タスクの完了状況を確認できます。</p>

        {/* サマリーカード */}
        {displayMode === 'individual' ? (
          /* individual: 全体進捗 のみ */
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
            <p className="text-[11px] font-medium text-slate-500 mb-1">全体進捗</p>
            <p className="text-3xl font-bold text-slate-800 tabular-nums">{overallPct}<span className="text-lg font-normal text-slate-400">%</span></p>
            <p className="text-[10px] text-slate-400 mt-1">{clearedCount} / {totalCount} ステージ完了</p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-[#2563EB] transition-all" style={{ width: `${overallPct}%` }} />
            </div>
          </div>
        ) : (
          /* manager: 3枚 / corporate: 2枚 */
          <div className={`grid gap-3 ${displayMode === 'manager' ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
              <p className="text-[11px] font-medium text-slate-500 mb-1">全体進捗</p>
              <p className="text-3xl font-bold text-slate-800 tabular-nums">{overallPct}<span className="text-lg font-normal text-slate-400">%</span></p>
              <p className="text-[10px] text-slate-400 mt-1">{clearedCount} / {totalCount} ステージ完了</p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-[#2563EB] transition-all" style={{ width: `${overallPct}%` }} />
              </div>
            </div>
            {displayMode === 'manager' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
                <p className="text-[11px] font-medium text-slate-500 mb-1">遅延タスク</p>
                <p className={`text-3xl font-bold tabular-nums ${delayedCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                  {delayedCount}<span className="text-lg font-normal text-slate-400">件</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {delayedCount > 0 ? '要対応' : '問題なし'}
                </p>
              </div>
            )}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
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
        )}

        {/* 開始日未設定の警告 */}
        {!startDate && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            課題1を開くと研修開始日が設定され、予定日・遅延判定が有効になります。
          </div>
        )}

        {/* ─── 表形式 ─── */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-3 py-2.5 font-semibold text-slate-600 w-[35%]">タスク</th>
                  {displayMode !== 'individual' && (
                    <>
                      <th className="text-center px-2 py-2.5 font-semibold text-slate-600 whitespace-nowrap">予定開始</th>
                      <th className="text-center px-2 py-2.5 font-semibold text-slate-600 whitespace-nowrap">予定終了</th>
                    </>
                  )}
                  <th className="text-center px-2 py-2.5 font-semibold text-slate-600 whitespace-nowrap hidden md:table-cell">ステータス</th>
                  <th className="text-center px-2 py-2.5 font-semibold text-slate-600 whitespace-nowrap hidden md:table-cell">進捗</th>
                  {displayMode === 'manager' && (
                    <>
                      <th className="text-center px-2 py-2.5 font-semibold text-slate-600 whitespace-nowrap">遅延</th>
                      <th className="text-center px-2 py-2.5 font-semibold text-slate-600 whitespace-nowrap">完了日</th>
                    </>
                  )}
                  <th className="text-center px-2 py-2.5 font-semibold text-slate-600 whitespace-nowrap hidden lg:table-cell"></th>
                </tr>
              </thead>
              <tbody>
                {wbsRows.map((row) => {
                  // corporate/individual では 'delayed' を 'in_progress' として扱う（赤バッジなし）
                  let displayStatus = displayMode !== 'manager' && row.status === 'delayed' ? 'in_progress' : row.status
                  // Fix2: 進捗0%かつ未完了・非遅延は「未着手」として表示
                  if (row.progressPct === 0 && displayStatus !== 'completed' && displayStatus !== 'delayed') {
                    displayStatus = 'not_started'
                  }
                  const cfg = STATUS_CONFIG[displayStatus]
                  const isParent = row.level === 0
                  // 行の背景: manager のみ赤ハイライト
                  const rowBg = isParent ? 'bg-slate-50/60' : 'bg-white'
                  const delayBg = displayMode === 'manager' && row.status === 'delayed' ? 'bg-red-50/40' : ''
                  return (
                    <tr key={row.id} className={`border-b border-slate-100 ${rowBg} ${delayBg}`}>
                      {/* タスク名 */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5" style={{ paddingLeft: row.level === 1 ? 16 : 0 }}>
                          {row.level === 1 && <span className="text-slate-300 text-[10px]">└</span>}
                          <span className={`${isParent ? 'font-semibold text-slate-700' : 'text-slate-600'}`}>
                            {row.name}
                          </span>
                        </div>
                      </td>

                      {/* 予定開始・予定終了: individual では非表示 */}
                      {displayMode !== 'individual' && (
                        <>
                          <td className="px-2 py-2 text-center text-slate-500 whitespace-nowrap tabular-nums">
                            {fmtDate(row.plannedStart)}
                          </td>
                          <td className="px-2 py-2 text-center text-slate-500 whitespace-nowrap tabular-nums">
                            {fmtDate(row.plannedEnd)}
                          </td>
                        </>
                      )}

                      {/* ステータス */}
                      <td className="px-2 py-2 text-center hidden md:table-cell">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>

                      {/* 進捗バー: corporate/individual は青統一 */}
                      <td className="px-2 py-2 text-center hidden md:table-cell">
                        <div className="flex items-center gap-1.5 justify-center">
                          <div className="w-16 h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${row.progressPct}%`,
                                background: displayMode === 'manager'
                                  ? (row.status === 'completed' ? '#10b981' : row.status === 'delayed' ? '#ef4444' : '#3b82f6')
                                  : (row.status === 'completed' ? '#10b981' : '#3b82f6'),
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 tabular-nums w-7 text-right">{row.progressPct}%</span>
                        </div>
                      </td>

                      {/* 遅延日数・完了日: manager のみ */}
                      {displayMode === 'manager' && (
                        <>
                          <td className="px-2 py-2 text-center tabular-nums font-medium whitespace-nowrap">
                            {row.delayDays > 0
                              ? <span className="text-red-600">+{row.delayDays}日</span>
                              : row.status === 'completed'
                                ? <span className="text-emerald-600">完了</span>
                                : <span className="text-slate-400">—</span>
                            }
                          </td>
                          <td className="px-2 py-2 text-center whitespace-nowrap">
                            {row.status === 'completed'
                              ? <span className="text-emerald-600 font-medium text-[11px]">✓ 完了</span>
                              : <span className="text-slate-400">—</span>
                            }
                          </td>
                        </>
                      )}

                      {/* リンク */}
                      <td className="px-2 py-2 text-center hidden lg:table-cell">
                        {row.path && (
                          <OpenInNewTabButton
                            url={getTrainingUrl(row.path)}
                            className="rounded-lg bg-sky-50 px-2.5 py-1 text-[10px] font-medium text-sky-700 hover:bg-sky-100 whitespace-nowrap"
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

        {/* 注記 */}
        <p className="text-[10px] text-slate-400 text-center pb-4">
          ※ 予定日は研修開始日をもとに自動計算されます。実績日（着手日・完了日）の個別記録には今後対応予定です。
        </p>
      </div>
    </div>
    </DashboardShell>
  )
}
