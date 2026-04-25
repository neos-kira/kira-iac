import { useEffect, useState } from 'react'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
import { fetchAdminUsers, type AdminUser } from '../accountsApi'
import { BASE_URL, buildAuthHeaders } from '../progressApi'

type LogMessage = {
  messageId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  contextPage?: string
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${m}/${day} ${h}:${min}`
  } catch { return iso }
}

async function fetchAdminChatLog(
  userId: string,
  from: string,
  to: string,
  limit = 100
): Promise<LogMessage[]> {
  try {
    const params = new URLSearchParams({ userId, limit: String(limit) })
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const res = await fetch(`${BASE_URL}/admin/ai-chat-log?${params.toString()}`, {
      headers: buildAuthHeaders(),
      credentials: 'omit',
    })
    if (!res.ok) return []
    const data = (await res.json()) as { messages?: LogMessage[] }
    return data.messages ?? []
  } catch { return [] }
}

export function AiChatLogPage() {
  const navigate = useSafeNavigate()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [selectedUser, setSelectedUser] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [messages, setMessages] = useState<LogMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    fetchAdminUsers().then((data) => {
      const students = data.filter((u) => u.role !== 'manager')
      setUsers(students)
    })
  }, [])

  async function handleSearch() {
    if (!selectedUser) return
    setLoading(true)
    setSearched(true)
    const logs = await fetchAdminChatLog(selectedUser, from, to)
    // API は新しい順 → 古い順（時系列）に並べ替え
    setMessages([...logs].reverse())
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <h1 className="text-base font-semibold text-slate-800">AI会話ログ</h1>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            ← 管理ダッシュボードに戻る
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 p-6">
        {/* フィルターバー */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">検索条件</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-600">研修生</label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 focus:border-sky-500 focus:outline-none min-w-[160px]"
              >
                <option value="">選択してください</option>
                {users.map((u) => (
                  <option key={u.username} value={u.username}>{u.username}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-600">開始日</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-600">終了日</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleSearch()}
              disabled={!selectedUser || loading}
              className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? '取得中...' : '検索'}
            </button>
            {/* エクスポートボタン（将来対応） */}
            <button
              type="button"
              disabled
              className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-400 cursor-not-allowed"
              title="将来対応予定"
            >
              エクスポート（準備中）
            </button>
          </div>
        </section>

        {/* 会話ログ一覧 */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {!searched ? (
            <div className="px-6 py-12 text-center text-sm text-slate-400">
              研修生を選択して「検索」を押してください
            </div>
          ) : loading ? (
            <div className="px-6 py-12 text-center text-sm text-slate-400">読み込み中...</div>
          ) : messages.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-400">会話履歴がありません</div>
          ) : (
            <div className="divide-y divide-slate-100">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{selectedUser}</span> の会話履歴 —
                  {messages.length} 件
                </p>
              </div>
              <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                {messages.map((m) => (
                  <div
                    key={m.messageId}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                        m.role === 'user'
                          ? 'bg-white border border-sky-200 text-slate-800'
                          : 'bg-slate-50 border border-slate-200 text-slate-700'
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-400">
                        <span>{m.role === 'user' ? '研修生' : 'AI講師'}</span>
                        <span>·</span>
                        <span>{formatDateTime(m.createdAt)}</span>
                        {m.contextPage && (
                          <>
                            <span>·</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5">{m.contextPage}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
