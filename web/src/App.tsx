/**
 * メインテーマ: 白ベース (Light)
 * トップページ・ヘッダー・コマンドパレットは白/ライトで統一する。
 * ネイビー（ダーク）テーマには戻さないこと。
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { OpenInNewTabButton } from './components/OpenInNewTabButton'
import { NeOSLogo } from './components/NeOSLogo'
import type { CommandResolution } from './commandRouter'
import { resolveCommand } from './commandRouter'
import { L1_CLEARED_KEY, L1_PROGRESS_KEY, LINUX_LEVEL1_QUESTIONS } from './training/linuxLevel1Data'
import { L2_PROGRESS_KEY, TCPIP_LEVEL2_QUESTIONS, L2_CLEARED_KEY } from './training/linuxLevel2Data'
import { INFRA_BASIC_1_CLEARED_KEY } from './training/infraBasic1Data'
import { INFRA_BASIC_3_2_CLEARED_KEY } from './training/infraBasic3Data'
import {
  getTotalCleared,
  TOTAL_TASKS as WBS_TOTAL_TASKS,
  getDelayedTaskIds,
} from './training/trainingWbsData'
import { getIntroConfirmed } from './training/introGate'

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
    infraToolsCleared: window.localStorage.getItem(INFRA_BASIC_1_CLEARED_KEY) === 'true',
    linuxL1Cleared: window.localStorage.getItem(L1_CLEARED_KEY) === 'true',
    linuxL2Cleared: window.localStorage.getItem(L2_CLEARED_KEY) === 'true',
    infraOsCloudCleared: window.localStorage.getItem(INFRA_BASIC_3_2_CLEARED_KEY) === 'true',
  }
}

const TRAINING_PIN_KEY = 'kira-training-pins'
const ADMIN_SESSION_KEY = 'kira-admin-logged-in'
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

function App() {
  const [input, setInput] = useState('')
  const [resolution, setResolution] = useState<CommandResolution | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [canResumeL1, setCanResumeL1] = useState(false)
  const [canResumeL2, setCanResumeL2] = useState(false)
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatus>(() => readTrainingStatus())
  const [pinnedTraining, setPinnedTraining] = useState<TrainingTaskId[]>(() => loadPinnedTrainingTasks())
  const [isAdmin] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true'
  })
  const [showIntroRequiredPopup, setShowIntroRequiredPopup] = useState(false)
  const openedRef = useRef<string | null>(null)

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

  function handleLogout() {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.removeItem(ADMIN_SESSION_KEY)
      window.localStorage.removeItem(USER_DISPLAY_NAME_KEY)
      const url = window.location.origin + window.location.pathname + (window.location.search || '') + '#/'
      window.location.replace(url)
    } catch {
      window.location.reload()
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const value = input.trim()
    if (!value) return

    setIsThinking(true)
    openedRef.current = null
    try {
      const result = await resolveCommand(value)
      setResolution(result)
    } finally {
      setIsThinking(false)
    }
  }

  const updateFromStorage = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      setCanResumeL1(hasInProgressSession(L1_PROGRESS_KEY, LINUX_LEVEL1_QUESTIONS.length))
      setCanResumeL2(hasInProgressSession(L2_PROGRESS_KEY, TCPIP_LEVEL2_QUESTIONS.length))
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
    document.title = 'NeOS社内統合プラットフォーム'
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

  const delayed = getDelayedTaskIds().length > 0
  const progressPct = WBS_TOTAL_TASKS > 0 ? Math.round((getTotalCleared() / WBS_TOTAL_TASKS) * 100) : 0

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-5 py-8">
        {/* ヘッダー: 拡張機能のオーバーレイより前面に表示 */}
        <header className="relative z-[9999] flex items-center justify-between gap-4">
          <div className="flex items-center">
            <NeOSLogo height={80} />
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
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
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shrink-0">
              全体進捗:{progressPct}%
            </span>
            <span className="text-sm text-slate-700 hidden sm:inline">{getDisplayName()}</span>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLogout(); }}
              className="relative z-[10000] min-w-[88px] cursor-pointer rounded-lg border-2 border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:border-indigo-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              aria-label="ログアウト"
            >
              ログアウト
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => (window.location.hash = '#/admin')}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
              >
                講師メニュー
              </button>
            )}
          </div>
        </header>

        {/* はじめに未完了時ポップアップ */}
        {showIntroRequiredPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="intro-required-title">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <h2 id="intro-required-title" className="text-lg font-semibold text-slate-800">はじめにを実施してください</h2>
              <p className="mt-3 text-sm text-slate-600">
                インフラ基礎課題にアクセスするには、先に「はじめに」でプロフェッショナルとしての行動基準を確認してください。
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={goToIntroAndClosePopup}
                  className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  はじめにを開く
                </button>
                <button
                  type="button"
                  onClick={() => setShowIntroRequiredPopup(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 中央: 1枚目カード — NICプラットフォーム + 検索窓 */}
        <main className="mt-10 flex flex-1 flex-col items-center justify-start">
          <div className="w-full max-w-2xl space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h1 className="text-xl font-bold text-slate-800 mb-5">NICプラットフォーム</h1>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex items-stretch rounded-xl border border-slate-200 bg-slate-50 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                  <span className="flex items-center pl-4 text-slate-600 pointer-events-none text-sm font-medium" aria-hidden>
                    ⌘ K
                  </span>
                  <input
                    type="text"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="「インフラ研修を表示」 「WBSを表示」"
                    className="flex-1 min-w-0 py-3.5 px-3 text-sm text-slate-800 placeholder:text-slate-400 border-0 outline-none bg-transparent"
                  />
                  <span className="flex items-center px-2 text-slate-500" aria-hidden>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
                    </svg>
                  </span>
                  <button
                    type="submit"
                    className="rounded-r-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white hover:bg-indigo-700 transition-colors shrink-0"
                  >
                    {isThinking ? '解析中…' : '実行'}
                  </button>
                </div>
              </form>
              <p className="mt-4 pt-3 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-sm text-slate-500 underline hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 rounded"
                >
                  ログアウト
                </button>
              </p>
            </div>

            {/* 2枚目カード — TRAINING はじめに */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">TRAINING</p>
              <h2 className="mt-1 text-lg font-bold text-slate-800">はじめに</h2>
              <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                プロフェッショナルとしての行動基準を確認したうえで、インフラ基礎課題 (Chapter 1~4) に進みます。
              </p>
              <OpenInNewTabButton
                url={getTrainingUrl('/training/intro')}
                label="別タブで開く"
                className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              />
            </div>

            {/* 解釈結果（検索時のみ表示） */}
            {resolution && (
              <section className="mt-6 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <p>
                    解釈結果:{' '}
                    <span className="font-medium text-slate-800">
                      {resolution.displayName}
                    </span>
                  </p>
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-600">
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
                  />
                </div>
              </section>
            )}
          </div>

          {/* ピン留めした課題（検索しなくてもすぐアクセス） */}
          {pinnedTraining.length > 0 && (
            <section className="mt-6 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 text-[11px] text-slate-700 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                PINNED · TRAINING
              </p>
              <p className="mt-1 text-xs text-slate-600">よく使う課題にワンクリックでアクセスできます。</p>
              <ul className="mt-3 space-y-2 text-slate-700">
                {pinnedTraining.includes('infra-basic-1') && (
                  <li className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">インフラ基礎課題1</span>
                        <span className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
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
                  <li className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">インフラ基礎課題2</span>
                        <span className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
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
                    </div>
                    <button
                      type="button"
                      onClick={() => openInfraOrShowIntro(getTrainingUrl('/training/infra-basic-2-top'))}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      別タブで開く
                    </button>
                  </li>
                )}
                {pinnedTraining.includes('infra-basic-3') && (
                  <li className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">インフラ基礎課題3</span>
                        <span className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
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
                    </div>
                    <button
                      type="button"
                      onClick={() => openInfraOrShowIntro(getTrainingUrl('/training/infra-basic-3-top'))}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      別タブで開く
                    </button>
                  </li>
                )}
              </ul>
            </section>
          )}

          {(canResumeL1 || canResumeL2) && (
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
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:border-amber-400 hover:bg-amber-50"
                  >
                    インフラ研修1を途中から再開（別タブ）
                  </button>
                )}
                {canResumeL2 && (
                  <button
                    type="button"
                    onClick={() => openInfraOrShowIntro(getTrainingUrl('/training/linux-level2'))}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:border-amber-400 hover:bg-amber-50"
                  >
                    インフラ研修2を途中から再開（別タブ）
                  </button>
                )}
              </div>
            </section>
          )}

          {/* サジェストチップ（画像通り: ライトグレー背景・ダークテキスト） */}
          <div className="mt-6 flex w-full max-w-2xl flex-wrap gap-2 text-[11px]">
            <span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">
              例) インフラ研修と入力
            </span>
            <span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">
              例) 今日の勤怠を開いて
            </span>
            <span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">
              例) プロジェクトAのタスクボード
            </span>
          </div>
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
}

function ResolvedModulePlaceholder({ resolution, pinnedTraining, trainingStatus, onTogglePin, onOpenInfraOrShowIntro }: PlaceholderProps) {
  if (resolution.feature === 'training') {
    const category = resolution.training.category

    if (category === 'linuxLevel1') {
      return (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">TRAINING · LINUX · LEVEL 1</p>
          <h2 className="mt-2 text-base font-semibold text-slate-800">インフラ研修1 — Linuxコマンド30問</h2>
          <p className="mt-1 text-xs text-slate-600">別タブで問題を開きました。タブを確認してください。</p>
          <p className="mt-2 text-[11px] text-slate-500">問題中は正誤を表示せず、30問終了後に得点を表示します。満点でクリアです。</p>
        </div>
      )
    }

    if (category === 'linuxLevel2') {
      return (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4 text-sm shadow-sm">
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
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            TRAINING · INFRA
          </p>
          <p className="mt-2 text-xs text-slate-500">検索結果</p>
          <h2 className="mt-1 text-base font-semibold text-slate-800">インフラ基礎課題</h2>

          <ul className="mt-4 space-y-2 text-slate-700">
            <li className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">インフラ基礎課題1</span>
                  {pinnedTraining.includes('infra-basic-1') && (
                    <span className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
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
            <li className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">インフラ基礎課題3</span>
                  {pinnedTraining.includes('infra-basic-3') && (
                    <span className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
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
              </div>
              <button
                type="button"
                onClick={() => onOpenInfraOrShowIntro(getTrainingUrl('/training/infra-basic-3-top'))}
                className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium bg-indigo-600 text-white hover:bg-indigo-700"
              >
                別タブで開く
              </button>
            </li>
            <li className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">インフラ基礎課題2</span>
                  {pinnedTraining.includes('infra-basic-2') && (
                    <span className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
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
              </div>
              <button
                type="button"
                onClick={() => onOpenInfraOrShowIntro(getTrainingUrl('/training/infra-basic-2-top'))}
                className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium bg-indigo-600 text-white hover:bg-indigo-700"
              >
                別タブで開く
              </button>
            </li>
          </ul>
        </div>
      )
    }

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
        <h2 className="text-base font-semibold text-slate-800">研修モジュール</h2>
        <p className="mt-1 text-xs text-slate-600">
          研修ポータルへのルーティング結果です。実装時には、ここから研修管理システムの画面へ遷移させます。
        </p>
      </div>
    )
  }

  if (resolution.feature === 'timeTracking') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
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
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
      <p>該当する機能が見つかりませんでした。別の表現でもう一度試してください。</p>
    </div>
  )
}

export default App
