import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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

export function SharedHeader({ delayed, progressPct, completedCount, totalCount, onWbs, onLogout, isAdmin, onAdminMenu, onAccountPanel, onMenuOpen }: Props) {
  const [showMenu, setShowMenu] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showWBSHelp, setShowWBSHelp] = useState(false)
  const menuContainerRef = useRef<HTMLDivElement>(null)
  const wbsHelpContainerRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
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

  /** WBSヘルプ: パネル外クリックで閉じる */
  useEffect(() => {
    if (!showWBSHelp) return
    const onOutside = (e: MouseEvent) => {
      if (wbsHelpContainerRef.current && !wbsHelpContainerRef.current.contains(e.target as Node)) {
        setShowWBSHelp(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [showWBSHelp])

  /** AI講師パネルからの相互排他イベント受信 */
  useEffect(() => {
    const close = () => setShowMenu(false)
    window.addEventListener('nic:close-user-menu', close)
    return () => window.removeEventListener('nic:close-user-menu', close)
  }, [])

  /** ESCキーでメニュー / WBSヘルプを閉じる */
  useEffect(() => {
    if (!showMenu && !showWBSHelp) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowMenu(false); setShowWBSHelp(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showMenu, showWBSHelp])

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
      <div className="shrink-0" onClick={handleLogoClick} style={isTopPage ? {} : { cursor: 'pointer' }}>
        <NeOSLogo height={40} noLink />
      </div>

      <div className="flex items-center gap-3">
        {delayed !== undefined && (
          <div className="hidden sm:flex items-center gap-2 relative" ref={wbsHelpContainerRef}>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide shrink-0 ${delayed ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}
            >
              {delayed ? '遅延あり' : '遅延なし'}
            </span>
            {onWbs && (
              <button
                type="button"
                onClick={onWbs}
                className="text-[11px] font-medium text-slate-400 hover:text-slate-700 transition-colors shrink-0"
              >
                WBS →
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowWBSHelp((v) => !v)}
              className="flex items-center justify-center w-4 h-4 rounded-full border border-slate-300 text-slate-400 text-[10px] font-bold shrink-0 transition-colors hover:border-slate-400"
              title="WBSとは？"
            >
              ?
            </button>
            {showWBSHelp && (
              <div className="absolute top-full right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-slate-900 text-white p-4 shadow-xl text-[12px] leading-relaxed" style={{ zIndex: Z.dropdown }}>
                <p className="font-semibold mb-1.5" style={{ color: '#7dd3fc' }}>WBS（Work Breakdown Structure）とは？</p>
                <p className="text-slate-300">プロジェクトの作業を細かく分解して進捗を管理する表です。各課題の完了状況や遅延がひと目でわかります。</p>
                <button
                  type="button"
                  onClick={() => setShowWBSHelp(false)}
                  className="mt-2.5 text-[11px] transition-colors" style={{ color: '#7dd3fc' }}
                >
                  閉じる
                </button>
              </div>
            )}
          </div>
        )}
        {progressPct !== undefined && progressPct !== null && (
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex flex-col items-end gap-1">
              {totalCount !== undefined && completedCount !== undefined && (
                <span className="text-[10px] text-slate-400 tracking-wide">{completedCount} / {totalCount} 完了</span>
              )}
              <div className="flex items-center gap-2">
                <div className="w-20 h-1 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: '#7dd3fc' }} />
                </div>
                <span className="text-[11px] text-slate-500 tabular-nums w-7 text-right">{progressPct}%</span>
              </div>
            </div>
          </div>
        )}
        {isAdmin && (
          <div className="hidden sm:flex items-center gap-2">
            {onAdminMenu && <button type="button" onClick={onAdminMenu} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">講師メニュー</button>}
            {onAccountPanel && <button type="button" onClick={onAccountPanel} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">アカウント管理</button>}
          </div>
        )}
        <div className="relative" ref={menuContainerRef}>
          <button
            type="button"
            onClick={handleOpenMenu}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold text-white transition-colors ring-2 ring-[rgba(125,211,252,0.2)]"
            style={{ background: '#7dd3fc' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#38bdf8')}
            onMouseLeave={e => (e.currentTarget.style.background = '#7dd3fc')}
            title={name}
          >
            {initial || <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
          </button>
          {showMenu && (
            <div
              className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10 overflow-hidden"
              style={{ zIndex: Z.dropdown }}
            >
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <p className="text-[10px] text-slate-400 mb-0.5 tracking-widest uppercase">ログイン中</p>
                {name && <p className="text-[14px] font-semibold text-slate-900 leading-tight truncate">{name}</p>}
              </div>
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
      <ConfirmLeaveModal isOpen={showModal} onSave={handleSave} onLeave={handleLeave} onCancel={handleCancel} />
    </header>
  )
}
