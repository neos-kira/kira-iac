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
    const result = await createAdminUser(name, password, role)
    setIsCreating(false)
    if (result.ok) {
      setSuccess(`ユーザー ${name}（${role}）を作成しました`)
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
    const allOk = results.every((r) => r.ok)
    if (allOk) onCreated()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { setCsvText(ev.target?.result as string ?? '') }
    reader.readAsText(file, 'utf-8')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">新規ユーザー作成</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"
          >
            閉じる
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => { setCsvMode(false); setError(null); setSuccess(null) }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${!csvMode ? 'bg-teal-600 text-white' : 'border border-slate-300 text-slate-700'}`}
          >
            個別作成
          </button>
          <button
            type="button"
            onClick={() => { setCsvMode(true); setError(null); setSuccess(null) }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${csvMode ? 'bg-teal-600 text-white' : 'border border-slate-300 text-slate-700'}`}
          >
            CSVで一括登録
          </button>
        </div>

        {!csvMode ? (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">ユーザー名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="例: kira-yamada"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <p className="mt-0.5 text-[11px] text-slate-400">半角英数字・ハイフンのみ</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-600">パスワード</label>
                <button
                  type="button"
                  onClick={() => setPassword(generatePassword())}
                  className="text-[11px] text-teal-600 hover:underline"
                >
                  自動生成
                </button>
              </div>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8文字以上"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">ロール</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              >
                <option value="student">student（受講生）</option>
                <option value="manager">manager（管理者）</option>
              </select>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            {success && <p className="text-xs text-teal-700">{success}</p>}
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={isCreating}
              className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {isCreating ? '作成中...' : '作成する'}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-slate-500">
              CSV形式: <code className="rounded bg-slate-100 px-1">username,password,role</code>
              <br />role は student または manager（省略時は student）
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">CSVファイル</label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="text-xs text-slate-600"
              />
            </div>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={6}
              placeholder={'username,password,role\nkira-yamada,MyPass123,student\nkira-suzuki,Pass5678,student'}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs focus:border-teal-500 focus:outline-none"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            {csvResults.length > 0 && (
              <ul className="space-y-1 text-xs">
                {csvResults.map((r) => (
                  <li key={r.username} className={`flex items-center gap-1 ${r.ok ? 'text-teal-700' : 'text-red-600'}`}>
                    <span>{r.ok ? '✓' : '✗'}</span>
                    <span>{r.username}</span>
                    {!r.ok && <span>— {r.error}</span>}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => void handleBulkCreate()}
              disabled={isBulkCreating || !csvText.trim()}
              className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {isBulkCreating ? '登録中...' : '一括登録する'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
