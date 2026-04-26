import { useState } from 'react'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
import { getCurrentRole, getCurrentDisplayName } from '../auth'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'
import { NeOSLogo } from './NeOSLogo'
import { VI_STEPS, SHELL_QUESTIONS } from '../training/InfraBasic4Data'
import { isProgressApiAvailable, postProgress } from '../progressApi'

function getTrainingUrl(path: string) {
  const base =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname || '/'}`.replace(/\/$/, '') ||
        window.location.origin
      : ''
  return `${base}#${path}`
}

function isKiraTestUser(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return getCurrentDisplayName().trim().toLowerCase() === 'kira-test'
  } catch {
    return false
  }
}

type Props = {
  serverSnapshot: TraineeProgressSnapshot | null
  isSnapLoaded: boolean
  progressPct: { pct: number; completed: number; total: number } | null
  isIntroCompleted: boolean
  setShowIntroRequiredPopup: React.Dispatch<React.SetStateAction<boolean>>
}

type TabKey = 'all' | 'linux' | 'aws' | 'windows' | 'network' | 'security' | 'db' | 'dev'

const TAB_LABELS: Record<TabKey, string> = {
  all: 'すべて', linux: 'Linux', aws: 'AWS', windows: 'Windows',
  network: 'ネットワーク', security: 'セキュリティ', db: 'データベース', dev: '開発',
}

export function HomeDashboard({
  serverSnapshot,
  isSnapLoaded,
  progressPct,
  isIntroCompleted,
  setShowIntroRequiredPopup,
}: Props) {
  const navigate = useSafeNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const username = getCurrentDisplayName()
  const isManager = getCurrentRole() === 'manager'
  const snap = serverSnapshot
  const canAccessAll = isKiraTestUser()

  // ─── 進捗派生値 ───────────────────────────────────────────
  const introOk = isIntroCompleted
  const introStep = Number(snap?.introStep ?? 0)
  const infra1Ok = snap?.infra1Cleared === true && snap?.l1Cleared === true
  const l2Done = snap?.l2CurrentQuestion ?? 0
  const infra2Ok = l2Done >= 10 && introOk
  const infra3Ok = Object.values(snap?.infra32Answers ?? {}).some((v) => v && String(v).trim())
  const infra4ViDone = (snap?.infra4ViDoneSteps ?? []).length
  const infra4ShellDone = (snap?.infra4ShellDoneQuestions ?? []).length
  const infra4Ok = infra4ViDone >= VI_STEPS.length && infra4ShellDone >= SHELL_QUESTIONS.length
  const infra4Active = infra4ViDone > 0 || infra4ShellDone > 0
  const infra5PhaseDone = (snap?.infra5PhaseDone ?? []).length
  const infra5Ok = infra5PhaseDone >= 5
  const infra5Active = infra5PhaseDone > 0
  const itClearedCount = Object.values(
    (snap?.itBasicsProgress ?? {}) as Record<string, { cleared: boolean }>,
  ).filter((v) => v.cleared).length
  const itOk = itClearedCount >= 7
  const itActive = itClearedCount > 0

  // ─── ステップ一覧 ─────────────────────────────────────────
  type StepStatus = 'done' | 'active' | 'todo'
  type StepItem = {
    no: number; name: string; sub: string; status: StepStatus
    progress: number | null; progressLabel: string | null
    action: () => void; tab: TabKey | 'all'
  }

  const steps: StepItem[] = [
    {
      no: 1, name: 'はじめに', sub: '行動基準・セキュリティ基礎',
      status: introOk ? 'done' : (introStep >= 1 ? 'active' : 'todo'),
      progress: introOk ? 100 : introStep > 0 ? Math.round((introStep / 5) * 100) : null,
      progressLabel: introStep > 0 && !introOk ? `${introStep} / 5ステップ` : null,
      action: () => navigate('/training/intro'), tab: 'all',
    },
    {
      no: 2, name: 'Linux基本操作・コマンド', sub: 'ツール操作・Linuxコマンド30問',
      status: infra1Ok ? 'done' : (
        (snap?.infra1Checkboxes ?? []).some(Boolean) ||
        (snap?.l1CurrentPart ?? 0) > 0 ||
        (snap?.l1CurrentQuestion ?? 0) > 0
          ? 'active' : 'todo'
      ),
      progress: infra1Ok ? 100 : null, progressLabel: null,
      action: () => { if (introOk || canAccessAll) window.open(getTrainingUrl('/training/infra-basic-top'), '_blank'); else setShowIntroRequiredPopup(true) },
      tab: 'linux',
    },
    {
      no: 3, name: 'ネットワーク基礎', sub: 'ネットワーク実践・TCP/IP10問',
      status: infra2Ok ? 'done' : (l2Done > 0 ? 'active' : 'todo'),
      progress: infra2Ok ? 100 : l2Done > 0 ? Math.round((l2Done / 10) * 100) : null,
      progressLabel: l2Done > 0 && !infra2Ok ? `${l2Done} / 10問` : null,
      action: () => { if (introOk || canAccessAll) window.open(getTrainingUrl('/training/infra-basic-2-top'), '_blank'); else setShowIntroRequiredPopup(true) },
      tab: 'network',
    },
    {
      no: 4, name: 'ファイル操作・viエディタ', sub: 'OS/仮想化/クラウド解説・記述チェック',
      status: infra3Ok ? 'done' : (Object.keys(snap?.infra32Answers ?? {}).length > 0 ? 'active' : 'todo'),
      progress: infra3Ok ? 100 : null, progressLabel: null,
      action: () => { if (introOk || canAccessAll) window.open(getTrainingUrl('/training/infra-basic-3-top'), '_blank'); else setShowIntroRequiredPopup(true) },
      tab: 'linux',
    },
    {
      no: 5, name: 'シェルスクリプト', sub: 'vi演習・シェルスクリプト演習',
      status: infra4Ok ? 'done' : (infra4Active ? 'active' : 'todo'),
      progress: infra4Ok ? 100 : infra4Active ? Math.round(((infra4ViDone + infra4ShellDone) / (VI_STEPS.length + SHELL_QUESTIONS.length)) * 100) : null,
      progressLabel: infra4Active && !infra4Ok ? `vi: ${infra4ViDone}/${VI_STEPS.length}  シェル: ${infra4ShellDone}/${SHELL_QUESTIONS.length}` : null,
      action: () => { if (introOk || canAccessAll) window.open(getTrainingUrl('/training/infra-basic-4'), '_blank'); else setShowIntroRequiredPopup(true) },
      tab: 'linux',
    },
    {
      no: 6, name: 'サーバー構築（Ubuntu）', sub: 'OS設定・ディスク・apache2・AIDE・PostgreSQL',
      status: infra5Ok ? 'done' : (infra5Active ? 'active' : 'todo'),
      progress: infra5Ok ? 100 : infra5Active ? Math.round((infra5PhaseDone / 5) * 100) : null,
      progressLabel: infra5Active && !infra5Ok ? `${infra5PhaseDone} / 5フェーズ` : null,
      action: () => { if (introOk || canAccessAll) window.open(getTrainingUrl('/training/infra-basic-5'), '_blank'); else setShowIntroRequiredPopup(true) },
      tab: 'linux',
    },
    {
      no: 7, name: 'IT業界の歩き方', sub: 'IT業界の基礎知識',
      status: itOk ? 'done' : (itActive ? 'active' : 'todo'),
      progress: itOk ? 100 : itActive ? Math.round((itClearedCount / 7) * 100) : null,
      progressLabel: itActive && !itOk ? `${itClearedCount} / 7項目` : null,
      action: () => navigate('/it-basics'), tab: 'all',
    },
  ]

  const filteredSteps =
    activeTab === 'all' ? steps :
    activeTab === 'linux' ? steps.filter((s) => s.tab === 'linux') :
    activeTab === 'network' ? steps.filter((s) => s.tab === 'network') :
    []

  // ─── 今やる課題カード ─────────────────────────────────────
  type CurrentTask = {
    taskName: string; subtaskName: string; progress: number | null
    progressLabel: string | null; estimatedTime: string
    action: () => void; actionLabel: string
  }
  let currentTask: CurrentTask | null = null
  if (isSnapLoaded && snap) {
    if (snap.lastActive) {
      const la = snap.lastActive
      const m = la.label.match(/(\d+)\/(\d+)/)
      const done2 = m ? parseInt(m[1]) : null
      const total2 = m ? parseInt(m[2]) : null
      const fullLabel = la.label.replace(/\s*\d+\/\d+問$/, '').trim()
      const courseBase = fullLabel.includes('・') ? fullLabel.split('・')[0] : fullLabel
      const partName = fullLabel.includes('・') ? fullLabel.split('・').slice(1).join('・') : ''
      currentTask = {
        taskName: courseBase, subtaskName: partName || fullLabel,
        progress: done2 !== null && total2 !== null ? Math.round((done2 / total2) * 100) : null,
        progressLabel: done2 !== null && total2 !== null ? `${done2} / ${total2}問` : null,
        estimatedTime: '',
        action: () => { if (isIntroCompleted) window.open(getTrainingUrl(la.path), '_blank'); else setShowIntroRequiredPopup(true) },
        actionLabel: '続きから再開する ▶',
      }
    } else if (introStep === 0) {
      currentTask = { taskName: 'はじめに', subtaskName: 'プロフェッショナルとしての行動基準を確認', progress: 0, progressLabel: null, estimatedTime: '約30分', action: () => navigate('/training/intro'), actionLabel: 'はじめに ▶' }
    } else if (introStep >= 1 && introStep <= 4) {
      currentTask = { taskName: 'はじめに', subtaskName: `Step ${introStep + 1} / 5`, progress: Math.round((introStep / 5) * 100), progressLabel: `${introStep} / 5ステップ`, estimatedTime: '約30分', action: () => navigate('/training/intro'), actionLabel: '続きから ▶' }
    } else {
      const l1Part = snap.l1CurrentPart ?? 0
      const l1Q = snap.l1CurrentQuestion ?? 0
      const l1InProgress = (l1Part > 0 || l1Q > 0) && !(snap.l1Cleared ?? false)
      const infra1InProgress = (snap.infra1Checkboxes ?? []).some(Boolean) && !(snap.infra1Cleared ?? false)
      const l2Q = snap.l2CurrentQuestion ?? 0
      const infra32InProgress = Object.values(snap.infra32Answers ?? {}).some((v) => v && String(v).trim())
      const vi4Done = (snap.infra4ViDoneSteps ?? []).length
      const shell4Done = (snap.infra4ShellDoneQuestions ?? []).length
      if (l1InProgress) {
        const partLabels = ['基本操作', 'サーバー構築', '実践問題']
        currentTask = { taskName: 'Linuxコマンド30問', subtaskName: `Part ${l1Part + 1}: ${partLabels[l1Part] ?? '基本操作'}`, progress: Math.round((l1Q / 10) * 100), progressLabel: `${l1Q} / 10問`, estimatedTime: '約1時間', action: () => { if (isIntroCompleted) window.open(getTrainingUrl('/training/linux-level1'), '_blank'); else setShowIntroRequiredPopup(true) }, actionLabel: '続きから再開する ▶' }
      } else if (infra1InProgress) {
        currentTask = { taskName: 'SSH接続確認', subtaskName: 'インフラ基礎課題 1', progress: null, progressLabel: null, estimatedTime: '約1時間', action: () => { if (isIntroCompleted) window.open(getTrainingUrl('/training/infra-basic-top'), '_blank'); else setShowIntroRequiredPopup(true) }, actionLabel: '続きから再開する ▶' }
      } else if (l2Q > 0) {
        currentTask = { taskName: 'TCP/IP 理解度チェック', subtaskName: 'ネットワーク基礎', progress: Math.round((l2Q / 10) * 100), progressLabel: `${l2Q} / 10問`, estimatedTime: '約1時間', action: () => { if (isIntroCompleted) window.open(getTrainingUrl('/training/linux-level2'), '_blank'); else setShowIntroRequiredPopup(true) }, actionLabel: '続きから再開する ▶' }
      } else if (infra32InProgress) {
        currentTask = { taskName: 'OS・仮想化・クラウド理解度チェック', subtaskName: 'インフラ基礎課題 3', progress: null, progressLabel: null, estimatedTime: '約1時間', action: () => { if (isIntroCompleted) window.open(getTrainingUrl('/training/infra-basic-3-top'), '_blank'); else setShowIntroRequiredPopup(true) }, actionLabel: '続きから再開する ▶' }
      } else if (vi4Done > 0 && vi4Done < VI_STEPS.length) {
        currentTask = { taskName: 'viエディタ演習', subtaskName: 'インフラ基礎課題 4', progress: Math.round((vi4Done / VI_STEPS.length) * 100), progressLabel: `${vi4Done} / ${VI_STEPS.length}ステップ`, estimatedTime: '約1時間', action: () => { if (isIntroCompleted) window.open(getTrainingUrl('/training/infra-basic-4'), '_blank'); else setShowIntroRequiredPopup(true) }, actionLabel: '続きから再開する ▶' }
      } else if (shell4Done > 0 && shell4Done < SHELL_QUESTIONS.length) {
        currentTask = { taskName: 'シェルスクリプト演習', subtaskName: 'インフラ基礎課題 4', progress: Math.round((shell4Done / SHELL_QUESTIONS.length) * 100), progressLabel: `${shell4Done} / ${SHELL_QUESTIONS.length}問`, estimatedTime: '約1時間', action: () => { if (isIntroCompleted) window.open(getTrainingUrl('/training/infra-basic-4'), '_blank'); else setShowIntroRequiredPopup(true) }, actionLabel: '続きから再開する ▶' }
      }
    }
  }

  // ─── カレンダー ───────────────────────────────────────────
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const studyDates = new Set<number>()
  if (snap?.updatedAt) {
    try {
      const d = new Date(snap.updatedAt)
      if (d.getFullYear() === year && d.getMonth() === month) studyDates.add(d.getDate())
    } catch { /* ignore */ }
  }

  // ─── 連続学習日数 (updatedAt基準の簡易計算) ──────────────
  const streakDays = snap?.updatedAt ? (() => {
    try {
      const last = new Date(snap.updatedAt)
      return Math.floor((today.getTime() - last.getTime()) / 86400000) <= 1 ? 1 : 0
    } catch { return 0 }
  })() : 0

  // ─── 総学習時間目安 ───────────────────────────────────────
  const completedCount = progressPct?.completed ?? 0
  const totalEstHours = completedCount * 3

  return (
    <div className="flex flex-1 w-full" style={{ minHeight: 0 }}>
      {/* ═══════════════════════════════════════════════════════
          左サイドバー PC固定200px
      ═══════════════════════════════════════════════════════ */}
      {sidebarOpen && (
        <>
          {/* fixed サイドバー：ビューポート左上原点から描画（ロゴが y=0 に来る） */}
          <aside
            className="hidden md:flex w-[200px] flex-shrink-0 flex-col h-screen border-r border-slate-100 bg-white overflow-y-auto"
            style={{ position: 'fixed', top: 0, left: 0, zIndex: 150 }}
          >
          {/* ロゴ */}
          <div className="flex items-start px-4 pb-3">
            <NeOSLogo height={40} noLink />
          </div>

          {/* ナビ */}
          <nav className="flex-1 px-2 pb-3 space-y-0.5">
            <button type="button" onClick={() => navigate('/')} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold bg-sky-50 text-sky-700">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              ホーム
            </button>
            {isManager && (
              <button type="button" onClick={() => navigate('/wbs')} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                WBS
              </button>
            )}
            <button type="button" onClick={() => navigate('/progress')} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              進捗状況
            </button>
            <button type="button" disabled className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-slate-400 cursor-not-allowed">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
              修了証
              <span className="ml-auto text-[10px] text-slate-300">準備中</span>
            </button>

            <div className="my-2 border-t border-slate-100" />

            <button type="button" onClick={() => navigate('/server')} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
              演習サーバー
            </button>
            <button type="button" disabled className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-slate-400 cursor-not-allowed">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              お知らせ
            </button>
            <button type="button" disabled className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-slate-400 cursor-not-allowed">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              ヘルプセンター
            </button>
            <button type="button" disabled className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-slate-400 cursor-not-allowed">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              お問い合わせ
            </button>
          </nav>

          {/* サイドバーを閉じる（アイコンのみ） */}
          <div className="px-3 py-3 border-t border-slate-100">
            <button type="button" onClick={() => setSidebarOpen(false)} className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" title="サイドバーを閉じる">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
            </button>
          </div>
        </aside>
          {/* フローの中に幅スペーサーを置いてコンテンツをアサイドの右に押し出す */}
          <div className="hidden md:block w-[200px] flex-shrink-0" />
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          メインコンテンツ
      ═══════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="px-4 md:px-8 py-5 md:py-6 max-w-[1200px] mx-auto space-y-5 md:space-y-6">

          {/* サイドバー再表示ボタン (PC・非表示時のみ) */}
          {!sidebarOpen && (
            <button type="button" onClick={() => setSidebarOpen(true)} className="hidden md:flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] text-slate-500 hover:bg-slate-50">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
              メニューを表示
            </button>
          )}

          {/* manager限定: 進捗リセット */}
          {isManager && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm('すべての進捗データをリセットしますか？\n（この操作は元に戻せません）')) return
                  const uname = getCurrentDisplayName()
                  if (!uname || !isProgressApiAvailable()) { alert('リセットできませんでした。'); return }
                  try {
                    await postProgress(uname, {
                      introConfirmed: false, introAt: null, introStep: 0, introRiskAnswers: {},
                      wbsPercent: 0, chapterProgress: [], currentDay: 0, delayedIds: [],
                      updatedAt: new Date().toISOString(), pins: [],
                      infra1Checkboxes: [], infra1Cleared: false, l1CurrentPart: 0, l1CurrentQuestion: 0, l1Cleared: false,
                      l2CurrentQuestion: 0, infra32Answers: {}, infra4ViDoneSteps: [], infra4ShellDoneQuestions: [],
                      infra5PhaseDone: [], infra5BuildDone: [], infra5TroubleDone: [], infra5SecDone: [],
                    })
                    alert('進捗をリセットしました。ページをリロードします。')
                    window.location.reload()
                  } catch { alert('リセットに失敗しました。') }
                }}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[12px] font-medium text-rose-600 hover:bg-rose-100"
              >
                進捗リセット（開発用）
              </button>
            </div>
          )}

          {/* ── グリーティング ─────────────────────────────── */}
          <div>
            <h1 className="text-[20px] md:text-[24px] font-bold text-slate-800 leading-tight">
              おかえりなさい、{username}さん 👋
            </h1>
            <p className="mt-1 text-[13px] md:text-[14px] text-slate-500">
              今日もスキルを積み上げて、理想のエンジニアに近づきましょう。
            </p>
          </div>

          {/* ── KPI 4カード ──────────────────────────────────── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">

            {/* 1. 全体の進捗 */}
            <div className="rounded-2xl bg-white border border-slate-200 p-3 md:p-4 shadow-sm">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 md:mb-3">全体の進捗</p>
              <div className="flex items-center gap-2 md:gap-3">
                <div className="relative flex-shrink-0">
                  <svg className="w-12 h-12 md:w-14 md:h-14 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#0ea5e9" strokeWidth="3"
                      strokeDasharray={`${(progressPct?.pct ?? 0) * 99.9 / 100} 99.9`}
                      strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-slate-800">{progressPct?.pct ?? 0}%</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[20px] md:text-[22px] font-bold text-slate-800 leading-none">{progressPct?.pct ?? 0}<span className="text-[12px] text-slate-400 ml-0.5">%</span></p>
                  <p className="mt-0.5 text-[10px] md:text-[11px] text-slate-500 leading-tight">{progressPct?.completed ?? 0}/{progressPct?.total ?? 8}ステージ完了</p>
                  <button type="button" onClick={() => navigate('/wbs')} className="hidden md:block mt-1.5 text-[11px] text-sky-600 hover:underline">ロードマップを見る→</button>
                </div>
              </div>
            </div>

            {/* 2. 今週の学習時間 */}
            <div className="rounded-2xl bg-white border border-slate-200 p-3 md:p-4 shadow-sm">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 md:mb-3">今週の学習時間</p>
              <p className="text-[20px] md:text-[26px] font-bold text-slate-800 leading-none">—<span className="text-[12px] text-slate-400 ml-0.5">h</span></p>
              <p className="mt-0.5 text-[11px] text-slate-500">学習時間は記録中</p>
              <div className="mt-3 flex items-end gap-0.5 h-5">
                {['月', '火', '水', '木', '金', '土', '日'].map((d, i) => (
                  <div key={d} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className={`w-full rounded-sm ${i === (new Date().getDay() + 6) % 7 ? 'bg-sky-400' : 'bg-slate-100'}`} style={{ height: '100%' }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1">
                {['月', '火', '水', '木', '金', '土', '日'].map((d) => (
                  <span key={d} className="flex-1 text-center text-[9px] text-slate-400">{d}</span>
                ))}
              </div>
            </div>

            {/* 3. 連続学習日数 */}
            <div className="rounded-2xl bg-white border border-slate-200 p-3 md:p-4 shadow-sm">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 md:mb-3">連続学習日数</p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-[20px] md:text-[26px] font-bold text-slate-800 leading-none">{streakDays}</p>
                <span className="text-[12px] text-slate-400">日</span>
                {streakDays > 0 && <span className="text-[18px] leading-none">🔥</span>}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{streakDays > 0 ? '今日も頑張っています！' : 'ログインして記録スタート'}</p>
            </div>

            {/* 4. 総学習時間（目安） */}
            <div className="rounded-2xl bg-white border border-slate-200 p-3 md:p-4 shadow-sm">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 md:mb-3">総学習時間（目安）</p>
              <p className="text-[20px] md:text-[26px] font-bold text-slate-800 leading-none">{totalEstHours}<span className="text-[12px] text-slate-400 ml-0.5">h+</span></p>
              <p className="mt-1 text-[11px] text-slate-500">{completedCount}ステージ × 約3h</p>
            </div>
          </div>

          {/* ── 次に学習するレッスンカード ──────────────────── */}
          {!isSnapLoaded ? (
            <div className="rounded-2xl p-6 animate-pulse" style={{ background: 'linear-gradient(135deg, #3730a3, #2563EB)' }}>
              <div className="h-3 w-20 rounded bg-white/20 mb-3" />
              <div className="h-6 w-40 rounded bg-white/20 mb-4" />
              <div className="h-10 rounded-xl bg-white/20" />
            </div>
          ) : currentTask ? (
            <div className="rounded-2xl p-5 md:p-6 text-white" style={{ background: 'linear-gradient(135deg, #3730a3, #2563EB)' }}>
              <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] uppercase tracking-widest text-white/70 mb-1">次に学習するレッスン</p>
                  <h2 className="text-[19px] md:text-[22px] font-bold leading-snug">{currentTask.taskName}</h2>
                  <p className="mt-0.5 text-[13px] text-white/75">{currentTask.subtaskName}</p>
                  {currentTask.estimatedTime && <p className="mt-0.5 text-[12px] text-white/60">想定時間：{currentTask.estimatedTime}</p>}
                  {currentTask.progress !== null && (
                    <div className="mt-3 space-y-1">
                      <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-white/70 transition-all" style={{ width: `${currentTask.progress}%` }} />
                      </div>
                      {currentTask.progressLabel && <p className="text-[12px] text-white/70">{currentTask.progressLabel}</p>}
                    </div>
                  )}
                  <div className="mt-4 flex flex-col sm:flex-row flex-wrap gap-2">
                    <button type="button" onClick={currentTask.action} className="w-full sm:w-auto rounded-xl bg-white text-indigo-700 font-bold px-5 py-2.5 text-[14px] hover:bg-white/90 transition-colors">
                      {currentTask.actionLabel}
                    </button>
                    <button type="button" onClick={currentTask.action} className="w-full sm:w-auto rounded-xl bg-white/10 border border-white/20 text-white font-medium px-5 py-2.5 text-[14px] hover:bg-white/20 transition-colors">
                      詳細を見る
                    </button>
                  </div>
                </div>
                {/* ターミナルイメージ */}
                <div className="hidden md:flex w-[150px] flex-shrink-0 flex-col rounded-xl bg-[#1e1e2e] p-3">
                  <div className="flex gap-1 mb-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
                  </div>
                  <code className="text-[10px] font-mono leading-relaxed">
                    <span className="text-slate-400">$ </span><span className="text-green-400">ls -la</span><br />
                    <span className="text-white/40">total 24</span><br />
                    <span className="text-white/40">drwxr-xr-x</span><br />
                    <span className="text-slate-400">$ </span><span className="animate-pulse text-green-400">_</span>
                  </code>
                  <div className="mt-auto pt-2 flex flex-wrap gap-1">
                    {['BASIC', 'CMD', 'LINUX'].map((tag) => (
                      <span key={tag} className="rounded px-1.5 py-0.5 text-[9px] font-semibold bg-white/10 text-white/60">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-5 md:p-6 text-white" style={{ background: 'linear-gradient(135deg, #059669, #0284c7)' }}>
              <p className="text-[11px] uppercase tracking-widest text-white/70 mb-1">カリキュラム状況</p>
              <h2 className="text-[20px] font-bold">
                {(progressPct?.completed ?? 0) >= 8 ? '全カリキュラム完了！🎉' : 'カリキュラムを確認'}
              </h2>
              <p className="mt-1 text-[13px] text-white/80">
                {(progressPct?.completed ?? 0) >= 8
                  ? 'おめでとうございます。すべての課題をクリアしました。'
                  : '下のロードマップから次に進む課題を選択してください。'}
              </p>
            </div>
          )}

          {/* ── 下部 2カラム ────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">

            {/* 左: 学習ロードマップ 2/3 */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-slate-700">学習ロードマップ</h2>
                <button type="button" onClick={() => navigate('/wbs')} className="text-[12px] text-sky-600 hover:underline">すべての課題を見る→</button>
              </div>

              {/* タブ */}
              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
                {(Object.keys(TAB_LABELS) as TabKey[]).map((tab) => (
                  <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${activeTab === tab ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {TAB_LABELS[tab]}
                  </button>
                ))}
              </div>

              {/* ステップ一覧 */}
              <div className="space-y-2">
                {filteredSteps.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
                    <p className="text-[13px] text-slate-400">このカテゴリの課題は近日公開予定です。</p>
                  </div>
                ) : (
                  filteredSteps.map((step) => {
                    const isDone = step.status === 'done'
                    const isActive = step.status === 'active'
                    return (
                      <div key={step.no} className={`rounded-xl border transition-colors ${isDone ? 'border-slate-100 bg-slate-50/60' : isActive ? 'border-sky-300 bg-white shadow-sm' : 'border-slate-100 bg-white'}`}>
                        <div className="flex items-start gap-3 px-4 py-3.5">
                          <div className="flex-shrink-0 mt-0.5">
                            {isDone ? (
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-[11px] font-bold">✓</span>
                            ) : isActive ? (
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-white text-[11px] font-bold">{step.no}</span>
                            ) : (
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-[13px] font-semibold leading-tight ${isDone ? 'text-slate-400' : isActive ? 'text-slate-800' : 'text-slate-500'}`}>{step.name}</p>
                              {isDone ? (
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">完了</span>
                                  <button type="button" onClick={step.action} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50 transition-colors">復習する</button>
                                </div>
                              ) : isActive ? (
                                <button type="button" onClick={step.action} className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-700 transition-colors">続きから学習▶</button>
                              ) : (
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">未着手</span>
                                  <button type="button" onClick={step.action} className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">詳細を見る</button>
                                </div>
                              )}
                            </div>
                            <p className={`mt-0.5 text-[11px] ${isDone ? 'text-slate-300' : 'text-slate-400'}`}>{step.sub}</p>
                            {isActive && step.progress !== null && step.progress !== undefined && (
                              <div className="mt-2 space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-sky-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${step.progress}%` }} />
                                  </div>
                                  <span className="text-[11px] text-sky-600 shrink-0">{step.progress}%</span>
                                </div>
                                {step.progressLabel && <p className="text-[11px] text-sky-600">{step.progressLabel}</p>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* 右カラム 1/3 */}
            <div className="space-y-4">

              {/* 学習カレンダー */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-semibold text-slate-700">学習カレンダー</h3>
                  <p className="text-[11px] text-slate-400">{year}年{month + 1}月</p>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {['日', '月', '火', '水', '木', '金', '土'].map((d) => (
                    <div key={d} className="text-center text-[10px] text-slate-400 font-medium py-0.5">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-0.5">
                  {Array.from({ length: firstDayOfWeek }, (_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1
                    const isToday = day === today.getDate()
                    const isStudy = studyDates.has(day) && !isToday
                    return (
                      <div key={day} className={`flex items-center justify-center rounded-full text-[11px] h-6 w-6 mx-auto font-medium
                        ${isToday ? 'bg-sky-500 text-white' : isStudy ? 'bg-sky-100 text-sky-700' : 'text-slate-600'}`}>
                        {day}
                      </div>
                    )
                  })}
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-sky-500 inline-block" />
                    <span className="text-[10px] text-slate-500">今日</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-sky-100 inline-block" />
                    <span className="text-[10px] text-slate-500">学習日</span>
                  </div>
                </div>
              </div>

              {/* お知らせ */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-semibold text-slate-700">お知らせ</h3>
                  <button type="button" className="text-[11px] text-sky-600 hover:underline">すべて見る→</button>
                </div>
                <div className="space-y-3">
                  {[
                    { badge: 'メンテ', badgeClass: 'bg-amber-100 text-amber-700', title: '定期メンテナンスのお知らせ', date: '2026-04-30' },
                    { badge: 'NEW', badgeClass: 'bg-sky-100 text-sky-700', title: 'サーバー構築課題が更新されました', date: '2026-04-23' },
                    { badge: 'INFO', badgeClass: 'bg-emerald-100 text-emerald-700', title: 'AI講師機能をリリースしました', date: '2026-04-10' },
                  ].map((item) => (
                    <div key={item.title} className="flex gap-2">
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold h-fit ${item.badgeClass}`}>{item.badge}</span>
                      <div>
                        <p className="text-[12px] font-medium text-slate-700 leading-tight">{item.title}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{item.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>


            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
