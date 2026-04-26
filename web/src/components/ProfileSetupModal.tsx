import { useState } from 'react'
import { updateProfile } from '../progressApi'
import { setUserRealName } from '../auth'

type Props = {
  onComplete: (displayName: string) => void
}

export function ProfileSetupModal({ onComplete }: Props) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = displayName.trim()
    if (!name) { setError('本名を入力してください'); return }
    setSaving(true)
    setError(null)
    const ok = await updateProfile(name, email.trim() || undefined)
    setSaving(false)
    if (!ok) { setError('保存に失敗しました。もう一度お試しください'); return }
    setUserRealName(name)
    onComplete(name)
  }

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-setup-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl">
        <h2 id="profile-setup-title" className="text-[20px] font-bold text-slate-800 leading-tight">
          はじめに本名を登録してください
        </h2>
        <p className="mt-2 text-[13px] text-slate-500 leading-relaxed">
          管理者があなたの進捗を確認するために使用します。研修生同士には表示されません。
        </p>

        <form onSubmit={(e) => { void handleSubmit(e) }} className="mt-5 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
              本名 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="例：田中 太郎"
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-[14px] text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              autoComplete="name"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
              メールアドレス <span className="text-[11px] font-normal text-slate-400">（任意）</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="例：taro.tanaka@example.com"
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-[14px] text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              autoComplete="email"
            />
          </div>

          {error && (
            <p className="text-[12px] text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving || !displayName.trim()}
            className="w-full rounded-xl bg-sky-600 py-3 text-[14px] font-semibold text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '登録中...' : '登録して始める'}
          </button>
        </form>
      </div>
    </div>
  )
}
