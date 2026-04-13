import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { NeOSLogo } from './NeOSLogo'
import { getCurrentDisplayName } from '../auth'
import { fetchMe } from '../progressApi'
import { ConfirmLeaveModal } from './common/ConfirmLeaveModal'

type Props = {
  delayed?: boolean
  progressPct?: number | null
  completedCount?: number
  totalCount?: number
  onWbs?: () => void
  onLogout: () => void
  isAdmin?: boolean
  onAdminMenu?: () => void
  onAccountPanel?: () => void
}

export function SharedHeader({ delayed, progressPct, completedCount, totalCount, onWbs, onLogout, isAdmin, onAdminMenu, onAccountPanel }: Props) {
  const [showMenu, setShowMenu] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const [resolvedName, setResolvedName] = useState(() => {
    const cached = getCurrentDisplayName()
    if (cached) return cached
    // LoginPageで保存したキーから直接読む
    return (typeof window !== 'undefined' ? window.localStorage.getItem('kira-user-display-name') : null) ?? ''
  })
  useEffect(() => {
    if (resolvedName) return
    fetchMe().then((username) => {
      if (username) setResolvedName(username)
    })
  }, [resolvedName])
  const name = resolvedName
  const initial = name ? name[0].toUpperCase() : ''
  const isTopPage = location.pathname === '/' || location.pathname === '/home'

  const handleLogoClick = () => {
    if (isTopPage) return
    const formScope = document.querySelector('[data-form-scope="task"]')
    const hasInput = formScope?.getAttribute('data-form-dirty') === 'true'
    if (hasInput) {
      setShowModal(true)
    } else {
      navigate('/')
    }
  }

  const handleSave = () => {
    window.dispatchEvent(new CustomEvent('nic:save-and-leave'))
    setShowModal(false)
    setTimeout(() => navigate('/'), 1500)
  }
  const handleLeave = () => { setShowModal(false); navigate('/') }
  const handleCancel = () => { setShowModal(false) }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shrink-0">
      <div className="shrink-0" onClick={handleLogoClick} style={isTopPage ? {} : { cursor: 'pointer' }}>
        <NeOSLogo height={48} noLink />
      </div>

      <div className="flex items-center gap-3">
        {delayed !== undefined && onWbs && (
          <button
            type="button"
            onClick={onWbs}
            className={`hidden sm:inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium text-white shrink-0 ${delayed ? 'bg-rose-500' : 'bg-emerald-500'}`}
            title={delayed ? '研修進捗に遅延があります' : '研修開始から現在までの期間に対して、進捗が予定通りです'}
            style={{ cursor: 'help' }}
          >
            {delayed ? '遅延あり' : '遅延なし'}
          </button>
        )}
        {progressPct !== undefined && progressPct !== null && (
          <div className="hidden sm:flex items-center gap-2">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              {totalCount !== undefined && completedCount !== undefined && (
                <span style={{ fontSize: 11, color: '#6b7280' }}>研修進捗　{completedCount} / {totalCount} 完了</span>
              )}
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-24 overflow-hidden" style={{ height: 10, borderRadius: 5, background: '#e2e8f0' }}>
                  <span className="block h-full rounded-full bg-teal-500 transition-all" style={{ width: `${progressPct}%`, borderRadius: 5 }} />
                </span>
                <span style={{ fontSize: 11, color: '#6b7280' }}>{progressPct}%</span>
              </div>
            </div>
          </div>
        )}
        {isAdmin && (
          <div className="hidden sm:flex items-center gap-2">
            {onAdminMenu && <button type="button" onClick={onAdminMenu} className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200">講師メニュー</button>}
            {onAccountPanel && <button type="button" onClick={onAccountPanel} className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200">アカウント管理</button>}
          </div>
        )}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-sm font-bold text-white hover:bg-teal-600"
            title={name}
          >
            {initial || <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-slate-200 bg-white shadow-md">
                <div style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                  <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 2 }}>ログイン中</p>
                  {name && <p style={{ fontSize: 16, fontWeight: 600, color: '#111827', lineHeight: 1.4 }} className="truncate">{name}</p>}
                </div>
                <div style={{ padding: 4 }}>
                  <button
                    type="button"
                    onClick={() => { setShowMenu(false); onLogout() }}
                    className="w-full rounded-md px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                  >
                    ログアウト
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <ConfirmLeaveModal isOpen={showModal} onSave={handleSave} onLeave={handleLeave} onCancel={handleCancel} />
    </header>
  )
}
