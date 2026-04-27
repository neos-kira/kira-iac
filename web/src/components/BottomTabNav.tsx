import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
import { getCurrentRole } from '../auth'

export function BottomTabNav() {
  const location = useLocation()
  const navigate = useSafeNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const path = location.pathname
  const isManager = getCurrentRole() === 'manager'

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
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

  // メニュー項目
  const drawerItems: { label: string; icon: string }[] = []

  return (
    <div className="md:hidden">
      {/* メニュードロワー */}
      {menuOpen && (
        <>
          {/* 背景オーバーレイ（タップで閉じる） */}
          <div
            className="fixed inset-0 bg-black/20"
            style={{ zIndex: 1001 }}
            onClick={() => setMenuOpen(false)}
          />
          {/* ドロワー本体: z-[1002]でタブバー(z-1000)より前面、background完全不透明 */}
          <div
            className="fixed left-0 right-0 rounded-t-2xl shadow-lg px-4 py-3"
            style={{
              bottom: 'calc(60px + env(safe-area-inset-bottom))',
              zIndex: 1002,
              background: '#ffffff',
              paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
              borderTop: '1px solid #E2E8F0',
            }}
          >
            <div className="w-8 h-1 bg-slate-200 rounded-full mx-auto mb-3" />
            {drawerItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  showToast('現在準備中です')
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-[14px] text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition-colors"
              >
                <span className="text-[18px]">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* トースト（準備中メッセージ） */}
      {toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[13px] font-medium px-5 py-2 rounded-full shadow-lg pointer-events-none"
          style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))', zIndex: 1100 }}
        >
          {toast}
        </div>
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
            className="flex-1 flex flex-col items-center justify-center gap-0.5 pt-1"
          >
            <span style={{ color: tab.active ? '#2563EB' : '#94A3B8' }}>
              {tab.icon}
            </span>
            <span
              className="text-[10px] font-medium"
              style={{ color: tab.active ? '#2563EB' : '#94A3B8' }}
            >
              {tab.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  )
}
