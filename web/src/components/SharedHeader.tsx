import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
import { NeOSLogo } from './NeOSLogo'
import { getCurrentDisplayName } from '../auth'
import { fetchMe } from '../progressApi'
import { ConfirmLeaveModal } from './common/ConfirmLeaveModal'
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
  const [showModal, setShowModal] = useState(false)
  const [showWbsTip, setShowWbsTip] = useState(false)
  const wbsTipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const menuContainerRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useSafeNavigate()
  const [resolvedName, setResolvedName] = useState(() => {
    const cached = getCurrentDisplayName()
    if (cached) return cached
    if (typeof window === 'undefined') return ''
    try { return window.localStorage.getItem('kira-user-display-name') ?? '' } catch { return '' }
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
    // position:sticky + z-index:Z.sticky でスタッキングコンテキストを確立し、
    // AI講師サイドパネル(z:auto)よりヘッダーおよびドロップダウンを手前に描画する
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
        <button type="button" className="relative flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-rose-500" />
        </button>
        <div className="relative" ref={menuContainerRef}>
          <button
            type="button"
            onClick={handleOpenMenu}
            className="flex items-center gap-1.5 rounded-full pl-0.5 pr-2 py-0.5 hover:bg-slate-100 transition-colors"
            title={name}
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold text-white shrink-0 ring-2 ring-[rgba(125,211,252,0.2)]"
              style={{ background: '#7dd3fc' }}
            >
              {initial || <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
            </span>
            {name && <span className="hidden sm:block text-[13px] font-medium text-slate-700 max-w-[100px] truncate">{name}</span>}
            <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showMenu && (
            <div
              className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10"
              style={{ zIndex: Z.dropdown }}
            >
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <p className="text-[10px] text-slate-400 mb-0.5 tracking-widest uppercase">ログイン中</p>
                {name && <p className="text-[14px] font-semibold text-slate-900 leading-tight truncate">{name}</p>}
              </div>
              <div className="p-1.5">
                {/* WBS リンク */}
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => { setShowMenu(false); navigate('/wbs') }}
                    className="flex-1 rounded-lg px-3 py-2 text-left text-[13px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    WBS
                  </button>
                  {/* ? アイコン */}
                  <div className="relative mr-2">
                    <button
                      type="button"
                      className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-gray-400 text-[10px] leading-none hover:border-slate-400 hover:text-slate-500 transition-colors"
                      onMouseEnter={() => {
                        if (wbsTipTimerRef.current) clearTimeout(wbsTipTimerRef.current)
                        setShowWbsTip(true)
                      }}
                      onMouseLeave={() => {
                        wbsTipTimerRef.current = setTimeout(() => setShowWbsTip(false), 200)
                      }}
                      onClick={(e) => { e.stopPropagation(); setShowWbsTip((v) => !v) }}
                      aria-label="WBSとは"
                    >
                      ?
                    </button>
                    {showWbsTip && (
                      <div
                        className="absolute shadow-lg whitespace-normal"
                        style={{ zIndex: 9999, width: 260, padding: '12px 16px', fontSize: 13, lineHeight: 1.6, borderRadius: 8, background: '#1e293b', color: '#f8fafc', right: '100%', top: 0, marginRight: 8 }}
                        onMouseEnter={() => {
                          if (wbsTipTimerRef.current) clearTimeout(wbsTipTimerRef.current)
                        }}
                        onMouseLeave={() => {
                          wbsTipTimerRef.current = setTimeout(() => setShowWbsTip(false), 200)
                        }}
                      >
                        WBS（Work Breakdown Structure）とは、プロジェクトの作業を階層的に分解して進捗を管理する表です。NICでは各課題の期限・進捗状況を一覧で確認できます。
                      </div>
                    )}
                  </div>
                </div>
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
      <ConfirmLeaveModal isOpen={showModal} onSave={handleSave} onLeave={handleLeave} onCancel={handleCancel} />
    </header>
  )
}
