import { StrictMode, useEffect, useState, useRef, Component, type ReactNode, type ErrorInfo } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { DeskOpenProvider } from './deskOpenContext'
import { AuthProvider, useAuth } from './AuthContext'
import './index.css'
import App from './App.tsx'
import { LoginPage } from './LoginPage'
import { getCurrentDisplayName, getCurrentUsername, getUserRealName, isLoggedIn, performLogout } from './auth'
import { getChatLog } from './api/aiChatApi'
import { safeGetItem, safeSetItem, safeSessionGetItem, safeSessionSetItem, safeSessionRemoveItem } from './utils/storage'
import { fetchMyProgress, postProgress, isProgressApiAvailable } from './progressApi'
import type { TraineeProgressSnapshot } from './traineeProgressStorage'
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
import { AiChatLogPage } from './admin/AiChatLogPage'
import { MentorDesk, INITIAL_MESSAGE, type ChatMessage } from './components/MentorDesk'
import { SharedHeader } from './components/SharedHeader'
import { CourseHeader } from './components/CourseHeader'
import { Z } from './zIndex'
import { NeOSLogo } from './components/NeOSLogo'
import { ITBasicsTopPage } from './training/itBasics/ITBasicsTopPage'
import { ITBasicsStudyPage } from './training/itBasics/ITBasicsStudyPage'
import { ITBasicsTestPage } from './training/itBasics/ITBasicsTestPage'
import { QuizContextProvider } from './quizContext'
import { ServerPage } from './pages/ServerPage'
import { ProgressPage } from './pages/ProgressPage'
import { BottomTabNav } from './components/BottomTabNav'

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
  '/admin/wbs': 'インフラWBS（管理者）',
  '/training/linux-level1': 'Linuxコマンド課題',
  '/training/linux-level2': 'TCP/IP課題',
}

/** サイドバー表示対象パス（ログイン・トップ以外のトレーニング/IT基礎ページ） */
function isSidebarPage(path: string): boolean {
  return path.startsWith('/training/') || path.startsWith('/it-basics')
}

function handleGlobalLogout() {
  performLogout()
}

/** DashboardShell を使うページ（max-widthラッパーを外す） */
function isShellPage(p: string): boolean {
  return p === '/wbs' || p === '/progress'
}

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

  // AI講師チャット開閉状態（alwaysOn設定から初期化）
  const [isChatOpen, setIsChatOpen] = useState(() => {
    const v = safeGetItem('nic-ai-mentor-always-on')
    if (v === null) safeSetItem('nic-ai-mentor-always-on', 'false')
    return v === 'true'
  })

  // ユーザー変更検知用: SPA ナビゲーションでユーザーが切り替わったときにチャット履歴をリセット
  const [currentUser, setCurrentUser] = useState(() => getCurrentUsername())

  // チャット履歴のsessionStorageキーをユーザー固有にする（ユーザー間の混入防止）
  const chatSessionKey = `nic-ai-mentor-session-messages-${currentUser || 'anonymous'}`
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = safeSessionGetItem(chatSessionKey)
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[]
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch { /* 復元失敗時は初期メッセージ */ }
    return [INITIAL_MESSAGE]
  })

  // ログインユーザーが変わったら即座にチャット履歴をリセット（別ユーザーの履歴漏洩防止）
  const liveUsername = getCurrentUsername()
  if (liveUsername !== currentUser) {
    // 旧ユーザーの nic-ai-mentor sessionStorage キーをすべてクリア
    try {
      Object.keys(window.sessionStorage)
        .filter((k) => k.startsWith('nic-ai-mentor'))
        .forEach((k) => window.sessionStorage.removeItem(k))
    } catch {}
    setCurrentUser(liveUsername)
    setChatMessages([INITIAL_MESSAGE])
  }

  const [courseProgressPct, setCourseProgressPct] = useState(0)
  // iOS Safari キーボード表示時の実ビューポート高さ（visualViewport API）
  const [vpHeight, setVpHeight] = useState<number | undefined>(undefined)
  // 会話履歴を sessionStorage に同期（リロード時復元用）
  useEffect(() => {
    try {
      safeSessionSetItem(chatSessionKey, JSON.stringify(chatMessages))
    } catch { /* 書き込み失敗は無視 */ }
  }, [chatMessages, chatSessionKey])

  // currentUser が変わるたびに DynamoDB から履歴を復元（ユーザー切り替え・初回マウント両対応）
  useEffect(() => {
    if (!currentUser) return undefined
    if (chatMessages.length > 1) return undefined // sessionStorage 復元済みならスキップ
    let cancelled = false
    getChatLog(currentUser, 50).then((logs) => {
      if (cancelled) return // ユーザー切り替え後に解決した古い Promise は無視
      if (logs.length === 0) return
      const restored: ChatMessage[] = logs.reverse().map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
      setChatMessages([INITIAL_MESSAGE, ...restored])
    }).catch(() => { /* 取得失敗は無視 */ })
    return () => { cancelled = true } // currentUser 変更時に古い Promise を無効化
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser])

  // nic:open-ai-panel イベントでAI講師チャットを開く
  useEffect(() => {
    const open = () => { setIsChatOpen(true); window.dispatchEvent(new CustomEvent('nic:close-user-menu')) }
    window.addEventListener('nic:open-ai-panel', open)
    return () => window.removeEventListener('nic:open-ai-panel', open)
  }, [])

  // 課題ページからの進捗バー更新
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ pct: number }>).detail
      if (typeof detail?.pct === 'number') setCourseProgressPct(detail.pct)
    }
    window.addEventListener('nic:course-progress', handler)
    return () => window.removeEventListener('nic:course-progress', handler)
  }, [])

  // iOS Safari: キーボード表示時に visualViewport.height で実ビューポート高さを追跡
  // - isMobileガードなし（全デバイスで監視、vpHeightはモバイルポップアップのみ使用）
  // - resize と scroll 両方を監視（iOS バージョンによってどちらかしか発火しない）
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const handler = () => setVpHeight(vv.height ?? window.innerHeight)
    vv.addEventListener('resize', handler)
    vv.addEventListener('scroll', handler)
    handler() // マウント時に初期値をセット
    return () => {
      vv.removeEventListener('resize', handler)
      vv.removeEventListener('scroll', handler)
    }
  }, [])

  // チャット開閉時に vpHeight を即時同期（キーボードが既に開いている場合の対応）
  useEffect(() => {
    if (!isChatOpen) return
    const height = window.visualViewport?.height ?? window.innerHeight
    setVpHeight(height)
  }, [isChatOpen])

  // AI講師ボタン 初回チュートリアルツールチップ
  // モバイルトップヘッダーのドロップダウン状態
  const [showMobileBell, setShowMobileBell] = useState(false)
  const [showMobileUserMenu, setShowMobileUserMenu] = useState(false)
  const mobileBellRef = useRef<HTMLDivElement>(null)
  const mobileUserMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showMobileBell && !showMobileUserMenu) return
    const handler = (e: MouseEvent) => {
      if (showMobileBell && mobileBellRef.current && !mobileBellRef.current.contains(e.target as Node)) setShowMobileBell(false)
      if (showMobileUserMenu && mobileUserMenuRef.current && !mobileUserMenuRef.current.contains(e.target as Node)) setShowMobileUserMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMobileBell, showMobileUserMenu])

  const [showAiTutorial, setShowAiTutorial] = useState(false)
  const aiTutorialSnapRef = useRef<TraineeProgressSnapshot | null>(null)
  const aiTutorialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!currentUser || !isLoggedIn()) return
    // ユーザー固有のローカルキー（同デバイスで別ユーザーが共用しないよう分離）
    const localKey = `nic-ai-tutorial-shown-${currentUser}`
    if (localStorage.getItem(localKey)) return // ローカルキャッシュで即スキップ

    let cancelled = false
    const showTutorial = (snap: TraineeProgressSnapshot | null) => {
      if (cancelled) return
      aiTutorialSnapRef.current = snap
      setShowAiTutorial(true)
      aiTutorialTimerRef.current = setTimeout(() => {
        if (cancelled) return
        setShowAiTutorial(false)
        localStorage.setItem(localKey, '1')
        // DynamoDB にも保存（次回別端末でも表示しない）
        if (snap && isProgressApiAvailable()) {
          postProgress(currentUser, { ...snap, aiTutorialShown: true }).catch(() => {})
        }
      }, 5000)
    }

    if (!isProgressApiAvailable()) {
      showTutorial(null)
    } else {
      fetchMyProgress(currentUser).then((snap) => {
        if (cancelled) return
        if (!snap?.aiTutorialShown) {
          showTutorial(snap)
        } else {
          localStorage.setItem(localKey, '1') // DynamoDBが既読ならローカルに同期
        }
      }).catch(() => { if (!cancelled) showTutorial(null) })
    }

    return () => {
      cancelled = true
      if (aiTutorialTimerRef.current) clearTimeout(aiTutorialTimerRef.current)
    }
  }, [currentUser])

  const dismissTutorial = () => {
    if (aiTutorialTimerRef.current) clearTimeout(aiTutorialTimerRef.current)
    setShowAiTutorial(false)
    if (currentUser) {
      const localKey = `nic-ai-tutorial-shown-${currentUser}`
      localStorage.setItem(localKey, '1')
      const snap = aiTutorialSnapRef.current
      if (snap && isProgressApiAvailable()) {
        postProgress(currentUser, { ...snap, aiTutorialShown: true }).catch(() => {})
      }
    }
  }

  if (isLogin) return <>{children}</>

  // AI浮動ボタンのbottom位置: モバイル非研修ページはBottomTabNavの上(76px)
  const btnBottom = showChat ? 24 : (isMobile ? 76 : 24)
  // AI パネルの高さ: visualViewport に応じて iOS キーボード時に縮小（最大560px・最小240px）
  const aiPanelHeight = vpHeight
    ? Math.min(560, Math.max(240, vpHeight - (isMobile && !showChat ? 104 : 56)))
    : 560

  // AI浮動ボタン（チャット未表示時のみ表示）
  const aiButton = !isChatOpen ? (
    <div style={{ position: 'fixed', bottom: btnBottom, right: 24, zIndex: Z.floatingPanel, display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* 初回チュートリアル ツールチップ */}
      {showAiTutorial && (
        <div
          className="animate-tooltip-fadeout"
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: '10px 14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: 13,
            maxWidth: 220,
            position: 'relative',
            whiteSpace: 'nowrap',
          }}
        >
          <button
            type="button"
            onClick={dismissTutorial}
            style={{ position: 'absolute', top: 6, right: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 1, color: '#94A3B8', fontSize: 12 }}
            aria-label="閉じる"
          >✕</button>
          <div style={{ fontWeight: 600, color: '#1E293B', marginBottom: 3, paddingRight: 14 }}>AI講師に質問できます</div>
          <div style={{ color: '#64748B', fontSize: 12, whiteSpace: 'normal' }}>研修に関することなら何でも聞いてください</div>
          {/* 右向き三角（ボタン方向） */}
          <div style={{
            position: 'absolute',
            right: -7,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 0,
            height: 0,
            borderTop: '7px solid transparent',
            borderBottom: '7px solid transparent',
            borderLeft: '7px solid #fff',
            filter: 'drop-shadow(1px 0 1px rgba(0,0,0,0.08))',
          }} />
        </div>
      )}
      <button
        type="button"
        onClick={() => { dismissTutorial(); setIsChatOpen(true); window.dispatchEvent(new CustomEvent('nic:close-user-menu')) }}
        title="AI講師に質問する"
        className={`w-14 h-14 rounded-full overflow-hidden shadow-lg shadow-sky-500/35 hover:scale-110 transition-transform${showAiTutorial ? ' animate-pulse-ring' : ''}`}
        style={{ border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
      >
        <img src="/ai-teacher.png" alt="AI講師" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </button>
    </div>
  ) : null

  // AIチャットポップアップ（右下固定・最大幅420px・全画面にならない）
  const aiPopup = isChatOpen ? (
    <div style={{
      position: 'fixed',
      right: 16,
      bottom: isMobile && !showChat ? 80 : 24,
      width: 'min(420px, calc(100vw - 32px))',
      height: aiPanelHeight,
      maxHeight: '80vh',
      zIndex: Z.floatingPanel,
      display: 'flex',
      flexDirection: 'column',
      background: 'white',
      borderRadius: 16,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      overflow: 'hidden',
    }}>
      <MentorDesk context={ctx} sidebar embedded onClose={() => setIsChatOpen(false)} messages={chatMessages} setMessages={setChatMessages} />
    </div>
  ) : null

  if (isTop) {
    const mobileInitial = (getUserRealName() || getCurrentDisplayName() || '?').charAt(0).toUpperCase()
    const mobileDisplayName = getCurrentDisplayName()
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', paddingBottom: isMobile ? 'calc(60px + env(safe-area-inset-bottom))' : undefined }} className="md:pb-0">
        {/* モバイルのみヘッダー（md以上はHomeDashboard内のPCサイドバーがある） */}
        <header
          className="md:hidden flex h-14 items-center justify-between border-b bg-white/95 backdrop-blur-sm px-5 shrink-0"
          style={{ borderColor: 'rgba(14,165,233,0.15)', position: 'sticky', top: 0, zIndex: Z.sticky }}
        >
          <NeOSLogo height={36} noLink />
          <div className="flex items-center gap-2">
            {/* 通知ベル */}
            <div className="relative" ref={mobileBellRef}>
              <button
                type="button"
                onClick={() => { setShowMobileBell((v) => !v); setShowMobileUserMenu(false) }}
                className="relative flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-rose-500" />
              </button>
              {showMobileBell && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10" style={{ zIndex: Z.dropdown }}>
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                    <p className="text-[11px] font-semibold text-slate-700 tracking-wide">お知らせ</p>
                  </div>
                  <div className="px-4 py-6 text-center">
                    <p className="text-[13px] text-slate-400">現在、お知らせはありません。</p>
                  </div>
                </div>
              )}
            </div>
            {/* ユーザーメニュー */}
            <div className="relative" ref={mobileUserMenuRef}>
              <button
                type="button"
                onClick={() => { setShowMobileUserMenu((v) => !v); setShowMobileBell(false) }}
                className="flex items-center gap-1.5 rounded-full pl-0.5 pr-2 py-0.5 hover:bg-slate-100 transition-colors"
              >
                <span style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#7dd3fc', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '500', flexShrink: 0 }}>
                  {mobileInitial}
                </span>
                <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showMobileUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10" style={{ zIndex: Z.dropdown }}>
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                    <p className="text-[10px] text-slate-400 mb-0.5 tracking-widest uppercase">ログイン中</p>
                    <p className="text-[14px] font-semibold text-slate-900 leading-tight truncate">{mobileDisplayName}</p>
                  </div>
                  <div className="p-1.5">
                    <button
                      type="button"
                      onClick={() => { setShowMobileUserMenu(false); handleGlobalLogout() }}
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
        </header>
        <div style={{ flex: '1 1 0', minWidth: 0 }}>{children}</div>
        {aiButton}
        {aiPopup}
        <BottomTabNav />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column', paddingBottom: (!showChat && isMobile) ? 'calc(60px + env(safe-area-inset-bottom))' : undefined }} className={!showChat ? 'md:pb-0' : ''}>
      {showChat ? (
        <CourseHeader
          onLogout={handleGlobalLogout}
          onMenuOpen={() => setIsChatOpen(false)}
          progressPct={courseProgressPct}
        />
      ) : (
        <SharedHeader
          onLogout={handleGlobalLogout}
          onMenuOpen={() => setIsChatOpen(false)}
        />
      )}
      <div style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' as const, position: 'relative' }}>
        {isShellPage(path) ? children : <div className="mx-auto max-w-5xl px-6">{children}</div>}
      </div>
      {aiButton}
      {aiPopup}
      {/* モバイルBottom Tabナビ (training以外のページ) */}
      {!showChat && <BottomTabNav />}
    </div>
  )
}
import { IntroGate } from './components/IntroGate'
// Task1Gate, Task2Gate は削除済み（ネットワーク基礎・ファイル操作・viのガードを解除）
// TODO: 仕様確定後にガードを再適用する場合は TaskGates.tsx のコンポーネントを再 import すること

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null; errorInfo: ErrorInfo | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ errorInfo: info })
    console.error('[ErrorBoundary]', error, info.componentStack)
    try {
      localStorage.setItem('__nic_last_error', JSON.stringify({
        message: error.message,
        stack: error.stack ?? '',
        componentStack: info.componentStack ?? '',
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      }))
    } catch {
      // localStorage 書き込み失敗は無視
    }
  }
  render() {
    if (this.state.hasError) {
      const err = this.state.error
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, background: '#f8fafc' }}>
          <p className="text-heading md:text-heading-pc" style={{ fontWeight: 600, color: '#1e293b' }}>表示中にエラーが発生しました</p>
          <p className="text-body md:text-body-pc" style={{ color: '#64748b', maxWidth: 400, textAlign: 'center' }}>{err?.message ?? 'Unknown error'}</p>
          <details style={{ margin: '0 0 8px', textAlign: 'left', maxWidth: 600, width: '100%' }}>
            <summary className="text-label md:text-label-pc" style={{ cursor: 'pointer', color: '#64748b', padding: '4px 0' }}>詳細情報（開発者向け）</summary>
            <pre className="text-label md:text-label-pc" style={{
              background: '#f3f4f6',
              padding: '12px',
              borderRadius: '6px',
              overflow: 'auto',
              maxHeight: '300px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              marginTop: 8,
            }}>
              {err?.stack}
              {'\n\n--- componentStack ---\n'}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
          <a
            href="/"
            className="text-button md:text-button-pc"
            style={{ background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', textDecoration: 'none' }}
          >
            トップに戻る
          </a>
        </div>
      )
    }
    return this.props.children
  }
}

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
  if (isAuthenticated) {
    return <>{children}</>
  }
  return <Navigate to="/login" replace />
}

function ManagerRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, role } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  const isManager = role === 'manager'
  if (!isManager) return <Navigate to="/" replace />
  return <>{children}</>
}

/** studentはアクセス不可・ホームにリダイレクト */
function ManagerOnlyRoute({ children }: { children: React.ReactNode }) {
  const { role } = useAuth()
  if (role === 'student') return <Navigate to="/" replace />
  return <>{children}</>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
    <HashRouter>
      <AuthProvider>
        <DeskOpenProvider>
          <QuizContextProvider>
          <LoginReloadGuard />
          <JTeradaRestrictGuard />
          <LayoutWrapper>
            <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><App /></ProtectedRoute>} />
            <Route path="/admin" element={<ManagerRoute><AdminPage /></ManagerRoute>} />
            <Route path="/admin/ai-chat-log" element={<ManagerRoute><AiChatLogPage /></ManagerRoute>} />
            <Route path="/admin/wbs" element={<ManagerRoute><InfraWbsPage /></ManagerRoute>} />
            <Route path="/wbs" element={<ProtectedRoute><ManagerOnlyRoute><InfraWbsPage /></ManagerOnlyRoute></ProtectedRoute>} />
            <Route path="/server" element={<ProtectedRoute><ServerPage /></ProtectedRoute>} />
            <Route path="/progress" element={<ProtectedRoute><ProgressPage /></ProtectedRoute>} />
            <Route path="/training/linux-level1" element={<IntroGate><LinuxLevel1Page /></IntroGate>} />
            <Route path="/training/infra-basic-1" element={<IntroGate><InfraBasic1Page /></IntroGate>} />
            <Route path="/training/infra-basic-top" element={<IntroGate><InfraBasicTopPage /></IntroGate>} />
            <Route path="/training/infra-basic-2-top" element={<IntroGate><InfraBasic2TopPage /></IntroGate>} />
            <Route path="/training/infra-basic-2-1" element={<IntroGate><InfraBasic21Page /></IntroGate>} />
            <Route path="/training/linux-level2" element={<IntroGate><LinuxLevel2Page /></IntroGate>} />
            <Route path="/training/infra-basic-3-top" element={<IntroGate><InfraBasic3TopPage /></IntroGate>} />
            <Route path="/training/infra-basic-3-1" element={<IntroGate><InfraBasic31Page /></IntroGate>} />
            <Route path="/training/infra-basic-3-2" element={<IntroGate><InfraBasic32Page /></IntroGate>} />
            <Route path="/training/infra-basic-4" element={<IntroGate><InfraBasic4Page /></IntroGate>} />
            <Route path="/training/infra-basic-5" element={<IntroGate><InfraBasic5Page /></IntroGate>} />
            <Route path="/training/intro" element={<IntroPage />} />
            <Route path="/it-basics" element={<ITBasicsTopPage />} />
            <Route path="/it-basics/:categoryId/study" element={<ITBasicsStudyPage />} />
            <Route path="/it-basics/:categoryId/test" element={<ITBasicsTestPage />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </LayoutWrapper>
          </QuizContextProvider>
        </DeskOpenProvider>
      </AuthProvider>
    </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
)
