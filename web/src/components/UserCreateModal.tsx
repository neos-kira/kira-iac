import { useState, useRef } from 'react'
import { createAdminUser } from '../accountsApi'

type Props = {
  onClose: () => void
  onCreated: () => void
}

function generatePassword(length = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function UserCreateModal({ onClose, onCreated }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('student')
  const [accountType, setAccountType] = useState<'corporate' | 'individual'>('individual')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [csvMode, setCsvMode] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [csvResults, setCsvResults] = useState<{ username: string; ok: boolean; error?: string }[]>([])
  const [isBulkCreating, setIsBulkCreating] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleCreate() {
    setError(null)
    setSuccess(null)
    const name = username.trim().toLowerCase()
    if (!name) { setError('ユーザー名を入力してください'); return }
    if (!/^[a-z0-9-]+$/.test(name)) { setError('ユーザー名は半角英数字とハイフンのみ使用できます'); return }
    if (!password || password.length < 8) { setError('パスワードは8文字以上必要です'); return }
    setIsCreating(true)
    const result = await createAdminUser(name, password, role, accountType)
    setIsCreating(false)
    if (result.ok) {
      setSuccess(`${name}（${role} / ${accountType === 'corporate' ? '法人' : '個人'}）を作成しました`)
      setUsername('')
      setPassword('')
      onCreated()
    } else {
      setError(result.error ?? '作成に失敗しました')
    }
  }

  async function handleBulkCreate() {
    const lines = csvText.trim().split('\n').filter((l) => l.trim() && !l.startsWith('username'))
    if (lines.length === 0) { setError('CSVにユーザーが見つかりません'); return }
    setIsBulkCreating(true)
    setCsvResults([])
    const results: { username: string; ok: boolean; error?: string }[] = []
    for (const line of lines) {
      const [uname, pass, r] = line.split(',').map((s) => s.trim())
      if (!uname || !pass) {
        results.push({ username: uname || '(空)', ok: false, error: 'ユーザー名またはパスワードが空' })
        continue
      }
      if (pass.length < 8) {
        results.push({ username: uname, ok: false, error: 'パスワードは8文字以上必要です' })
        continue
      }
      const result = await createAdminUser(uname.toLowerCase(), pass, ['student', 'manager'].includes(r) ? r : 'student')
      results.push({ username: uname, ok: result.ok, error: result.error })
    }
    setCsvResults(results)
    setIsBulkCreating(false)
    if (results.every((r) => r.ok)) onCreated()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { setCsvText(ev.target?.result as string ?? '') }
    reader.readAsText(file, 'utf-8')
  }

  function switchTab(csv: boolean) {
    setCsvMode(csv)
    setError(null)
    setSuccess(null)
    setCsvResults([])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <h2 className="text-base font-bold text-slate-800">新規ユーザー作成</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* タブ切り替え */}
        <div className="flex border-b border-slate-100 mt-4 px-6">
          <button
            type="button"
            onClick={() => switchTab(false)}
            className={`pb-2.5 mr-5 text-sm font-medium transition-colors border-b-2 -mb-px ${!csvMode ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            個別作成
          </button>
          <button
            type="button"
            onClick={() => switchTab(true)}
            className={`pb-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${csvMode ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            CSV一括登録
          </button>
        </div>

        <div className="px-6 py-5">
          {!csvMode ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">ユーザー名</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="例: kira-yamada"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                />
                <p className="mt-1 text-[11px] text-slate-400">半角英数字・ハイフンのみ</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-600">パスワード</label>
                  <button type="button" onClick={() => setPassword(generatePassword())} className="text-[11px] font-medium text-sky-500 hover:text-sky-700">
                    自動生成
                  </button>
                </div>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8文字以上"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">ロール</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-sky-400 focus:outline-none"
                  >
                    <option value="student">student（受講生）</option>
                    <option value="manager">manager（管理者）</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">区分</label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as 'corporate' | 'individual')}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-sky-400 focus:outline-none"
                  >
                    <option value="individual">個人</option>
                    <option value="corporate">法人</option>
                  </select>
                </div>
              </div>
              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
              {success && <p className="text-xs text-emerald-600 font-medium">{success}</p>}
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={isCreating}
                className="w-full rounded-xl bg-sky-500 py-2.5 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50 transition-colors"
              >
                {isCreating ? '作成中...' : 'ユーザーを作成する'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
                CSV形式: <code className="rounded bg-slate-200 px-1 font-mono">username,password,role</code><br />
                role は <code className="rounded bg-slate-200 px-1 font-mono">student</code> または <code className="rounded bg-slate-200 px-1 font-mono">manager</code>（省略時は student）
              </p>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-600">CSVファイル または 直接入力</label>
                  <button type="button" onClick={() => fileRef.current?.click()} className="text-[11px] font-medium text-sky-500 hover:text-sky-700">
                    ファイルを選択
                  </button>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
                </div>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  rows={5}
                  placeholder={'username,password,role\nkira-yamada,MyPass123,student\nkira-suzuki,Pass5678,student'}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-mono text-xs text-slate-700 focus:border-sky-400 focus:outline-none resize-none"
                />
              </div>
              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
              {csvResults.length > 0 && (
                <ul className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  {csvResults.map((r) => (
                    <li key={r.username} className={`flex items-center gap-1.5 text-xs ${r.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                      <span>{r.ok ? '✓' : '✗'}</span>
                      <span className="font-medium">{r.username}</span>
                      {!r.ok && <span className="text-red-400">— {r.error}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => void handleBulkCreate()}
                disabled={isBulkCreating || !csvText.trim()}
                className="w-full rounded-xl bg-sky-500 py-2.5 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50 transition-colors"
              >
                {isBulkCreating ? '登録中...' : '一括登録する'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
