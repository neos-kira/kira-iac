import { useState } from 'react'
import { updateProfile } from '../progressApi'
import { setUserRealName } from '../auth'

type Props = {
  onSaved: (displayName: string) => void
}

export function ProfileSetupModal({ onSaved }: Props) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = displayName.trim()
    if (!name) { setError('氏名を入力してください'); return }
    setSaving(true)
    setError(null)
    const ok = await updateProfile(name, email.trim() || undefined)
    setSaving(false)
    if (!ok) { setError('保存に失敗しました。もう一度お試しください'); return }
    setUserRealName(name)
    onSaved(name)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-setup-title"
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: '32px 24px',
          width: 'min(480px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
        }}
      >
        <h2
          id="profile-setup-title"
          style={{ fontSize: 18, fontWeight: 700, color: '#1E293B', marginBottom: 8 }}
        >
          はじめにプロフィールを登録してください
        </h2>
        <p style={{ fontSize: 13, color: '#64748B', marginBottom: 24, lineHeight: 1.6 }}>
          管理者が進捗確認のために使用します。研修生同士には表示されません。
        </p>

        <form onSubmit={(e) => { void handleSubmit(e) }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              氏名 <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="例：田中 太郎"
              autoComplete="name"
              style={{
                width: '100%',
                borderRadius: 12,
                border: '1px solid #CBD5E1',
                padding: '10px 14px',
                fontSize: 14,
                color: '#1E293B',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              メールアドレス{' '}
              <span style={{ fontSize: 11, fontWeight: 400, color: '#94A3B8' }}>（任意）</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="例：taro.tanaka@example.com"
              autoComplete="email"
              style={{
                width: '100%',
                borderRadius: 12,
                border: '1px solid #CBD5E1',
                padding: '10px 14px',
                fontSize: 14,
                color: '#1E293B',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <p style={{ fontSize: 12, color: '#DC2626', background: '#FEF2F2', borderRadius: 8, padding: '8px 12px', margin: 0 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !displayName.trim()}
            style={{
              width: '100%',
              borderRadius: 12,
              background: saving || !displayName.trim() ? '#93C5FD' : '#2563EB',
              color: '#fff',
              border: 'none',
              padding: '12px 0',
              fontSize: 14,
              fontWeight: 600,
              cursor: saving || !displayName.trim() ? 'not-allowed' : 'pointer',
              marginTop: 4,
            }}
          >
            {saving ? '登録中...' : '登録して始める'}
          </button>
        </form>
      </div>
    </div>
  )
}
