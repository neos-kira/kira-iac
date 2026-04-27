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
  const [userSearch, setUserSearch] = useState('')
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

  async function handleSearch(userId: string) {
    if (!userId) return
    setLoading(true)
    setSearched(true)
    const logs = await fetchAdminChatLog(userId, from, to)
    setMessages([...logs].reverse())
    setLoading(false)
  }

  function selectUser(username: string) {
    setSelectedUser(username)
    setSearched(false)
    setMessages([])
  }

  const filteredUsers = userSearch.trim()
    ? users.filter((u) => u.username.toLowerCase().includes(userSearch.trim().toLowerCase()))
    : users

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ─── ヘッダー ─── */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4 shadow-sm flex-shrink-0">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-none">AI会話ログ</h1>
            <p className="mt-0.5 text-xs text-slate-400">受講生とAI講師のやり取りを確認します</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            ← 管理ダッシュボード
          </button>
        </div>
      </header>

      {/* ─── 2カラムレイアウト ─── */}
      <div className="flex-1 flex mx-auto w-full max-w-7xl gap-0" style={{ minHeight: 0 }}>

        {/* 左ペイン: 受講生リスト */}
        <aside className="w-64 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col">
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="ユーザーを検索..."
                className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-slate-400">
                {users.length === 0 ? '読み込み中...' : '見つかりません'}
              </p>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = selectedUser === u.username
                const initial = u.username[0]?.toUpperCase() ?? '?'
                return (
                  <button
                    key={u.username}
                    type="button"
                    onClick={() => selectUser(u.username)}
                    className={`w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors border-b border-slate-50 ${isSelected ? 'bg-sky-50' : 'hover:bg-slate-50'}`}
                  >
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 ${isSelected ? 'bg-sky-500' : 'bg-slate-300'}`}>
                      {initial}
                    </div>
                    <span className={`text-sm truncate ${isSelected ? 'font-semibold text-sky-700' : 'font-medium text-slate-700'}`}>
                      {u.username}
                    </span>
                    {isSelected && (
                      <svg className="ml-auto w-4 h-4 text-sky-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* 右ペイン: ログ表示エリア */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
          {/* 日付フィルター＋検索バー */}
          <div className="border-b border-slate-200 bg-white px-5 py-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500">期間</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:border-sky-400 focus:outline-none"
              />
              <span className="text-xs text-slate-300">〜</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:border-sky-400 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleSearch(selectedUser)}
              disabled={!selectedUser || loading}
              className="rounded-lg bg-sky-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '取得中...' : '検索'}
            </button>
            {selectedUser && (
              <span className="text-xs text-slate-500">
                <strong className="text-slate-700">{selectedUser}</strong> のログ
                {searched && !loading && ` — ${messages.length}件`}
              </span>
            )}
            <button
              type="button"
              disabled
              className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-300 cursor-not-allowed"
              title="将来対応予定"
            >
              エクスポート（準備中）
            </button>
          </div>

          {/* 会話ログ */}
          <div className="flex-1 overflow-y-auto p-5">
            {!selectedUser ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-3">💬</div>
                  <p className="text-sm font-medium text-slate-500">左から受講生を選択してください</p>
                </div>
              </div>
            ) : !searched ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <p className="text-sm text-slate-400">「検索」を押して会話ログを表示します</p>
                </div>
              </div>
            ) : loading ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-slate-400">読み込み中...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-slate-400">この期間のログはありません</p>
              </div>
            ) : (
              <div className="space-y-3 max-w-3xl mx-auto">
                {messages.map((m) => (
                  <div
                    key={m.messageId}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {m.role === 'assistant' && (
                      <div className="h-7 w-7 rounded-full bg-teal-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mr-2 mt-0.5">AI</div>
                    )}
                    <div className={`max-w-[75%] ${m.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          m.role === 'user'
                            ? 'bg-sky-100 text-slate-800 rounded-tr-sm'
                            : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400 px-1">
                        <span>{m.role === 'user' ? '受講生' : 'AI講師'}</span>
                        <span>·</span>
                        <span>{formatDateTime(m.createdAt)}</span>
                        {m.contextPage && (
                          <>
                            <span>·</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">{m.contextPage}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {m.role === 'user' && (
                      <div className="h-7 w-7 rounded-full bg-slate-300 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ml-2 mt-0.5">
                        {selectedUser[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
