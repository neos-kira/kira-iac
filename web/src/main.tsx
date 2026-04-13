import { StrictMode, useEffect, useState, useRef, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { DeskOpenProvider } from './deskOpenContext'
import { AuthProvider, useAuth } from './AuthContext'
import './index.css'
import App from './App.tsx'
import { LoginPage } from './LoginPage'
import { getCurrentDisplayName, isLoggedIn } from './auth'
import { safeGetItem, safeSetItem, safeRemoveItem, safeSessionGetItem, safeSessionSetItem, safeSessionRemoveItem, clearCookieValue } from './utils/storage'
import { isJTerada } from './specialUsers'
import { isTask1Cleared } from './training/trainingWbsData'
import { LinuxLevel1Page } from './training/LinuxLevel1Page'
import { LinuxLevel2Page } from './training/LinuxLevel2Page'
import { InfraBasic1Page } from './training/InfraBasic1Page'
import { InfraBasicTopPage } from './training/InfraBasicTopPage'
import { InfraBasic2TopPage } from './training/InfraBasic2TopPage'
import { InfraBasic21Page } from './training/InfraBasic21Page'
import { InfraBasic3TopPage } from './training/InfraBasic3TopPage'
import { InfraBasic31Page } from './training/InfraBasic31Page'
import { InfraBasic32Page } from './training/InfraBasic32Page'
import { InfraBasic4Page } from './training/InfraBasic4Page'
import { InfraBasic5Page } from './training/InfraBasic5Page'
import { InfraWbsPage } from './training/InfraWbsPage'
import { IntroPage } from './training/IntroPage'
import { AdminPage } from './admin/AdminPage'
import { MentorDesk, INITIAL_MESSAGE, type ChatMessage } from './components/MentorDesk'
import { SharedHeader } from './components/SharedHeader'
import { ITBasicsTopPage } from './training/itBasics/ITBasicsTopPage'
import { ITBasicsStudyPage } from './training/itBasics/ITBasicsStudyPage'
import { ITBasicsTestPage } from './training/itBasics/ITBasicsTestPage'

const MENTOR_CONTEXT_MAP: Record<string, string> = {
  '/training/intro': 'はじめに',
  '/training/infra-basic-top': 'インフラ基礎課題1',
  '/training/infra-basic-1': 'インフラ基礎課題1-1',
  '/training/infra-basic-2-top': 'インフラ基礎課題2',
  '/training/infra-basic-2-1': 'インフラ基礎課題2-1',
  '/training/infra-basic-3-top': 'インフラ基礎課題3',
  '/training/infra-basic-3-1': 'インフラ基礎課題3-1',
  '/training/infra-basic-3-2': 'インフラ基礎課題3-2',
  '/training/infra-basic-4': 'インフラ基礎課題4',
  '/training/infra-basic-5': 'インフラ基礎課題5',
  '/training/infra-wbs': 'インフラWBS',
  '/training/linux-level1': 'Linuxコマンド課題',
  '/training/linux-level2': 'TCP/IP課題',
}

/** サイドバー表示対象パス（ログイン・トップ以外のトレーニング/IT基礎ページ） */
function isSidebarPage(path: string): boolean {
  return path.startsWith('/training/') || path.startsWith('/it-basics')
}

/** AI講師チャット（トグル式・レスポンシブ対応） */
// MentorDeskToggle は LayoutWrapper 内に統合されたため削除


function handleGlobalLogout() {
  safeRemoveItem('kira-session-token')
  safeRemoveItem('kira-user-logged-in')
  safeRemoveItem('kira-user-display-name')
  clearCookieValue('kira-session-token')
  clearCookieValue('kira-user-logged-in')
  window.location.hash = '#/login'
  window.location.reload()
}

const NAV_HEIGHT = 64 // h-16 = 64px

function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const path = location.pathname
  const isLogin = path === '/login'
  const isTop = path === '/'
  const showChat = isSidebarPage(path)
  const ctx = MENTOR_CONTEXT_MAP[path] ?? ''

  console.log(`[LayoutWrapper] render, path=${path}, isLogin=${isLogin}`)

  const [isMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(pointer: coarse)').matches : false
  )
  const [isWide, setIsWide] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 900 : true
  )
  const [isAiOpen, setIsAiOpen] = useState(true)
  const [isBottomBarOpen, setIsBottomBarOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])

  // リサイズ: サイドパネル幅（安全なストレージアクセス）
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = safeGetItem('aiPanelWidth')
    return saved ? Math.max(240, Math.min(600, Number(saved))) : 320
  })
  // リサイズ: ボトムパネル高さ（安全なストレージアクセス）
  const [panelHeight, setPanelHeight] = useState(() => {
    if (typeof window === 'undefined') return 400
    const saved = safeGetItem('aiPanelHeight')
    return saved ? Math.max(200, Math.min(window.innerHeight * 0.8, Number(saved))) : window.innerHeight * 0.6
  })
  const isDragging = useRef(false)

  const startDragX = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      const w = Math.max(240, Math.min(600, window.innerWidth - ev.clientX))
      setPanelWidth(w)
    }
    const onUp = () => {
      isDragging.current = false
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setPanelWidth((w) => { safeSetItem('aiPanelWidth', String(w)); return w })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const startDragY = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'row-resize'
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      const maxH = window.innerHeight * 0.8
      const h = Math.max(200, Math.min(maxH, window.innerHeight - ev.clientY - 48))
      setPanelHeight(h)
    }
    const onUp = () => {
      isDragging.current = false
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setPanelHeight((h) => { safeSetItem('aiPanelHeight', String(h)); return h })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  useEffect(() => {
    if (isMobile) return
    const h = () => setIsWide(window.innerWidth >= 900)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [isMobile])

  if (isLogin) return <>{children}</>
  if (isTop) return <>{children}</>

  // モード判定
  const showSidePanel = showChat && !isMobile && isWide
  const showBottomBar = showChat && !isMobile && !isWide
  const showMobile = showChat && isMobile

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
      <SharedHeader onLogout={handleGlobalLogout} />
      <div style={{ display: 'flex', flex: 1, paddingBottom: showBottomBar ? 48 : 0 }}>
        {/* メインコンテンツ */}
        <div style={{ flex: '1 1 0', minWidth: 0, wordBreak: 'break-word' as const, position: 'relative' }}>
          <div className="mx-auto max-w-5xl px-6">{children}</div>
        </div>

        {/* モード1: サイドパネル（pointer:fine & width>=900px） */}
        {showSidePanel && isAiOpen && (
          <div style={{ flex: `0 0 ${panelWidth}px`, flexShrink: 0, display: 'flex', flexDirection: 'row', background: 'white', height: `calc(100vh - ${NAV_HEIGHT}px)`, position: 'sticky', top: NAV_HEIGHT }}>
            <div onMouseDown={startDragX} style={{ width: 4, cursor: 'col-resize', background: 'transparent', flexShrink: 0, transition: 'background 0.15s' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#0d9488' }} onMouseLeave={(e) => { if (!isDragging.current) (e.currentTarget as HTMLElement).style.background = 'transparent' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e5e7eb', minWidth: 0 }}>
              <MentorDesk context={ctx} sidebar embedded onClose={() => setIsAiOpen(false)} messages={chatMessages} setMessages={setChatMessages} />
            </div>
          </div>
        )}
        {showSidePanel && !isAiOpen && (
          <button
            type="button"
            onClick={() => setIsAiOpen(true)}
            title="AI講師に質問する"
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(13,148,136,0.4)',
              zIndex: 201,
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)'
              e.currentTarget.style.boxShadow = '0 6px 18px rgba(13,148,136,0.55)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(13,148,136,0.4)'
            }}
          >
            🎓
          </button>
        )}
      </div>

      {/* モード2: ボトムバー（pointer:fine & width<900px） */}
      {showBottomBar && (
        <>
          {/* 展開パネル */}
          {isBottomBarOpen && (
            <div style={{ position: 'fixed', bottom: 48, left: 0, right: 0, height: panelHeight, display: 'flex', flexDirection: 'column', background: 'white', borderTop: '1px solid #e5e7eb', zIndex: 100, boxShadow: '0 -4px 16px rgba(0,0,0,0.08)' }}>
              <div onMouseDown={startDragY} style={{ height: 4, cursor: 'row-resize', background: 'transparent', flexShrink: 0, transition: 'background 0.15s' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#0d9488' }} onMouseLeave={(e) => { if (!isDragging.current) (e.currentTarget as HTMLElement).style.background = 'transparent' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <MentorDesk context={ctx} sidebar embedded onClose={() => setIsBottomBarOpen(false)} messages={chatMessages} setMessages={setChatMessages} />
              </div>
            </div>
          )}
          {/* 固定バー */}
          <div
            onClick={() => setIsBottomBarOpen((v) => !v)}
            style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 48, background: 'white', borderTop: '1px solid #e5e7eb', zIndex: 101, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#0d9488' }}
          >
            <span style={{ fontSize: 18 }}>🎓</span> AI講師 <span style={{ fontSize: 12, color: '#9ca3af' }}>{isBottomBarOpen ? '▼' : '▲'}</span>
          </div>
        </>
      )}

      {/* モード3: モバイル 🎓ボタン */}
      {showMobile && !isChatOpen && (
        <button type="button" onClick={() => setIsChatOpen(true)} style={{ position: 'fixed', bottom: 24, right: 24, width: 52, height: 52, borderRadius: '50%', background: '#0d9488', color: 'white', border: 'none', cursor: 'pointer', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 201 }}>
          🎓
        </button>
      )}

      {/* モード3: モバイル ボトムシート */}
      {showMobile && isChatOpen && (
        <>
          <style>{`
            .mobile-chat-panel {
              position: fixed;
              left: 0;
              right: 0;
              bottom: 0;
              height: 60dvh;
              max-height: 80dvh;
              display: flex;
              flex-direction: column;
              background: white;
              border-radius: 16px 16px 0 0;
              z-index: 200;
              box-shadow: 0 -4px 24px rgba(0,0,0,0.12);
            }
          `}</style>
          <div onClick={() => setIsChatOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 150 }} />
          <div className="mobile-chat-panel">
            <MentorDesk context={ctx} sidebar embedded onClose={() => setIsChatOpen(false)} messages={chatMessages} setMessages={setChatMessages} />
          </div>
        </>
      )}
    </div>
  )
}
import { IntroGate } from './components/IntroGate'
import { Task1Gate, Task2Gate } from './components/TaskGates'

function getDisplayName(): string {
  return getCurrentDisplayName()
}

/** j-terada が課題1クリア後はトップ以外のルートにアクセスさせず "/" へリダイレクトする */
function JTeradaRestrictGuard() {
  const loc = useLocation()
  const pathname = loc.pathname.replace(/^\/+/, '') || '/'
  if (pathname === 'login' || pathname === '') return null
  if (!isLoggedIn()) return null
  const name = getDisplayName()
  if (!isJTerada(name) || !isTask1Cleared()) return null
  return <Navigate to="/" replace />
}

function LoginReloadGuard() {
  const loc = useLocation()
  useEffect(() => {
    if (import.meta.env.DEV) return
    if (typeof window === 'undefined') return

    // ログインページ・トップページでは何もしない（HashRouter対応）
    const hash = window.location.hash || ''
    if (hash === '' || hash === '#/' || hash === '#/login' || hash.startsWith('#/login?')) return

    const pathname = (loc.pathname || '').replace(/^\/+/, '') || '/'
    if (pathname === 'login' || pathname === '') return

    // 安全なストレージアクセスを使用
    const loggedIn = isLoggedIn()
    if (loggedIn) {
      safeSessionRemoveItem('kira-login-reload-tried')
      return
    }

    const hasCookieToken = document.cookie.includes('kira-session-token=')
    const hasToken = !!safeGetItem('kira-session-token') || hasCookieToken
    const tried = safeSessionGetItem('kira-login-reload-tried') === '1'

    if (hasToken && !tried) {
      safeSessionSetItem('kira-login-reload-tried', '1')
      window.location.reload()
    }
  }, [loc.pathname])
  return null
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (import.meta.env.DEV || isAuthenticated) {
    return <>{children}</>
  }
  return <Navigate to="/login" replace />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <DeskOpenProvider>
          <LoginReloadGuard />
          <JTeradaRestrictGuard />
          <LayoutWrapper>
            <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><App /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/training/linux-level1" element={<IntroGate><LinuxLevel1Page /></IntroGate>} />
            <Route path="/training/infra-basic-1" element={<IntroGate><InfraBasic1Page /></IntroGate>} />
            <Route path="/training/infra-basic-top" element={<IntroGate><InfraBasicTopPage /></IntroGate>} />
            <Route path="/training/infra-basic-2-top" element={<IntroGate><Task1Gate><InfraBasic2TopPage /></Task1Gate></IntroGate>} />
            <Route path="/training/infra-basic-2-1" element={<IntroGate><Task1Gate><InfraBasic21Page /></Task1Gate></IntroGate>} />
            <Route path="/training/linux-level2" element={<IntroGate><Task1Gate><LinuxLevel2Page /></Task1Gate></IntroGate>} />
            <Route path="/training/infra-basic-3-top" element={<IntroGate><Task1Gate><Task2Gate><InfraBasic3TopPage /></Task2Gate></Task1Gate></IntroGate>} />
            <Route path="/training/infra-basic-3-1" element={<IntroGate><Task1Gate><Task2Gate><InfraBasic31Page /></Task2Gate></Task1Gate></IntroGate>} />
            <Route path="/training/infra-basic-3-2" element={<IntroGate><Task1Gate><Task2Gate><InfraBasic32Page /></Task2Gate></Task1Gate></IntroGate>} />
            <Route path="/training/infra-basic-4" element={<IntroGate><InfraBasic4Page /></IntroGate>} />
            <Route path="/training/infra-basic-5" element={<IntroGate><InfraBasic5Page /></IntroGate>} />
            <Route path="/training/infra-wbs" element={<InfraWbsPage />} />
            <Route path="/training/intro" element={<IntroPage />} />
            <Route path="/it-basics" element={<ITBasicsTopPage />} />
            <Route path="/it-basics/:categoryId/study" element={<ITBasicsStudyPage />} />
            <Route path="/it-basics/:categoryId/test" element={<ITBasicsTestPage />} />
            </Routes>
          </LayoutWrapper>
        </DeskOpenProvider>
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
)
