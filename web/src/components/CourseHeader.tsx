import { useState, useEffect, useCallback, useRef } from 'react'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
import { NeOSLogo } from './NeOSLogo'
import { getCurrentDisplayName, getUserRealName } from '../auth'
import { fetchMe } from '../progressApi'
import { Z } from '../zIndex'

type Props = {
  onLogout: () => void
  onMenuOpen?: () => void
  progressPct?: number
}

export function CourseHeader({ onLogout, onMenuOpen, progressPct = 0 }: Props) {
  const navigate = useSafeNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [resolvedName, setResolvedName] = useState(() => {
    const cached = getCurrentDisplayName()
    if (cached) return cached
    if (typeof window === 'undefined') return ''
    try { return window.localStorage.getItem('kira-user-display-name') ?? '' } catch { return '' }
  })

  useEffect(() => {
    if (resolvedName) return
    fetchMe().then((username) => { if (username) setResolvedName(username) })
  }, [resolvedName])

  const initial = (getUserRealName() || resolvedName || '?')[0].toUpperCase()

  useEffect(() => {
    if (!showMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  useEffect(() => {
    const close = () => setShowMenu(false)
    window.addEventListener('nic:close-user-menu', close)
    return () => window.removeEventListener('nic:close-user-menu', close)
  }, [])

  const handleOpenMenu = useCallback(() => {
    setShowMenu((v) => {
      if (!v) onMenuOpen?.()
      return !v
    })
  }, [onMenuOpen])

  const handleSaveAndLeave = () => {
    window.dispatchEvent(new CustomEvent('nic:save-and-leave'))
    setTimeout(() => navigate('/'), 1500)
  }

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: Z.sticky }}>
      <header
        className="flex h-14 items-center justify-between bg-white/95 backdrop-blur-sm px-5 shrink-0"
        style={{ borderBottom: '1px solid rgba(14,165,233,0.15)' }}
      >
        {/* 左: ロゴ + 課題一覧に戻る */}
        <div className="flex items-center gap-3">
          <div className="shrink-0 cursor-pointer" onClick={() => navigate('/')}>
            <NeOSLogo height={36} noLink />
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            課題一覧
          </button>
        </div>

        {/* 右: 中断して保存 + ベル + アバター */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveAndLeave}
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            中断して保存
          </button>
          {/* 通知ベル */}
          <button type="button" className="relative flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-rose-500" />
          </button>
          {/* アバター */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={handleOpenMenu}
              className="flex items-center gap-1.5 rounded-full pl-0.5 pr-2 py-0.5 hover:bg-slate-100 transition-colors"
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold text-white shrink-0 ring-2 ring-[rgba(125,211,252,0.2)]"
                style={{ background: '#7dd3fc' }}
              >
                {initial}
              </span>
              <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showMenu && (
              <div
                className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10"
                style={{ zIndex: Z.dropdown }}
              >
                <div className="p-1.5">
                  <button
                    type="button"
                    onClick={() => { setShowMenu(false); onLogout() }}
                    className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    ログアウト
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
      {/* 課題進捗バー */}
      <div className="h-[3px] bg-slate-100">
        <div
          className="h-full bg-[#2563EB] transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  )
}
