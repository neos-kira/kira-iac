import { useState } from 'react'
import { updateProfile } from '../progressApi'
import { setUserRealName } from '../auth'

type Props = {
  currentDisplayName: string
  currentEmail: string
  onClose: () => void
  onSaved: (displayName: string) => void
}

export function ProfileEditModal({ currentDisplayName, currentEmail, onClose, onSaved }: Props) {
  const [displayName, setDisplayName] = useState(currentDisplayName)
  const [email, setEmail] = useState(currentEmail)
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
    onSaved(name)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-edit-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 id="profile-edit-title" className="text-[18px] font-bold text-slate-800">
            プロフィール設定
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition-colors"
            aria-label="閉じる"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-4">
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

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-[14px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving || !displayName.trim()}
              className="flex-1 rounded-xl bg-sky-600 py-2.5 text-[14px] font-semibold text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '保存中...' : '保存する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
