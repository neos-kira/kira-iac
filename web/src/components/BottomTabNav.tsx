import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
import { getCurrentRole, getCurrentDisplayName, getUserRealName, performLogout } from '../auth'
import { fetchProfile } from '../progressApi'
import { ProfileEditModal } from './ProfileEditModal'

export function BottomTabNav() {
  const location = useLocation()
  const navigate = useSafeNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showProfileEdit, setShowProfileEdit] = useState(false)
  const [profileEmail, setProfileEmail] = useState('')
  const path = location.pathname
  const isManager = getCurrentRole() === 'manager'

  const displayName = getCurrentDisplayName()
  const realName = getUserRealName()
  const displayLabel = realName || displayName
  const initial = displayLabel ? displayLabel[0].toUpperCase() : '?'

  const openProfileEdit = () => {
    setMenuOpen(false)
    fetchProfile().then((p) => setProfileEmail(p?.email ?? '')).catch(() => {})
    setShowProfileEdit(true)
  }

  const allTabs = [
    {
      label: 'ホーム',
      path: '/',
      active: path === '/' || path === '/home',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      label: 'WBS',
      path: '/wbs',
      managerOnly: true,
      active: path === '/wbs',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      label: 'サーバー',
      path: '/server',
      active: path === '/server',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
      ),
    },
    {
      label: 'メニュー',
      path: null,
      active: menuOpen,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      ),
    },
  ]

  const tabs = allTabs.filter((t) => !('managerOnly' in t && t.managerOnly && !isManager))

  return (
    <div className="md:hidden">
      {/* メニュードロワー */}
      {menuOpen && (
        <>
          {/* 背景オーバーレイ */}
          <div
            className="fixed inset-0 bg-black/50"
            style={{ zIndex: 1001 }}
            onClick={() => setMenuOpen(false)}
          />
          {/* ドロワー本体 */}
          <div
            className="fixed left-0 right-0 rounded-t-2xl shadow-lg"
            style={{
              bottom: 'calc(60px + env(safe-area-inset-bottom))',
              zIndex: 1002,
              background: '#ffffff',
              borderTop: '1px solid #E2E8F0',
            }}
          >
            {/* ドラッグハンドル */}
            <div className="w-8 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1" />

            {/* ユーザー情報 */}
            <div className="flex items-center gap-3 px-5 py-4">
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#7dd3fc', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '500', flexShrink: 0 }}>
                {initial}
              </div>
              <span className="text-[15px] font-semibold text-slate-800 truncate">{displayLabel || '—'}</span>
            </div>

            <div className="h-px bg-slate-100 mx-4" />

            {/* 進捗状況 */}
            <button
              type="button"
              onClick={() => { setMenuOpen(false); navigate('/progress') }}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-left text-[14px] text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors"
            >
              <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              進捗状況
            </button>

            {/* 修了証 */}
            <button
              type="button"
              onClick={() => { setMenuOpen(false); navigate('/certificate') }}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-left text-[14px] text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors"
            >
              <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              修了証
            </button>

            <div className="h-px bg-slate-100 mx-4" />

            {/* プロフィール設定 */}
            <button
              type="button"
              onClick={openProfileEdit}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-left text-[14px] text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors"
            >
              <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              プロフィール設定
            </button>

            {/* ログアウト */}
            <button
              type="button"
              onClick={() => { setMenuOpen(false); performLogout() }}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-left text-[14px] text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
              style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              ログアウト
            </button>
          </div>
        </>
      )}

      {/* Bottom Tab Bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-[1000] bg-white border-t border-[#E2E8F0] flex"
        style={{ height: 'calc(60px + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => {
              if (tab.path) { setMenuOpen(false); navigate(tab.path) }
              else setMenuOpen((v) => !v)
            }}
            className="flex-1 flex flex-col items-center justify-center"
          >
            <span style={{ color: tab.active ? '#2563EB' : '#94A3B8' }}>
              {tab.icon}
            </span>
          </button>
        ))}
      </nav>

      {/* プロフィール編集モーダル */}
      {showProfileEdit && (
        <ProfileEditModal
          currentDisplayName={displayLabel}
          currentEmail={profileEmail}
          onClose={() => setShowProfileEdit(false)}
          onSaved={() => setShowProfileEdit(false)}
        />
      )}
    </div>
  )
}
