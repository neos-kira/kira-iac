import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useSafeNavigate } from '../hooks/useSafeNavigate'

export function BottomTabNav() {
  const location = useLocation()
  const navigate = useSafeNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const path = location.pathname

  const tabs = [
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

  return (
    <>
      {/* メニュードロワー */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-[160] bg-black/20"
            onClick={() => setMenuOpen(false)}
          />
          <div className="fixed bottom-[60px] left-0 right-0 z-[170] bg-white border-t border-[#E2E8F0] rounded-t-2xl shadow-lg px-4 py-3"
            style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
          >
            <div className="w-8 h-1 bg-slate-200 rounded-full mx-auto mb-3" />
            {[
              { label: 'お知らせ', icon: '🔔', disabled: true },
              { label: 'ヘルプセンター', icon: '❓', disabled: true },
              { label: 'お問い合わせ', icon: '✉️', disabled: true },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-[14px] text-slate-400 cursor-not-allowed"
              >
                <span className="text-[18px]">{item.icon}</span>
                {item.label}
                <span className="ml-auto text-[11px] text-slate-300">準備中</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Bottom Tab Bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-[155] bg-white border-t border-[#E2E8F0] flex"
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
    </>
  )
}
