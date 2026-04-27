import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
import { NeOSLogo } from './NeOSLogo'
import { getCurrentDisplayName, getUserRealName } from '../auth'
import { fetchMe, fetchProfile } from '../progressApi'
import { ConfirmLeaveModal } from './common/ConfirmLeaveModal'
import { ProfileEditModal } from './ProfileEditModal'
import { Z } from '../zIndex'

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
  /** ユーザーメニューを開いたとき呼ばれる（AI講師パネルを閉じるために使用） */
  onMenuOpen?: () => void
}

export function SharedHeader({ delayed: _delayed, progressPct: _progressPct, completedCount: _completedCount, totalCount: _totalCount, onWbs: _onWbs, onLogout, isAdmin, onAdminMenu, onAccountPanel, onMenuOpen }: Props) {
  const [showMenu, setShowMenu] = useState(false)
  const [showBell, setShowBell] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showProfileEdit, setShowProfileEdit] = useState(false)
  const menuContainerRef = useRef<HTMLDivElement>(null)
  const bellContainerRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useSafeNavigate()
  const [resolvedName, setResolvedName] = useState(() => {
    const cached = getCurrentDisplayName()
    if (cached) return cached
    if (typeof window === 'undefined') return ''
    try { return window.localStorage.getItem('kira-user-display-name') ?? '' } catch { return '' }
  })
  const [realName, setRealName] = useState(getUserRealName)
  const [profileEmail, setProfileEmail] = useState('')

  useEffect(() => {
    if (resolvedName) return
    fetchMe().then((username) => {
      if (username) setResolvedName(username)
    })
  }, [resolvedName])

  const name = resolvedName
  const displayLabel = realName || name
  const initial = displayLabel ? displayLabel[0].toUpperCase() : ''
  const isTopPage = location.pathname === '/' || location.pathname === '/home'

  /** ユーザーメニュー: パネル外クリックで閉じる */
  useEffect(() => {
    if (!showMenu) return
    const onOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [showMenu])

  /** ベルドロップダウン: パネル外クリックで閉じる */
  useEffect(() => {
    if (!showBell) return
    const onOutside = (e: MouseEvent) => {
      if (bellContainerRef.current && !bellContainerRef.current.contains(e.target as Node)) {
        setShowBell(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [showBell])

  /** AI講師パネルからの相互排他イベント受信 */
  useEffect(() => {
    const close = () => setShowMenu(false)
    window.addEventListener('nic:close-user-menu', close)
    return () => window.removeEventListener('nic:close-user-menu', close)
  }, [])

  /** ESCキーでメニューを閉じる */
  useEffect(() => {
    if (!showMenu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowMenu(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showMenu])

  /** メニューを開く（相互排他: AI講師パネルを閉じる） */
  const handleOpenMenu = useCallback(() => {
    setShowMenu((v) => {
      if (!v) onMenuOpen?.()
      return !v
    })
  }, [onMenuOpen])

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
    <header
      className="flex h-14 items-center justify-between border-b bg-white/95 backdrop-blur-sm px-5 shrink-0"
      style={{ borderColor: 'rgba(14,165,233,0.15)', position: 'sticky', top: 0, zIndex: Z.sticky }}
    >
      {/* 左側: ロゴ（トップページ以外）またはスペーサー */}
      {!isTopPage ? (
        <div className="shrink-0 cursor-pointer" onClick={handleLogoClick}>
          <NeOSLogo height={40} noLink />
        </div>
      ) : (
        <div className="shrink-0 w-[40px]" />
      )}

      <div className="flex items-center gap-2">
        {isAdmin && (
          <div className="hidden sm:flex items-center gap-2 mr-1">
            {onAdminMenu && <button type="button" onClick={onAdminMenu} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">講師メニュー</button>}
            {onAccountPanel && <button type="button" onClick={onAccountPanel} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">アカウント管理</button>}
          </div>
        )}
        {/* 通知ベル */}
        <div className="relative" ref={bellContainerRef}>
          <button
            type="button"
            onClick={() => setShowBell((v) => !v)}
            className="relative flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-rose-500" />
          </button>
          {showBell && (
            <div
              className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10"
              style={{ zIndex: Z.dropdown }}
            >
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <p className="text-[11px] font-semibold text-slate-700 tracking-wide">お知らせ</p>
              </div>
              <div className="px-4 py-6 text-center">
                <p className="text-[13px] text-slate-400">現在、お知らせはありません。</p>
              </div>
            </div>
          )}
        </div>
        <div className="relative" ref={menuContainerRef}>
          <button
            type="button"
            onClick={handleOpenMenu}
            className="flex items-center gap-1.5 rounded-full pl-0.5 pr-2 py-0.5 hover:bg-slate-100 transition-colors"
            title={displayLabel}
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold text-white shrink-0 ring-2 ring-[rgba(125,211,252,0.2)]"
              style={{ background: '#7dd3fc' }}
            >
              {initial || <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
            </span>
            <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showMenu && (
            <div
              className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10"
              style={{ zIndex: Z.dropdown }}
            >
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <p className="text-[10px] text-slate-400 mb-0.5 tracking-widest uppercase">ログイン中</p>
                <p className="text-[14px] font-semibold text-slate-900 leading-tight truncate">{displayLabel || name}</p>
                {realName && name && realName !== name && (
                  <p className="text-[11px] text-slate-400 leading-tight truncate mt-0.5">@{name}</p>
                )}
              </div>
              <div className="p-1.5">
                {/* プロフィール設定 */}
                <button
                  type="button"
                  onClick={() => { setShowMenu(false); fetchProfile().then((p) => setProfileEmail(p?.email ?? '')).catch(() => {}); setShowProfileEdit(true) }}
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  プロフィール設定
                </button>
                <button
                  type="button"
                  onClick={() => { setShowMenu(false); onLogout() }}
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  ログアウト
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <ConfirmLeaveModal isOpen={showModal} onSave={handleSave} onLeave={handleLeave} onCancel={handleCancel} />
      {showProfileEdit && (
        <ProfileEditModal
          currentDisplayName={realName}
          currentEmail={profileEmail}
          onClose={() => setShowProfileEdit(false)}
          onSaved={(newName) => {
            setRealName(newName)
            setProfileEmail('')
          }}
        />
      )}
    </header>
  )
}
