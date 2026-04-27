import { useSafeNavigate } from '../hooks/useSafeNavigate'
import { useLocation } from 'react-router-dom'
import { getCurrentRole } from '../auth'

type Props = {
  children: React.ReactNode
}

export function DashboardShell({ children }: Props) {
  const navigate = useSafeNavigate()
  const location = useLocation()
  const path = location.pathname
  const isManager = getCurrentRole() === 'manager'

  type NavItem =
    | { type: 'button'; navPath: string; label: string; icon: React.ReactNode; disabled?: false }
    | { type: 'disabled'; label: string; icon: React.ReactNode; badge: string }

  const mainNav: NavItem[] = [
    {
      type: 'button', navPath: '/', label: 'ホーム',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    ...(isManager ? [{
      type: 'button' as const, navPath: '/wbs', label: 'WBS',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    }] : []),
    {
      type: 'button', navPath: '/progress', label: '進捗状況',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      type: 'disabled', label: '修了証', badge: '準備中',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
    },
  ]

  const subNav: NavItem[] = [
    {
      type: 'button', navPath: '/server', label: '演習サーバー',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
      ),
    },
  ]

  const renderItem = (item: NavItem) => {
    if (item.type === 'disabled') {
      return (
        <button
          key={item.label}
          type="button"
          disabled
          className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-slate-400 cursor-not-allowed"
        >
          {item.icon}
          {item.label}
          <span className="ml-auto text-[10px] text-slate-300">{item.badge}</span>
        </button>
      )
    }
    const isActive = path === item.navPath
    return (
      <button
        key={item.navPath}
        type="button"
        onClick={() => navigate(item.navPath)}
        className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors
          ${isActive
            ? 'bg-sky-50 text-sky-700 font-semibold'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
      >
        {item.icon}
        {item.label}
      </button>
    )
  }

  return (
    <div className="flex w-full" style={{ minHeight: 0 }}>
      {/* サイドバー（PC固定200px・モバイル非表示） */}
      {/* top: 56px = SharedHeader h-14 の高さ */}
      <aside
        className="hidden md:flex w-[200px] flex-shrink-0 flex-col border-r border-slate-100 bg-white overflow-y-auto"
        style={{ position: 'fixed', top: 56, left: 0, bottom: 0, zIndex: 150 }}
      >
        <nav className="flex-1 px-2 pt-3 pb-3 space-y-0.5">
          {mainNav.map(renderItem)}
          <div className="my-2 border-t border-slate-100" />
          {subNav.map(renderItem)}
        </nav>
      </aside>

      {/* フロースペーサー（PC用） */}
      <div className="hidden md:block w-[200px] flex-shrink-0" />

      {/* メインコンテンツ */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}
