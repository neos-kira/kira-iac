/**
 * メインテーマ: 白ベース (Light)
 * 全ページを白/ライトで統一する。
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { OpenInNewTabButton } from './components/OpenInNewTabButton'
import { NeOSLogo } from './components/NeOSLogo'
import type { CommandResolution } from './commandRouter'
import { resolveCommand } from './commandRouter'
import { L1_CLEARED_KEY, L1_PROGRESS_KEY, LINUX_LEVEL1_QUESTIONS } from './training/linuxLevel1Data'
import { L2_PROGRESS_KEY, TCPIP_LEVEL2_QUESTIONS, L2_CLEARED_KEY } from './training/linuxLevel2Data'
import { INFRA_BASIC_1_CLEARED_KEY } from './training/infraBasic1Data'
import { INFRA_BASIC_3_2_CLEARED_KEY } from './training/infraBasic3Data'
import {
  getProgressKey,
  getTaskProgressList,
  getWbsProgressPercent,
  getDelayedTaskIds,
  isTask1Cleared,
} from './training/trainingWbsData'
import { isJTerada, J_TERADA_ALLOWED_LINKS } from './specialUsers'
import { getIntroConfirmed } from './training/introGate'
import { LOGIN_FLAG_KEY } from './auth'
import { getCurrentProgressSnapshot, saveProgressSnapshot } from './traineeProgressStorage'

type TrainingTaskId = 'infra-basic-1' | 'infra-basic-2' | 'infra-basic-3'

type TrainingStatus = {
  infraToolsCleared: boolean
  linuxL1Cleared: boolean
  linuxL2Cleared: boolean
  infraOsCloudCleared: boolean
}

function readTrainingStatus(): TrainingStatus {
  if (typeof window === 'undefined') {
    return {
      infraToolsCleared: false,
      linuxL1Cleared: false,
      linuxL2Cleared: false,
      infraOsCloudCleared: false,
    }
  }
  return {
    infraToolsCleared: window.localStorage.getItem(getProgressKey(INFRA_BASIC_1_CLEARED_KEY)) === 'true',
    linuxL1Cleared: window.localStorage.getItem(getProgressKey(L1_CLEARED_KEY)) === 'true',
    linuxL2Cleared: window.localStorage.getItem(getProgressKey(L2_CLEARED_KEY)) === 'true',
    infraOsCloudCleared: window.localStorage.getItem(getProgressKey(INFRA_BASIC_3_2_CLEARED_KEY)) === 'true',
  }
}

const TRAINING_PIN_KEY = 'kira-training-pins'
const SEARCH_HISTORY_KEY = 'kira-search-history'
const SEARCH_HISTORY_MAX = 10
const ADMIN_SESSION_KEY = 'kira-admin-logged-in'

function loadSearchHistory(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v: unknown): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function saveSearchHistory(history: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history))
  } catch {
    // ignore
  }
}
const USER_DISPLAY_NAME_KEY = 'kira-user-display-name'
function getDisplayName(): string {
  if (typeof window === 'undefined') return 'kira-test'
  return window.localStorage.getItem(USER_DISPLAY_NAME_KEY) || 'kira-test'
}

function loadPinnedTrainingTasks(): TrainingTaskId[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(TRAINING_PIN_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (v: unknown): v is TrainingTaskId =>
        v === 'infra-basic-1' || v === 'infra-basic-2' || v === 'infra-basic-3',
    )
  } catch {
    return []
  }
}

function getTrainingUrl(path: string) {
  const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname || '/'}`.replace(/\/$/, '') || window.location.origin : ''
  return `${base}#${path}`
}

/** 途中保存（未完了）のセッションがあるときだけ true */
function hasInProgressSession(storageKey: string, total: number): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return false
    const parsed = JSON.parse(raw) as { answers?: unknown[] }
    return Array.isArray(parsed.answers) && parsed.answers.length > 0 && parsed.answers.length < total
  } catch {
    return false
  }
}

function handleLogout() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY)
    window.localStorage.removeItem(USER_DISPLAY_NAME_KEY)
    window.localStorage.removeItem(LOGIN_FLAG_KEY)
    const base = (window.location.origin + window.location.pathname + (window.location.search || '')).replace(/\/$/, '') || window.location.origin
    window.location.href = base + '#/login'
  } catch {
    window.location.href = (window.location.pathname || '/') + '#/login'
  }
}

/** j-terada が課題1クリア後に表示する限定ページ（指定2リンクのみ） */
function JTeradaRestrictedView() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
        <NeOSLogo height={32} />
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">j-terada さん</span>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            ログアウト
          </button>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 py-8">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-800">コマンド問題が終わりました</h1>
          <p className="mt-2 text-sm text-slate-600">
            以下を行ってください。
          </p>
          <ul className="mt-6 space-y-3">
            {J_TERADA_ALLOWED_LINKS.map(({ label, url }) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  )
}

function App() {
  const displayName = getDisplayName()
  if (isJTerada(displayName) && isTask1Cleared()) {
    return <JTeradaRestrictedView />
  }

  const [input, setInput] = useState('')
  const [resolution, setResolution] = useState<CommandResolution | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [canResumeL1, setCanResumeL1] = useState(false)
  const [canResumeL2, setCanResumeL2] = useState(false)
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatus>(() => readTrainingStatus())
  const [pinnedTraining, setPinnedTraining] = useState<TrainingTaskId[]>(() => loadPinnedTrainingTasks())
  const [showIntroRequiredPopup, setShowIntroRequiredPopup] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>(() => loadSearchHistory())
  const [showSearchHistory, setShowSearchHistory] = useState(false)
  const [searchHistoryHighlightIndex, setSearchHistoryHighlightIndex] = useState(-1)
  const [isListening, setIsListening] = useState(false)
  const openedRef = useRef<string | null>(null)
  const searchContainerRef = useRef<HTMLDivElement | null>(null)
  const searchFormRef = useRef<HTMLFormElement | null>(null)
  const recognitionRef = useRef<{ stop: () => void } | null>(null)
  /** 音声認識中の確定テキストを蓄積（リアルタイム表示用） */
  const voiceFinalRef = useRef('')
  /** ユーザーがマイクを押して停止した場合 true。onend で再開しない判定に使用 */
  const voiceUserStoppedRef = useRef(false)
  /** 音声認識で表示中の最新テキスト（再開時のベース用） */
  const voiceDisplayRef = useRef('')
  /** 矢印キーで履歴を選択した場合のみ true。Enter で履歴項目を送信する判定に使用 */
  const historyNavigatedWithKeyboardRef = useRef(false)

  /** インフラ課題系URL: はじめに未完了ならポップアップ、完了なら開く */
  function openInfraOrShowIntro(url: string) {
    if (getIntroConfirmed()) {
      window.open(url, '_blank')
    } else {
      setShowIntroRequiredPopup(true)
    }
  }

  function goToIntroAndClosePopup() {
    setShowIntroRequiredPopup(false)
    window.location.hash = '#/training/intro'
  }

  async function handleSubmit(event: React.FormEvent, valueOverride?: string) {
    event.preventDefault()
    const value = (valueOverride ?? input).trim()
    if (!value) return

    setSearchHistory((prev) => {
      const next = [value, ...prev.filter((v) => v !== value)].slice(0, SEARCH_HISTORY_MAX)
      saveSearchHistory(next)
      return next
    })
    setShowSearchHistory(false)

    setIsThinking(true)
    openedRef.current = null
    try {
      const result = await resolveCommand(value)
      setResolution(result)
    } finally {
      setIsThinking(false)
    }
  }

  function removeSearchHistoryItem(item: string) {
    setSearchHistory((prev) => {
      const next = prev.filter((v) => v !== item)
      saveSearchHistory(next)
      return next
    })
  }

  function toggleVoiceInput() {
    if (typeof window === 'undefined') return
    const Win = window as Window & { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }
    const SpeechRecognition = Win.SpeechRecognition ?? Win.webkitSpeechRecognition
    if (!SpeechRecognition) {
      return
    }
    if (isListening && recognitionRef.current) {
      voiceUserStoppedRef.current = true
      recognitionRef.current.stop()
      recognitionRef.current = null
      setIsListening(false)
      return
    }
    voiceUserStoppedRef.current = false
    voiceFinalRef.current = input
    voiceDisplayRef.current = input

    const startRecognition = () => {
      const recognition = new SpeechRecognition() as {
        start: () => void
        stop: () => void
        lang: string
        continuous: boolean
        interimResults: boolean
        onresult: (e: { results: { length: number; [i: number]: { isFinal?: boolean; length: number; [j: number]: { transcript?: string } } } }) => void
        onend: () => void
        onerror: (e?: unknown) => void
      }
      recognition.lang = 'ja-JP'
      recognition.continuous = true
      recognition.interimResults = true
      recognition.onresult = (event) => {
        const base = voiceFinalRef.current
        let full = ''
        let interim = ''
        const results = event.results as { length: number; [i: number]: { isFinal?: boolean; 0?: { transcript?: string } } }
        for (let i = 0; i < results.length; i++) {
          const r = results[i]
          if (!r) continue
          const t = (r[0] as { transcript?: string } | undefined)?.transcript ?? ''
          const isFinal = typeof r.isFinal === 'boolean' ? r.isFinal : false
          if (isFinal) {
            full += t
          } else {
            interim = t
          }
        }
        const combined = base ? `${base} ${full}${interim}`.trim() : `${full}${interim}`.trim()
        voiceDisplayRef.current = combined
        flushSync(() => setInput(combined))
      }
      recognition.onend = () => {
        if (voiceUserStoppedRef.current) {
          recognitionRef.current = null
          setIsListening(false)
          return
        }
        voiceFinalRef.current = voiceDisplayRef.current
        try {
          startRecognition()
        } catch {
          recognitionRef.current = null
          setIsListening(false)
        }
      }
      recognition.onerror = (event: unknown) => {
        if (voiceUserStoppedRef.current) return
        const err = typeof event === 'object' && event !== null && 'error' in event ? String((event as { error: string }).error) : ''
        if (err === 'no-speech') return
        recognitionRef.current = null
        setIsListening(false)
      }
      try {
        recognition.start()
        recognitionRef.current = recognition
        setIsListening(true)
      } catch (e) {
        recognitionRef.current = null
        setIsListening(false)
      }
    }
    startRecognition()
  }

  const updateFromStorage = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      setCanResumeL1(hasInProgressSession(getProgressKey(L1_PROGRESS_KEY), LINUX_LEVEL1_QUESTIONS.length))
      setCanResumeL2(hasInProgressSession(getProgressKey(L2_PROGRESS_KEY), TCPIP_LEVEL2_QUESTIONS.length))
      setTrainingStatus(readTrainingStatus())
      setPinnedTraining(loadPinnedTrainingTasks())
    } catch {
      // ignore
    }
  }, [])

  const handleTogglePin = useCallback((id: TrainingTaskId) => {
    setPinnedTraining((prev) => {
      const exists = prev.includes(id)
      const next = exists ? prev.filter((p) => p !== id) : [...prev, id]
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(TRAINING_PIN_KEY, JSON.stringify(next))
        } catch {
          // ignore
        }
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (!resolution || resolution.feature !== 'training') return
    const cat = resolution.training.category
    if (cat === 'intro' || cat === 'wbs') {
      return
    }
    if (cat === 'linuxLevel1') {
      if (openedRef.current === 'linuxLevel1') return
      if (!getIntroConfirmed()) setShowIntroRequiredPopup(true)
      else {
        window.open(getTrainingUrl('/training/linux-level1'), '_blank')
        openedRef.current = 'linuxLevel1'
      }
    } else if (cat === 'linuxLevel2') {
      if (openedRef.current === 'linuxLevel2') return
      if (!getIntroConfirmed()) setShowIntroRequiredPopup(true)
      else {
        window.open(getTrainingUrl('/training/linux-level2'), '_blank')
        openedRef.current = 'linuxLevel2'
      }
    }
    // 「インフラ研修」の場合は別タブで開かず、下に検索結果として表示するだけ
  }, [resolution])

  useEffect(() => {
    document.title = 'NICプラットフォーム'
    updateFromStorage()
  }, [updateFromStorage])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => {
      updateFromStorage()
    }
    window.addEventListener('storage', handler)
    window.addEventListener('focus', handler)
    window.addEventListener('visibilitychange', handler)
    return () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener('focus', handler)
      window.removeEventListener('visibilitychange', handler)
    }
  }, [updateFromStorage])

  useEffect(() => {
    if (showSearchHistory && searchHistory.length > 0) {
      setSearchHistoryHighlightIndex(0)
      historyNavigatedWithKeyboardRef.current = false
    } else {
      setSearchHistoryHighlightIndex(-1)
    }
  }, [showSearchHistory, searchHistory.length])

  useEffect(() => {
    if (!showSearchHistory) return
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchHistory(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSearchHistory])

  const isAdminView = getDisplayName()?.toLowerCase() === 'admin'

  useEffect(() => {
    if (isAdminView || typeof window === 'undefined') return
    const save = () => {
      const name = getDisplayName()
      if (name && name.toLowerCase() !== 'admin') {
        saveProgressSnapshot(name, getCurrentProgressSnapshot())
      }
    }
    save()
    const id = setInterval(save, 2000)
    return () => clearInterval(id)
  }, [isAdminView])

  const navigate = useNavigate()
  const delayed = getDelayedTaskIds().length > 0
  const progressPct = getWbsProgressPercent()
  const taskList = getTaskProgressList()
  const inProgressLabels = taskList
    .filter((t) => !t.cleared && t.subTasks.some((s) => s.status !== 'not_started'))
    .map((t) => t.labelShort)

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-5 pt-4 pb-8">
        <header className="relative z-[9999] flex items-center justify-between gap-4 bg-white px-4 py-3">
          <div className="flex items-center">
            <NeOSLogo height={100} />
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            {!isAdminView && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (getIntroConfirmed()) window.location.hash = '#/training/infra-wbs'
                    else setShowIntroRequiredPopup(true)
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium text-white shrink-0 ${delayed ? 'bg-rose-500' : 'bg-emerald-500'}`}
                  title="クリックでWBS"
                >
                  {delayed ? '遅延あり' : '遅延なし'}
                </button>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 shrink-0">
                  全体進捗:{progressPct}%
                </span>
                {inProgressLabels.length > 0 && (
                  <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 shrink-0" title="実施中の課題">
                    実施中: {inProgressLabels.join('・')}
                  </span>
                )}
              </>
            )}
            <span className="text-sm text-slate-700">{getDisplayName()}</span>
            {isAdminView && (
              <button
                type="button"
                onClick={() => (window.location.hash = '#/admin')}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
              >
                講師メニュー
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLogout(); }}
              className="relative z-[10000] min-w-[88px] cursor-pointer rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              aria-label="ログアウト"
            >
              ログアウト
            </button>
          </div>
        </header>

        {/* はじめに未完了時ポップアップ */}
        {showIntroRequiredPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="intro-required-title">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
              <h2 id="intro-required-title" className="text-lg font-semibold text-slate-800">はじめに</h2>
              <p className="mt-3 text-sm text-slate-600">
                インフラ基礎課題にアクセスするには、先に「はじめに」でプロフェッショナルとしての行動基準を確認してください。
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={goToIntroAndClosePopup}
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  はじめに
                </button>
                <button
                  type="button"
                  onClick={() => setShowIntroRequiredPopup(false)}
                  className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="mt-4 flex flex-1 flex-col items-center justify-start">
          {isAdminView ? (
            <div className="w-full max-w-2xl space-y-4">
              <h1 className="text-lg font-semibold text-slate-800">講師用メニュー</h1>
              <p className="text-sm text-slate-600">受講生の進捗を確認できます。</p>
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="flex w-full flex-col items-start rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/50"
              >
                <span className="text-base font-semibold text-slate-800">受講生の進捗</span>
                <span className="mt-1 text-xs text-slate-600">WBSに基づく進捗一覧を表示</span>
              </button>
            </div>
          ) : (
          <>
          <div className="w-full max-w-2xl space-y-6">
            {/* はじめに未完了時：メッセージとリンクを最上部に表示（admin では表示しない） */}
            {!getIntroConfirmed() && (
              <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 shadow-sm">
                <p className="text-sm font-semibold text-amber-800">はじめに</p>
                <p className="mt-2 text-sm text-slate-700">
                  インフラ基礎課題に進む前に、「はじめに」でプロフェッショナルとしての行動基準を確認してください。
                </p>
                <OpenInNewTabButton
                  url={getTrainingUrl('/training/intro')}
                  label="はじめに"
                  className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                />
              </div>
            )}
            {/* j-terada 用：はじめにの下に課題1完了後の案内を表示。課題1クリア前はリンク無効 */}
            {isJTerada(getDisplayName()) && (
              <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/90 p-6 shadow-sm">
                <p className="text-base font-semibold text-indigo-900">
                  インフラ基礎課題1が完了したら、以下の課題を実施してください。
                </p>
                <ul className="mt-4 space-y-3">
                  <li>
                    {isTask1Cleared() ? (
                      <a
                        href="https://docs.google.com/presentation/d/1Xw--LXH056ekfvkneyzl-ZCFPKJon4vd/edit?usp=drivesdk&ouid=100622650885455094391&rtpof=true&sd=true"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-medium text-indigo-800 shadow-sm ring-1 ring-indigo-200 hover:bg-indigo-100 hover:ring-indigo-300"
                      >
                        概要ppt
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-3 text-sm font-medium text-slate-500 ring-1 ring-slate-200 cursor-not-allowed">
                        概要ppt（コマンド課題をクリアするとアクセスできます）
                      </span>
                    )}
                  </li>
                  <li>
                    {isTask1Cleared() ? (
                      <a
                        href="https://docs.google.com/spreadsheets/d/127QyXSU1_nLAeRF5HPfsYcECDWjNZKZW/edit?usp=drivesdk&ouid=100622650885455094391&rtpof=true&sd=true"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-medium text-indigo-800 shadow-sm ring-1 ring-indigo-200 hover:bg-indigo-100 hover:ring-indigo-300"
                      >
                        WBS
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-3 text-sm font-medium text-slate-500 ring-1 ring-slate-200 cursor-not-allowed">
                        WBS（コマンド課題をクリアするとアクセスできます）
                      </span>
                    )}
                  </li>
                </ul>
              </div>
            )}
            <div className="rounded-2xl bg-white p-6 shadow-sm" aria-label="検索">
              <div className="relative" ref={searchContainerRef}>
                <form ref={searchFormRef} onSubmit={handleSubmit} className="space-y-3">
                  <div className="flex items-stretch rounded-xl bg-slate-50 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-0">
                    <input
                      type="text"
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onFocus={() => setShowSearchHistory(true)}
                      onKeyDown={(e) => {
                        const isEnter = e.key === 'Enter' || e.keyCode === 13
                        if (isEnter) {
                          e.preventDefault()
                          e.stopPropagation()
                          const useHighlighted =
                            historyNavigatedWithKeyboardRef.current &&
                            showSearchHistory &&
                            searchHistory.length > 0 &&
                            searchHistoryHighlightIndex >= 0
                          if (useHighlighted) {
                            const item = searchHistory[searchHistoryHighlightIndex]
                            setInput(item)
                            setShowSearchHistory(false)
                            void handleSubmit(e as unknown as React.FormEvent, item)
                          } else {
                            // フォームの requestSubmit で送信し、検索結果を確実に表示
                            searchFormRef.current?.requestSubmit()
                          }
                        }
                        if (!showSearchHistory || searchHistory.length === 0) return
                        if (e.key === 'ArrowDown') {
                          e.preventDefault()
                          historyNavigatedWithKeyboardRef.current = true
                          setSearchHistoryHighlightIndex((i) =>
                            i < searchHistory.length - 1 ? i + 1 : 0
                          )
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault()
                          historyNavigatedWithKeyboardRef.current = true
                          setSearchHistoryHighlightIndex((i) =>
                            i <= 0 ? searchHistory.length - 1 : i - 1
                          )
                        }
                      }}
                      placeholder="「インフラ研修を表示」 「WBSを表示」"
                      className="flex-1 min-w-0 py-3.5 pl-4 pr-3 text-sm text-slate-800 placeholder:text-slate-400 border-0 outline-none bg-transparent"
                    />
                    <button
                      type="button"
                      onClick={toggleVoiceInput}
                      className="relative flex items-center justify-center px-2 py-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                      aria-label={isListening ? '音声認識を停止' : '音声入力'}
                      title={isListening ? '音声認識を停止' : '音声入力'}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
                      </svg>
                      {isListening && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" aria-hidden />}
                    </button>
                    <button
                      type="submit"
                      disabled={isThinking}
                      className="rounded-r-xl bg-indigo-600 px-4 py-3 text-lg font-medium text-white hover:bg-indigo-700 active:scale-[0.98] active:opacity-90 disabled:opacity-70 disabled:cursor-wait transition-all shrink-0 leading-none"
                      aria-label="実行"
                    >
                      {isThinking ? '…' : '↑'}
                    </button>
                  </div>
                </form>
                {showSearchHistory && searchHistory.length > 0 && (
                  <ul className="absolute top-full left-0 right-0 mt-1 rounded-lg bg-white shadow-lg py-1 z-10 max-h-60 overflow-auto">
                    {searchHistory.map((item, index) => (
                      <li
                        key={item}
                        className={`group flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 ${
                          index === searchHistoryHighlightIndex ? 'bg-indigo-50' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => { setInput(item); setShowSearchHistory(false); }}
                          className="flex-1 min-w-0 text-left truncate"
                        >
                          {item}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeSearchHistoryItem(item); }}
                          className="shrink-0 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="この履歴を削除"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* 検索結果（Enter または ↑ 実行後に表示） */}
            {resolution && (
              <section className="mt-6 space-y-3" aria-label="検索結果">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <p>
                    検索結果:{' '}
                    <span className="font-medium text-slate-800">
                      {resolution.displayName}
                    </span>
                  </p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-600">
                    {resolution.feature}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{resolution.reason}</p>

                <div className="mt-3">
                  <ResolvedModulePlaceholder
                    resolution={resolution}
                    pinnedTraining={pinnedTraining}
                    trainingStatus={trainingStatus}
                    onTogglePin={handleTogglePin}
                    onOpenInfraOrShowIntro={openInfraOrShowIntro}
                    onOpenIntro={() => { window.location.hash = '#/training/intro' }}
                    onOpenWbs={() => {
                      if (getIntroConfirmed()) window.location.hash = '#/training/infra-wbs'
                      else setShowIntroRequiredPopup(true)
                    }}
                  />
                </div>
              </section>
            )}
          </div>

          {/* ピン留めした課題（検索しなくてもすぐアクセス） */}
          {pinnedTraining.length > 0 && (
            <section className="mt-6 w-full max-w-2xl rounded-2xl bg-white p-4 text-[11px] text-slate-700 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                PINNED · TRAINING
              </p>
              <p className="mt-1 text-xs text-slate-600">よく使う課題にワンクリックでアクセスできます。</p>
              <ul className="mt-3 space-y-2 text-slate-700">
                {pinnedTraining.includes('infra-basic-1') && (
                  <li className="flex flex-col gap-1 rounded-xl bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">インフラ基礎課題1</span>
                        <span className="inline-flex items-center justify-center rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          📌
                        </span>
                        {trainingStatus.infraToolsCleared && trainingStatus.linuxL1Cleared && (
                          <span className="inline-flex items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                            ✓
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTogglePin('infra-basic-1')}
                        className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-amber-600"
                      >
                        <span aria-hidden>📌</span>
                        ピン解除
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => openInfraOrShowIntro(getTrainingUrl('/training/infra-basic-top'))}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      別タブで開く
                    </button>
                  </li>
                )}
                {pinnedTraining.includes('infra-basic-2') && (
                  <li className="flex flex-col gap-1 rounded-xl bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">インフラ基礎課題2</span>
                        <span className="inline-flex items-center justify-center rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          📌
                        </span>
                        {trainingStatus.linuxL2Cleared && (
                          <span className="inline-flex items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                            ✓
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTogglePin('infra-basic-2')}
                        className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-amber-600"
                      >
                        <span aria-hidden>📌</span>
                        ピン解除
                      </button>
                      {!(trainingStatus.infraToolsCleared && trainingStatus.linuxL1Cleared) && (
                        <p className="mt-1 text-[10px] text-amber-700">インフラ基礎課題1をクリアすると利用できます</p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!(trainingStatus.infraToolsCleared && trainingStatus.linuxL1Cleared)}
                      onClick={() => openInfraOrShowIntro(getTrainingUrl('/training/infra-basic-2-top'))}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      別タブで開く
                    </button>
                  </li>
                )}
                {pinnedTraining.includes('infra-basic-3') && (
                  <li className="flex flex-col gap-1 rounded-xl bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">インフラ基礎課題3</span>
                        <span className="inline-flex items-center justify-center rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          📌
                        </span>
                        {trainingStatus.infraOsCloudCleared && (
                          <span className="inline-flex items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                            ✓
                          </span>
                        )}

                      </div>
                      <button
                        type="button"
                        onClick={() => handleTogglePin('infra-basic-3')}
                        className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-amber-600"
                      >
                        <span aria-hidden>📌</span>
                        ピン解除
                      </button>
                      {!trainingStatus.linuxL2Cleared && (
                        <p className="mt-1 text-[10px] text-amber-700">インフラ基礎課題2をクリアすると利用できます</p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!trainingStatus.linuxL2Cleared}
                      onClick={() => openInfraOrShowIntro(getTrainingUrl('/training/infra-basic-3-top'))}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      別タブで開く
                    </button>
                  </li>
                )}
              </ul>
            </section>
          )}

          {(canResumeL1 || canResumeL2) && getDisplayName()?.toLowerCase() !== 'admin' && getIntroConfirmed() && (
            <section className="mt-6 w-full max-w-2xl rounded-2xl border border-amber-300 bg-amber-50/80 p-4 text-[11px] text-slate-700 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
                    TRAINING · RESUME
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-800">中断中の研修にすぐ戻れます</p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    以前ブラウザで解いていた問題の続きに、そのままジャンプします。新しいタブで開きます。
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {canResumeL1 && (
                  <button
                    type="button"
                    onClick={() => openInfraOrShowIntro(getTrainingUrl('/training/linux-level1'))}
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-amber-50"
                  >
                    インフラ研修1を途中から再開（別タブ）
                  </button>
                )}
                {canResumeL2 && (
                  <button
                    type="button"
                    onClick={() => openInfraOrShowIntro(getTrainingUrl('/training/linux-level2'))}
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-amber-50"
                  >
                    インフラ研修2を途中から再開（別タブ）
                  </button>
                )}
              </div>
            </section>
          )}

          </>
          )}
        </main>
      </div>
    </div>
  )
}

type PlaceholderProps = {
  resolution: CommandResolution
  pinnedTraining: TrainingTaskId[]
  trainingStatus: TrainingStatus
  onTogglePin: (id: TrainingTaskId) => void
  onOpenInfraOrShowIntro: (url: string) => void
  onOpenIntro?: () => void
  onOpenWbs?: () => void
}

function ResolvedModulePlaceholder({ resolution, pinnedTraining, trainingStatus, onTogglePin, onOpenInfraOrShowIntro, onOpenIntro, onOpenWbs }: PlaceholderProps) {
  if (resolution.feature === 'training') {
    const category = resolution.training.category

    if (category === 'intro') {
      return (
        <div className="rounded-2xl bg-white p-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">TRAINING · はじめに</p>
          <h2 className="mt-2 text-base font-semibold text-slate-800">はじめに</h2>
          <p className="mt-1 text-xs text-slate-600">はじめにのページへアクセスできます。</p>
          {onOpenIntro && (
            <button
              type="button"
              onClick={onOpenIntro}
              className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              はじめにを開く
            </button>
          )}
        </div>
      )
    }

    if (category === 'wbs') {
      return (
        <div className="rounded-2xl bg-white p-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">TRAINING · WBS</p>
          <h2 className="mt-2 text-base font-semibold text-slate-800">インフラ基礎 研修WBS</h2>
          <p className="mt-1 text-xs text-slate-600">WBSページで進捗とガントチャートを確認できます。</p>
          {onOpenWbs && (
            <button
              type="button"
              onClick={onOpenWbs}
              className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
            >
              WBSを開く
            </button>
          )}
        </div>
      )
    }

    if (category === 'linuxLevel1') {
      return (
        <div className="rounded-2xl bg-white p-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">TRAINING · LINUX · LEVEL 1</p>
          <h2 className="mt-2 text-base font-semibold text-slate-800">インフラ研修1 — Linuxコマンド30問</h2>
          <p className="mt-1 text-xs text-slate-600">別タブで問題を開きました。タブを確認してください。</p>
          <p className="mt-2 text-[11px] text-slate-500">問題中は正誤を表示せず、30問終了後に得点を表示します。満点でクリアです。</p>
        </div>
      )
    }

    if (category === 'linuxLevel2') {
      return (
        <div className="rounded-2xl bg-white p-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            TRAINING · INFRA · 2-2 TCP/IP
          </p>
          <h2 className="mt-2 text-base font-semibold text-slate-800">インフラ基礎課題2-2 — TCP/IP 理解度チェック10問</h2>
          <p className="mt-1 text-xs text-slate-600">別タブで問題を開きました。タブを確認してください。</p>
        </div>
      )
    }

    if (category === 'infra') {
      const infra1Cleared = trainingStatus.infraToolsCleared && trainingStatus.linuxL1Cleared
      const infra2Cleared = trainingStatus.linuxL2Cleared
      const infra3Cleared = trainingStatus.infraOsCloudCleared

      return (
        <div className="rounded-2xl bg-white p-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            TRAINING · INFRA
          </p>
          <p className="mt-2 text-xs text-slate-500">検索結果</p>
          <h2 className="mt-1 text-base font-semibold text-slate-800">インフラ基礎課題</h2>

          <ul className="mt-4 space-y-2 text-slate-700">
            <li className="flex flex-col gap-1 rounded-xl bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">インフラ基礎課題1</span>
                  {pinnedTraining.includes('infra-basic-1') && (
                    <span className="inline-flex items-center justify-center rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      📌
                    </span>
                  )}
                  {infra1Cleared && (
                    <span className="inline-flex items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                      ✓
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onTogglePin('infra-basic-1')}
                  className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-amber-600"
                >
                  <span aria-hidden>📌</span>
                  {pinnedTraining.includes('infra-basic-1') ? 'ピン解除' : 'ピン留め'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => onOpenInfraOrShowIntro(getTrainingUrl('/training/infra-basic-top'))}
                className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium bg-indigo-600 text-white hover:bg-indigo-700"
              >
                別タブで開く
              </button>
            </li>
            <li className="flex flex-col gap-1 rounded-xl bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">インフラ基礎課題2</span>
                  {pinnedTraining.includes('infra-basic-2') && (
                    <span className="inline-flex items-center justify-center rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      📌
                    </span>
                  )}
                  {infra2Cleared && (
                    <span className="inline-flex items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                      ✓
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onTogglePin('infra-basic-2')}
                  className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-amber-600"
                >
                  <span aria-hidden>📌</span>
                  {pinnedTraining.includes('infra-basic-2') ? 'ピン解除' : 'ピン留め'}
                </button>
                {!infra1Cleared && (
                  <p className="mt-1 text-[10px] text-amber-700">インフラ基礎課題1をクリアすると利用できます</p>
                )}
              </div>
              <button
                type="button"
                disabled={!infra1Cleared}
                onClick={() => onOpenInfraOrShowIntro(getTrainingUrl('/training/infra-basic-2-top'))}
                className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                別タブで開く
              </button>
            </li>
            <li className="flex flex-col gap-1 rounded-xl bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">インフラ基礎課題3</span>
                  {pinnedTraining.includes('infra-basic-3') && (
                    <span className="inline-flex items-center justify-center rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      📌
                    </span>
                  )}
                  {infra3Cleared && (
                    <span className="inline-flex items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                      ✓
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onTogglePin('infra-basic-3')}
                  className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-amber-600"
                >
                  <span aria-hidden>📌</span>
                  {pinnedTraining.includes('infra-basic-3') ? 'ピン解除' : 'ピン留め'}
                </button>
                {!infra2Cleared && (
                  <p className="mt-1 text-[10px] text-amber-700">インフラ基礎課題2をクリアすると利用できます</p>
                )}
              </div>
              <button
                type="button"
                disabled={!infra2Cleared}
                onClick={() => onOpenInfraOrShowIntro(getTrainingUrl('/training/infra-basic-3-top'))}
                className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                別タブで開く
              </button>
            </li>
          </ul>
        </div>
      )
    }

    return (
      <div className="rounded-2xl bg-white p-4 text-sm shadow-sm">
        <h2 className="text-base font-semibold text-slate-800">研修モジュール</h2>
        <p className="mt-1 text-xs text-slate-600">
          研修ポータルへのルーティング結果です。実装時には、ここから研修管理システムの画面へ遷移させます。
        </p>
      </div>
    )
  }

  if (resolution.feature === 'timeTracking') {
    return (
      <div className="rounded-2xl bg-white p-4 text-sm shadow-sm">
        <h2 className="text-base font-semibold text-slate-800">
          勤怠管理モジュール（プレースホルダー）
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          打刻・勤怠申請画面へのエントリーポイントです。将来的にはここから勤怠システムへシングルサインオンさせます。
        </p>
      </div>
    )
  }

  if (resolution.feature === 'projects') {
    return (
      <div className="rounded-2xl bg-white p-4 text-sm shadow-sm">
        <h2 className="text-base font-semibold text-slate-800">
          プロジェクト管理モジュール（プレースホルダー）
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          プロジェクトボード・ガントチャートなどの画面に接続する想定のコンテナです。
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm">
      <p>該当する機能が見つかりませんでした。別の表現でもう一度試してください。</p>
    </div>
  )
}

export default App
