interface Props {
  isOpen: boolean
  onSave: () => void
  onLeave: () => void
  onCancel: () => void
}

export function ConfirmLeaveModal({ isOpen, onSave, onLeave, onCancel }: Props) {
  if (!isOpen) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 12, padding: 32, maxWidth: 400, width: '90%', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
        <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>ページを離れますか？</p>
        <p style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>入力内容が保存されていません。</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" onClick={onSave} style={{ background: '#0d9488', color: 'white', border: 'none', width: '100%', padding: 12, borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>
            保存して戻る
          </button>
          <button type="button" onClick={onLeave} style={{ background: 'white', border: '1px solid #e5e7eb', color: '#374151', width: '100%', padding: 12, borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>
            保存せず戻る
          </button>
          <button type="button" onClick={onCancel} style={{ background: 'transparent', border: 'none', color: '#9ca3af', width: '100%', padding: 8, fontSize: 14, cursor: 'pointer' }}>
            キャンセル
          </button>
        </div>
      </div>
    </div>
  )
}
