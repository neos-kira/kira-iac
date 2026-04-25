import { useEffect, useState, useMemo } from 'react'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
import { fetchAdminUsers, stopAllServers, deleteAdminUser, type AdminUser } from '../accountsApi'
import { UserCreateModal } from '../components/UserCreateModal'
import { ProgressDetailModal } from '../components/ProgressDetailModal'

type Filter = 'all' | 'delayed' | 'not_started' | 'running'
type Sort = 'progress_desc' | 'progress_asc' | 'login_desc'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${m}/${day} ${h}:${min}`
  } catch { return '—' }
}

function ProgressBar({ pct }: { pct: number }) {
  const color = pct <= 70 ? 'bg-amber-400' : 'bg-sky-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-xs font-medium text-slate-700">{pct}%</span>
    </div>
  )
}

function StatCard({ label, value, sub, warn }: { label: string; value: number | string; sub?: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${warn ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${warn ? 'text-amber-700' : 'text-slate-800'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

export function AdminPage() {
  const navigate = useSafeNavigate()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('progress_desc')
  const [stopAllMsg, setStopAllMsg] = useState<string | null>(null)
  const [isStoppingAll, setIsStoppingAll] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showWbsTip, setShowWbsTip] = useState(false)

  useEffect(() => {
    if (!showWbsTip) return
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-wbs-tip]')) setShowWbsTip(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [showWbsTip])

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

  // 統計
  const stats = useMemo(() => {
    const students = users.filter((u) => u.role === 'student')
    const total = students.length
    const completed = students.filter((u) => u.wbsPercent >= 100).length
    const inProgress = students.filter((u) => u.wbsPercent > 0 && u.wbsPercent < 100).length
    const running = users.filter((u) => u.ec2State === 'running' && u.ec2InstanceId).length
    return { total, completed, inProgress, running }
  }, [users])

  // フィルタ・検索・ソート
  const filtered = useMemo(() => {
    let list = users.filter((u) => u.role !== 'manager')
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((u) => u.username.toLowerCase().includes(q))
    }
    if (filter === 'delayed') list = list.filter((u) => u.delayedIds.length > 0)
    if (filter === 'not_started') list = list.filter((u) => u.wbsPercent === 0)
    if (filter === 'running') list = list.filter((u) => u.ec2State === 'running')
    if (sort === 'progress_desc') list.sort((a, b) => b.wbsPercent - a.wbsPercent)
    if (sort === 'progress_asc') list.sort((a, b) => a.wbsPercent - b.wbsPercent)
    if (sort === 'login_desc') list.sort((a, b) => (b.lastLogin ?? '').localeCompare(a.lastLogin ?? ''))
    return list
  }, [users, search, filter, sort])

  function exportCSV() {
    const headers = ['ユーザー名', 'ロール', '全体進捗(%)', '現在の課題', '最終ログイン', 'サーバー状態']
    const rows = filtered.map((u) => [
      u.username,
      u.role,
      u.wbsPercent,
      u.currentChapter,
      u.lastLogin ?? '',
      u.ec2State ?? '',
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
    const count = stats.running
    if (!window.confirm(`起動中の${count}台のサーバーを全て停止しますか？`)) return
    setIsStoppingAll(true)
    setStopAllMsg(null)
    const result = await stopAllServers()
    setIsStoppingAll(false)
    if (result.ok) {
      setStopAllMsg(`${result.stoppedCount ?? count}台のサーバーを停止しました`)
      void refresh()
    } else {
      setStopAllMsg('停止に失敗しました: ' + (result.error ?? ''))
    }
    setTimeout(() => setStopAllMsg(null), 5000)
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    if (deleteConfirmText !== deleteTarget.username) {
      setDeleteError('ユーザー名が一致しません')
      return
    }
    setIsDeleting(true)
    setDeleteError(null)
    const result = await deleteAdminUser(deleteTarget.username)
    setIsDeleting(false)
    if (result.ok) {
      setDeleteTarget(null)
      setDeleteConfirmText('')
      void refresh()
    } else {
      setDeleteError(result.error ?? '削除に失敗しました')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-base font-semibold text-slate-800">管理ダッシュボード</h1>
          <div className="flex items-center gap-2">
            {stats.running > 0 && (
              <button
                type="button"
                onClick={() => void handleStopAll()}
                disabled={isStoppingAll}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isStoppingAll ? '停止中...' : `全サーバー停止 (${stats.running}台)`}
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/admin/ai-chat-log')}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              AI会話ログ
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              ダッシュボード
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-6">
        {stopAllMsg && (
          <div className="rounded-lg bg-sky-50 border border-sky-200 px-4 py-2 text-sm text-sky-800">
            {stopAllMsg}
          </div>
        )}

        {/* 統計カード */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="総受講生数" value={stats.total} sub="名（student ロール）" />
          <StatCard
            label="完了済み"
            value={stats.completed}
            sub={stats.total ? `${Math.round((stats.completed / stats.total) * 100)}%` : '0%'}
          />
          <StatCard
            label="進行中"
            value={stats.inProgress}
            sub={stats.total ? `${Math.round((stats.inProgress / stats.total) * 100)}%` : '0%'}
          />
          <StatCard
            label="起動中サーバー"
            value={stats.running}
            sub="台（コスト発生中）"
            warn={stats.running > 0}
          />
        </div>

        {/* テーブルコントロール */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="受講生名を検索..."
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as Filter)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
            >
              <option value="all">全員</option>
              <option value="delayed">遅延者のみ</option>
              <option value="not_started">未着手のみ</option>
              <option value="running">サーバー起動中</option>
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
            >
              <option value="progress_desc">進捗順（高い順）</option>
              <option value="progress_asc">進捗順（低い順）</option>
              <option value="login_desc">最終ログイン順</option>
            </select>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={exportCSV}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                CSVエクスポート
              </button>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
              >
                + 新規ユーザー作成
              </button>
            </div>
          </div>

          {/* テーブル */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-0 md:min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 font-semibold text-slate-600">受講生名</th>
                  {/* デスクトップのみ: プログレスバー / モバイル: %数字 */}
                  <th className="px-4 py-3 font-semibold text-slate-600">
                    <span className="relative inline-flex items-center gap-1" data-wbs-tip>
                      全体進捗
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowWbsTip((v) => !v) }}
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500 hover:bg-slate-300 focus:outline-none"
                      >？</button>
                      {showWbsTip && (
                        <div className="absolute left-0 top-full z-20 mt-1 w-60 rounded-lg border border-slate-200 bg-white p-3 text-xs font-normal text-slate-600 shadow-lg">
                          WBS（Work Breakdown Structure）は研修全体のタスクと進捗を一覧で管理する表です。各タスクの完了状況を確認できます。
                        </div>
                      )}
                    </span>
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-600">現在の課題</th>
                  <th className="hidden md:table-cell px-4 py-3 font-semibold text-slate-600">最終ログイン</th>
                  <th className="hidden md:table-cell px-4 py-3 font-semibold text-slate-600">規約同意</th>
                  <th className="hidden md:table-cell px-4 py-3 font-semibold text-slate-600">サーバー</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">アクション</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">読み込み中...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      {users.length === 0 ? '受講生がまだ登録されていません' : '条件に一致するユーザーがいません'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => {
                    const isDelayed = u.delayedIds.length > 0
                    return (
                      <tr
                        key={u.username}
                        className={`border-b border-slate-100 ${isDelayed ? 'bg-amber-50/40' : 'hover:bg-slate-50/70'}`}
                      >
                        <td className="px-4 py-3 font-medium text-slate-800">{u.username}</td>
                        <td className="px-4 py-3">
                          {/* モバイル: %数字のみ / デスクトップ: プログレスバー */}
                          <span className="md:hidden tabular-nums text-xs font-medium text-slate-700">{u.wbsPercent}%</span>
                          <span className="hidden md:flex"><ProgressBar pct={u.wbsPercent} /></span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 text-xs">{u.currentChapter}</td>
                        <td className="hidden md:table-cell px-4 py-3 text-slate-600">{formatDate(u.lastLogin)}</td>
                        <td className="hidden md:table-cell px-4 py-3">
                          {u.termsAgreedAt ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                              {formatDate(u.termsAgreedAt)}
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-amber-600">未</span>
                          )}
                        </td>
                        <td className="hidden md:table-cell px-4 py-3">
                          {u.ec2State === 'running' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" /> 実行中
                            </span>
                          ) : u.ec2State === 'pending' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block animate-pulse" /> 起動中...
                            </span>
                          ) : u.ec2State === 'stopping' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block animate-pulse" /> 停止中...
                            </span>
                          ) : u.ec2State === 'stopped' ? (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 inline-block" /> 停止中
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setDetailUser(u)}
                              className="text-xs font-medium text-sky-600 hover:text-sky-800 hover:underline"
                            >
                              詳細
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/admin/wbs?userId=${u.username}`)}
                              className="hidden md:inline text-xs font-medium text-slate-600 hover:text-slate-800 hover:underline"
                            >
                              WBS
                            </button>
                            <button
                              type="button"
                              onClick={() => { setDeleteTarget(u); setDeleteConfirmText(''); setDeleteError(null) }}
                              className="hidden md:inline text-xs font-medium text-red-500 hover:text-red-700 hover:underline"
                            >
                              削除
                            </button>
                          </div>
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

      {/* 新規ユーザー作成モーダル */}
      {showCreateModal && (
        <UserCreateModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); void refresh() }}
        />
      )}

      {/* 進捗詳細モーダル */}
      {detailUser && (
        <ProgressDetailModal
          user={detailUser}
          onClose={() => setDetailUser(null)}
        />
      )}

      {/* 削除確認ダイアログ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-slate-800">ユーザーを削除しますか？</h2>
            <p className="mt-2 text-sm text-slate-600">
              ユーザー <strong>{deleteTarget.username}</strong>（{deleteTarget.role}）を削除しますか？
              <br />この操作は取り消せません。進捗データも全て削除されます。
            </p>
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                確認のためユーザー名を入力してください
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={deleteTarget.username}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
              />
            </div>
            {deleteError && (
              <p className="mt-2 text-xs text-red-600">{deleteError}</p>
            )}
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setDeleteTarget(null); setDeleteConfirmText(''); setDeleteError(null) }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteConfirm()}
                disabled={isDeleting || deleteConfirmText !== deleteTarget.username}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
