import { useEffect, useState, useMemo } from 'react'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
import { fetchAdminUsers, stopAllServers, stopUserServer, deleteAdminUser, resetPassword, type AdminUser } from '../accountsApi'
import { UserCreateModal } from '../components/UserCreateModal'
import { ProgressDetailModal } from '../components/ProgressDetailModal'

// ─── ユーティリティ ────────────────────────────────────────

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '未ログイン'
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return '今日'
  if (days === 1) return '昨日'
  if (days < 7) return `${days}日前`
  if (days < 30) return `${Math.floor(days / 7)}週間前`
  return `${Math.floor(days / 30)}ヶ月前`
}

function needsFollowUp(u: AdminUser): boolean {
  const now = Date.now()
  const noRecentLogin = !u.lastLogin || now - new Date(u.lastLogin).getTime() > 3 * 86400 * 1000
  const staleZero = u.wbsPercent === 0 && !!u.createdAt && now - new Date(u.createdAt).getTime() > 7 * 86400 * 1000
  return noRecentLogin || staleZero
}

function isNoLoginDays(u: AdminUser, days: number): boolean {
  if (!u.lastLogin) return true
  return Date.now() - new Date(u.lastLogin).getTime() > days * 86400 * 1000
}

function getProgressBarColor(pct: number): string {
  if (pct <= 30) return 'bg-red-500'
  if (pct <= 69) return 'bg-amber-400'
  return 'bg-emerald-500'
}

function getProgressTextColor(pct: number): string {
  if (pct <= 30) return 'text-red-600'
  if (pct <= 69) return 'text-amber-600'
  return 'text-emerald-600'
}

type Filter = 'all' | 'active' | 'stopped' | 'followup'
type Sort = 'progress_desc' | 'progress_asc' | 'login_desc'
type PageSize = 10 | 20 | 0  // 0 = 全件

// ─── サブコンポーネント ───────────────────────────────────

function SummaryCard({
  icon, label, value, sub, subColor, bar,
}: {
  icon: string; label: string; value: string | number
  sub?: string; subColor?: string; bar?: number
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-800 leading-none">{value}</p>
          {sub && <p className={`mt-1 text-xs ${subColor ?? 'text-slate-400'}`}>{sub}</p>}
          {bar !== undefined && (
            <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${bar}%` }} />
            </div>
          )}
        </div>
        <span className="text-2xl ml-3 flex-shrink-0">{icon}</span>
      </div>
    </div>
  )
}

function Ec2Badge({ state }: { state: AdminUser['ec2State'] }) {
  if (state === 'running') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />稼働中
    </span>
  )
  if (state === 'pending') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block animate-pulse" />起動中
    </span>
  )
  if (state === 'stopping') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block animate-pulse" />停止中
    </span>
  )
  if (state === 'stopped') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-300 inline-block" />停止中
    </span>
  )
  return <span className="text-xs text-slate-300">—</span>
}

// ─── メインコンポーネント ─────────────────────────────────

export function AdminPage() {
  const navigate = useSafeNavigate()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('login_desc')
  const [pageSize, setPageSize] = useState<PageSize>(20)
  const [stopAllMsg, setStopAllMsg] = useState<string | null>(null)
  const [isStoppingAll, setIsStoppingAll] = useState(false)
  const [stoppingInstanceId, setStoppingInstanceId] = useState<string | null>(null)
  const [stopServerMsg, setStopServerMsg] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [pwResetTarget, setPwResetTarget] = useState<AdminUser | null>(null)
  const [pwResetNewPass, setPwResetNewPass] = useState('')
  const [pwResetConfirmPass, setPwResetConfirmPass] = useState('')
  const [pwResetError, setPwResetError] = useState<string | null>(null)
  const [pwResetSuccess, setPwResetSuccess] = useState<string | null>(null)
  const [isPwResetting, setIsPwResetting] = useState(false)

  const refresh = async () => {
    const data = await fetchAdminUsers()
    setUsers(data)
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => { void refresh() }, 10000)
    return () => window.clearInterval(id)
  }, [])

  // ─── 統計 ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const students = users.filter((u) => u.role !== 'manager')
    const total = students.length
    const running = users.filter((u) => u.ec2State === 'running' && u.ec2InstanceId).length
    const avgProgress = total > 0 ? Math.round(students.reduce((a, u) => a + u.wbsPercent, 0) / total) : 0
    const followup = students.filter(needsFollowUp).length
    return { total, running, avgProgress, followup }
  }, [users])

  // ─── フィルタ・検索・ソート ──────────────────────────────
  const filtered = useMemo(() => {
    let list = users.filter((u) => u.role !== 'manager')
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((u) => u.username.toLowerCase().includes(q))
    }
    if (filter === 'active') list = list.filter((u) => !isNoLoginDays(u, 3) && u.wbsPercent > 0)
    if (filter === 'stopped') list = list.filter((u) => isNoLoginDays(u, 3))
    if (filter === 'followup') list = list.filter(needsFollowUp)
    if (sort === 'progress_desc') list = [...list].sort((a, b) => b.wbsPercent - a.wbsPercent)
    if (sort === 'progress_asc') list = [...list].sort((a, b) => a.wbsPercent - b.wbsPercent)
    if (sort === 'login_desc') list = [...list].sort((a, b) => (b.lastLogin ?? '').localeCompare(a.lastLogin ?? ''))
    return list
  }, [users, search, filter, sort])

  const pagedList = pageSize === 0 ? filtered : filtered.slice(0, pageSize)

  // ─── アクション ─────────────────────────────────────────
  function exportCSV() {
    const headers = ['ユーザー名', 'ロール', '全体進捗(%)', '現在の課題', '最終ログイン', 'サーバー状態']
    const rows = filtered.map((u) => [
      u.username, u.role, u.wbsPercent, u.currentChapter, u.lastLogin ?? '', u.ec2State ?? '',
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trainee_progress_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleStopAll() {
    if (!window.confirm(`起動中の${stats.running}台のサーバーを全て停止しますか？`)) return
    setIsStoppingAll(true)
    setStopAllMsg(null)
    const result = await stopAllServers()
    setIsStoppingAll(false)
    if (result.ok) {
      setStopAllMsg(`${result.stoppedCount ?? stats.running}台のサーバーを停止しました`)
      void refresh()
    } else {
      setStopAllMsg('停止に失敗しました: ' + (result.error ?? ''))
    }
    setTimeout(() => setStopAllMsg(null), 5000)
  }

  async function handleStopServer(u: AdminUser) {
    if (!u.ec2InstanceId) return
    if (!window.confirm(`${u.username} のサーバーを停止しますか？`)) return
    setStoppingInstanceId(u.ec2InstanceId)
    setStopServerMsg(null)
    const result = await stopUserServer(u.ec2InstanceId)
    setStoppingInstanceId(null)
    if (result.ok) {
      setStopServerMsg(`${u.username} のサーバーを停止しました`)
      void refresh()
    } else {
      setStopServerMsg('停止に失敗しました: ' + (result.error ?? ''))
    }
    setTimeout(() => setStopServerMsg(null), 5000)
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    if (deleteConfirmText !== deleteTarget.username) { setDeleteError('ユーザー名が一致しません'); return }
    setIsDeleting(true)
    setDeleteError(null)
    const result = await deleteAdminUser(deleteTarget.username)
    setIsDeleting(false)
    if (result.ok) { setDeleteTarget(null); setDeleteConfirmText(''); void refresh() }
    else setDeleteError(result.error ?? '削除に失敗しました')
  }

  async function handlePwReset() {
    if (!pwResetTarget) return
    if (!pwResetNewPass) { setPwResetError('新しいパスワードを入力してください'); return }
    if (pwResetNewPass !== pwResetConfirmPass) { setPwResetError('パスワードが一致しません'); return }
    setIsPwResetting(true)
    setPwResetError(null)
    setPwResetSuccess(null)
    const ok = await resetPassword(pwResetTarget.username, pwResetNewPass)
    setIsPwResetting(false)
    if (ok) {
      setPwResetSuccess(`${pwResetTarget.username} のパスワードをリセットしました`)
      setPwResetNewPass('')
      setPwResetConfirmPass('')
    } else {
      setPwResetError('リセットに失敗しました')
    }
  }

  const followupCount = useMemo(() => users.filter((u) => u.role !== 'manager').filter(needsFollowUp).length, [users])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ─── ヘッダー ─── */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-none">受講生管理</h1>
            <p className="mt-0.5 text-xs text-slate-400">受講生の学習状況をリアルタイムで把握します</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {stats.running > 0 && (
              <button
                type="button"
                onClick={() => void handleStopAll()}
                disabled={isStoppingAll}
                className="rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {isStoppingAll ? '停止中...' : `全EC2停止 (${stats.running}台)`}
              </button>
            )}
            <button
              type="button"
              onClick={exportCSV}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              CSV出力
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/ai-chat-log')}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              AI会話ログ
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-600 transition-colors"
            >
              + ユーザーを追加
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 p-6">
        {/* ─── フィードバックバナー ─── */}
        {(stopAllMsg || stopServerMsg) && (
          <div className="rounded-xl bg-sky-50 border border-sky-200 px-4 py-3 text-sm text-sky-800">
            {stopAllMsg || stopServerMsg}
          </div>
        )}

        {/* ─── アラートバナー（条件付き） ─── */}
        {followupCount > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="flex-1 text-sm font-medium text-amber-800">
              要フォロー：<strong>{followupCount}名</strong>の受講生が学習を停止しています
            </p>
            <button
              type="button"
              onClick={() => setFilter('followup')}
              className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2"
            >
              対象者を確認する →
            </button>
          </div>
        )}

        {/* ─── サマリーカード ─── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryCard
            icon="👥"
            label="受講生総数"
            value={loading ? '...' : stats.total}
            sub="名（student ロール）"
          />
          <SummaryCard
            icon="📈"
            label="学習継続中"
            value={loading ? '...' : stats.running}
            sub={stats.total > 0 ? `全体の ${Math.round((stats.running / stats.total) * 100)}%` : '—'}
            subColor="text-emerald-600"
          />
          <SummaryCard
            icon="🎯"
            label="平均進捗率"
            value={loading ? '...' : `${stats.avgProgress}%`}
            sub="全受講生の平均"
            bar={stats.avgProgress}
          />
          <SummaryCard
            icon="⚠️"
            label="要フォロー"
            value={loading ? '...' : followupCount}
            sub="未ログイン3日以上"
            subColor={followupCount > 0 ? 'text-amber-600 font-medium' : 'text-slate-400'}
          />
        </div>

        {/* ─── 受講生一覧 ─── */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* コントロールバー */}
          <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-100 px-5 py-3.5">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ユーザー名を検索..."
                className="rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400 w-44"
              />
            </div>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
              {([['all', '全員'], ['active', '学習中'], ['stopped', '停止中'], ['followup', '要フォロー']] as [Filter, string][]).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setFilter(v)}
                  className={`px-3 py-1.5 transition-colors ${filter === v ? 'bg-sky-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  {label}
                  {v === 'followup' && followupCount > 0 && (
                    <span className="ml-1 rounded-full bg-amber-400 text-white text-[10px] px-1.5 py-0.5">{followupCount}</span>
                  )}
                </button>
              ))}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 focus:border-sky-400 focus:outline-none"
            >
              <option value="login_desc">最終ログイン順</option>
              <option value="progress_desc">進捗順（高→低）</option>
              <option value="progress_asc">進捗順（低→高）</option>
            </select>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-slate-400">{filtered.length}名</span>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
                {([10, 20, 0] as PageSize[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setPageSize(v)}
                    className={`px-2.5 py-1.5 transition-colors ${pageSize === v ? 'bg-sky-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {v === 0 ? '全件' : `${v}件`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* テーブル */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">受講生</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">進捗</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">現在の課題</th>
                  <th className="hidden md:table-cell px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">最終ログイン</th>
                  <th className="hidden md:table-cell px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">EC2</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">読み込み中...</td></tr>
                ) : pagedList.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">
                    {users.length === 0 ? '受講生がまだ登録されていません' : '条件に一致するユーザーがいません'}
                  </td></tr>
                ) : (
                  pagedList.map((u) => {
                    const isFollowup = needsFollowUp(u)
                    const isStaleZero = u.wbsPercent === 0 && !!u.createdAt && Date.now() - new Date(u.createdAt).getTime() > 7 * 86400 * 1000
                    const rowBg = isStaleZero ? 'bg-red-50/40' : isFollowup ? 'bg-amber-50/40' : 'hover:bg-slate-50/70'
                    const initial = u.username[0]?.toUpperCase() ?? '?'
                    const currentTask = u.lastActive?.label ?? u.currentChapter ?? '未開始'
                    return (
                      <tr key={u.username} className={`${rowBg} transition-colors`}>
                        {/* 受講生名 */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-sky-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {initial}
                            </div>
                            <span className="font-medium text-slate-800 text-sm">{u.username}</span>
                          </div>
                        </td>
                        {/* 進捗 */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${getProgressBarColor(u.wbsPercent)}`}
                                style={{ width: `${u.wbsPercent}%` }}
                              />
                            </div>
                            <span className={`text-xs font-semibold tabular-nums w-8 text-right ${getProgressTextColor(u.wbsPercent)}`}>{u.wbsPercent}%</span>
                          </div>
                        </td>
                        {/* 現在の課題 */}
                        <td className="px-5 py-3.5 text-xs text-slate-600 max-w-[160px] truncate">
                          {currentTask}
                        </td>
                        {/* 最終ログイン */}
                        <td className="hidden md:table-cell px-5 py-3.5">
                          <span className={`text-xs ${isNoLoginDays(u, 3) ? 'text-amber-600 font-medium' : 'text-slate-500'}`}>
                            {formatRelativeTime(u.lastLogin)}
                          </span>
                        </td>
                        {/* EC2 */}
                        <td className="hidden md:table-cell px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <Ec2Badge state={u.ec2State} />
                            {u.ec2State === 'running' && u.ec2InstanceId && (
                              <button
                                type="button"
                                onClick={() => void handleStopServer(u)}
                                disabled={stoppingInstanceId === u.ec2InstanceId}
                                className="rounded bg-red-50 border border-red-200 px-1.5 py-0.5 text-[10px] font-medium text-red-600 hover:bg-red-100 disabled:opacity-40 transition-colors"
                              >
                                {stoppingInstanceId === u.ec2InstanceId ? '...' : '停止'}
                              </button>
                            )}
                          </div>
                        </td>
                        {/* 操作 */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3 whitespace-nowrap">
                            <button type="button" onClick={() => setDetailUser(u)} className="text-xs font-medium text-sky-600 hover:text-sky-800 hover:underline">詳細</button>
                            <button type="button" onClick={() => navigate(`/admin/wbs?userId=${u.username}`)} className="hidden md:inline text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline">WBS</button>
                            <button type="button" onClick={() => { setPwResetTarget(u); setPwResetNewPass(''); setPwResetConfirmPass(''); setPwResetError(null); setPwResetSuccess(null) }} className="hidden md:inline text-xs font-medium text-amber-600 hover:text-amber-800 hover:underline">PW変更</button>
                            <button type="button" onClick={() => { setDeleteTarget(u); setDeleteConfirmText(''); setDeleteError(null) }} className="hidden md:inline text-xs font-medium text-red-500 hover:text-red-700 hover:underline">削除</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 件数フッター */}
          {!loading && filtered.length > 0 && (
            <div className="border-t border-slate-100 px-5 py-2.5 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {pageSize === 0 ? `全${filtered.length}名表示` : `${Math.min(pageSize, filtered.length)} / ${filtered.length}名`}
              </p>
              {pageSize !== 0 && filtered.length > pageSize && (
                <button type="button" onClick={() => setPageSize(0)} className="text-xs text-sky-600 hover:underline font-medium">
                  全件表示 ({filtered.length}名)
                </button>
              )}
            </div>
          )}
        </section>
      </main>

      {/* ─── モーダル類（既存ロジック維持） ─── */}

      {showCreateModal && (
        <UserCreateModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); void refresh() }}
        />
      )}

      {detailUser && (
        <ProgressDetailModal user={detailUser} onClose={() => setDetailUser(null)} />
      )}

      {/* パスワードリセット */}
      {pwResetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-slate-800">パスワードをリセット</h2>
            <p className="mt-1 text-sm text-slate-500">
              <strong className="text-slate-700">{pwResetTarget.username}</strong> の新しいパスワードを設定します。
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">新しいパスワード</label>
                <input type="password" value={pwResetNewPass} onChange={(e) => setPwResetNewPass(e.target.value)} placeholder="新しいパスワードを入力" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">確認（再入力）</label>
                <input type="password" value={pwResetConfirmPass} onChange={(e) => setPwResetConfirmPass(e.target.value)} placeholder="もう一度入力" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400" />
              </div>
            </div>
            {pwResetError && <p className="mt-2 text-xs text-red-600">{pwResetError}</p>}
            {pwResetSuccess && <p className="mt-2 text-xs text-emerald-600">{pwResetSuccess}</p>}
            <div className="mt-5 flex gap-2 justify-end">
              <button type="button" onClick={() => setPwResetTarget(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">閉じる</button>
              <button type="button" onClick={() => void handlePwReset()} disabled={isPwResetting || !pwResetNewPass || !pwResetConfirmPass} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50">
                {isPwResetting ? 'リセット中...' : 'リセットする'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-slate-800">ユーザーを削除しますか？</h2>
            <p className="mt-2 text-sm text-slate-500">
              <strong className="text-slate-700">{deleteTarget.username}</strong>（{deleteTarget.role}）を削除します。この操作は取り消せません。進捗データも全て削除されます。
            </p>
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">確認のためユーザー名を入力してください</label>
              <input type="text" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder={deleteTarget.username} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none" />
            </div>
            {deleteError && <p className="mt-2 text-xs text-red-600">{deleteError}</p>}
            <div className="mt-5 flex gap-2 justify-end">
              <button type="button" onClick={() => { setDeleteTarget(null); setDeleteConfirmText(''); setDeleteError(null) }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">キャンセル</button>
              <button type="button" onClick={() => void handleDeleteConfirm()} disabled={isDeleting || deleteConfirmText !== deleteTarget.username} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50">
                {isDeleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
