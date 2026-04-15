/**
 * メインテーマ: 白ベース (Light)
 * 全ページを白/ライトで統一する。
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { OpenInNewTabButton } from './components/OpenInNewTabButton'
import { NeOSLogo } from './components/NeOSLogo'
import { SharedHeader } from './components/SharedHeader'
import type { CommandResolution } from './commandRouter'
import { resolveCommand } from './commandRouter'
import { L1_CLEARED_KEY } from './training/linuxLevel1Data'
import { L2_CLEARED_KEY } from './training/linuxLevel2Data'
import { INFRA_BASIC_1_CLEARED_KEY, INFRA_BASIC_1_PARAMS } from './training/infraBasic1Data'
import { INFRA_BASIC_3_2_CLEARED_KEY } from './training/infraBasic3Data'
import {
  getProgressKey,
  getDelayedTaskIds,
  isTask1Cleared,
} from './training/trainingWbsData'
import { isJTerada, J_TERADA_ALLOWED_LINKS } from './specialUsers'
import { VI_STEPS, SHELL_QUESTIONS } from './training/InfraBasic4Data'
import { clearIntroForCurrentUser } from './training/introGate'
import { LOGIN_FLAG_KEY, getCurrentDisplayName, getCurrentRole, USER_ROLE_KEY } from './auth'
import { restoreProgressToLocalStorage, type TraineeProgressSnapshot } from './traineeProgressStorage'
import { isProgressApiAvailable, postProgress, fetchMyProgress, fetchProgressFromApi, buildAuthHeaders, BASE_URL } from './progressApi'
import { createAccount, fetchAccounts, isAccountApiAvailable, deleteAccount, type Account } from './accountsApi'
import { safeGetItem, safeSetItem, safeRemoveItem, safeSessionRemoveItem, clearCookieValue } from './utils/storage'

type TrainingTaskId = 'infra-basic-1' | 'infra-basic-2' | 'infra-basic-3' | 'infra-basic-4'
type PinnableId = TrainingTaskId | 'intro'

const VALID_PIN_IDS: PinnableId[] = ['intro', 'infra-basic-1', 'infra-basic-2', 'infra-basic-3', 'infra-basic-4']
function filterPinnableIds(ids: string[]): PinnableId[] {
  return ids.filter((id): id is PinnableId => VALID_PIN_IDS.includes(id as PinnableId))
}

type TrainingStatus = {
  infraToolsCleared: boolean
  linuxL1Cleared: boolean
  linuxL2Cleared: boolean
  infraOsCloudCleared: boolean
}

function readTrainingStatus(): TrainingStatus {
  return {
    infraToolsCleared: safeGetItem(getProgressKey(INFRA_BASIC_1_CLEARED_KEY)) === 'true',
    linuxL1Cleared: safeGetItem(getProgressKey(L1_CLEARED_KEY)) === 'true',
    linuxL2Cleared: safeGetItem(getProgressKey(L2_CLEARED_KEY)) === 'true',
    infraOsCloudCleared: safeGetItem(getProgressKey(INFRA_BASIC_3_2_CLEARED_KEY)) === 'true',
  }
}

const TRAINING_PIN_KEY = 'kira-training-pins'
const SEARCH_HISTORY_KEY = 'kira-search-history'
const SEARCH_HISTORY_MAX = 10
const ADMIN_SESSION_KEY = 'kira-admin-logged-in'
const ADMIN_DELETE_PASSWORD = 'admin'

function loadSearchHistory(): string[] {
  const raw = safeGetItem(SEARCH_HISTORY_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v: unknown): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function saveSearchHistory(history: string[]) {
  safeSetItem(SEARCH_HISTORY_KEY, JSON.stringify(history))
}
const USER_DISPLAY_NAME_KEY = 'kira-user-display-name'
function getDisplayName(): string {
  return getCurrentDisplayName()
}

function isKiraTestUser(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const name = getDisplayName().trim().toLowerCase()
    return name === 'kira-test'
  } catch {
    return false
  }
}

function loadPinnedTrainingTasks(): PinnableId[] {
  const raw = safeGetItem(TRAINING_PIN_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (v: unknown): v is PinnableId =>
        v === 'intro' || v === 'infra-basic-1' || v === 'infra-basic-2' || v === 'infra-basic-3' || v === 'infra-basic-4',
    )
  } catch {
    return []
  }
}

function getTrainingUrl(path: string) {
  const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname || '/'}`.replace(/\/$/, '') || window.location.origin : ''
  return `${base}#${path}`
}


function handleLogout() {
  if (typeof window === 'undefined') return
  safeSessionRemoveItem(ADMIN_SESSION_KEY)
  safeRemoveItem(USER_DISPLAY_NAME_KEY)
  safeRemoveItem(LOGIN_FLAG_KEY)
  safeRemoveItem('kira-session-token')
  safeRemoveItem(USER_ROLE_KEY)
  clearCookieValue('kira-user-display-name')
  clearCookieValue('kira-user-logged-in')
  clearCookieValue('kira-session-token')
  const base = (window.location.origin + window.location.pathname + (window.location.search || '')).replace(/\/$/, '') || window.location.origin
  window.location.href = base + '#/login'
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
                  className="block rounded-xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-700 hover:bg-teal-100"
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
  const rawDisplayName = getDisplayName()
  if (isJTerada(rawDisplayName) && isTask1Cleared()) {
    return <JTeradaRestrictedView />
  }

  const [input, setInput] = useState('')
  const [resolution, setResolution] = useState<CommandResolution | null>(null)
  const [_isThinking, setIsThinking] = useState(false)
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatus>(() => readTrainingStatus())
  /** 初期値 null = 未ロード。サーバー取得完了まで PUT をブロックするため。 */
  const [pinnedTraining, setPinnedTraining] = useState<PinnableId[] | null>(null)
  const [serverSnapshot, setServerSnapshot] = useState<TraineeProgressSnapshot | null>(null)
  const [isSnapLoaded, setIsSnapLoaded] = useState(false)
  /** サーバー初回 GET が完了し pinnedTraining に反映されるまで true にしない。それまでは保存処理をブロック。 */
  const isDataReady = useRef(false)
  const [showIntroRequiredPopup, setShowIntroRequiredPopup] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>(() => loadSearchHistory())
  const [showSearchHistory, setShowSearchHistory] = useState(false)
  const [searchHistoryHighlightIndex, setSearchHistoryHighlightIndex] = useState(-1)
  const [isListening, setIsListening] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountPassword, setNewAccountPassword] = useState('')
  const [accountMessage, setAccountMessage] = useState<string | null>(null)
  const [showAccountPanel, setShowAccountPanel] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [ec2Snapshots, setEc2Snapshots] = useState<Record<string, import('./progressApi').TraineeProgressFromApi>>({})
  const [ec2EditHost, setEc2EditHost] = useState<Record<string, string>>({})
  const [ec2EditUsername, setEc2EditUsername] = useState<Record<string, string>>({})
  const [ec2EditPassword, setEc2EditPassword] = useState<Record<string, string>>({})
  const [showEc2Panel, setShowEc2Panel] = useState(false)
  const [ec2SaveMsg, setEc2SaveMsg] = useState<string | null>(null)
  const [isCreatingServer, setIsCreatingServer] = useState(false)
  const [serverCreateMsg, setServerCreateMsg] = useState<string | null>(null)
  const [serverCreateProgress, setServerCreateProgress] = useState(0)
  const [serverCreatedModal, setServerCreatedModal] = useState<{ publicIp: string; keyPairName: string; pemFilename: string } | null>(null)
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

  /** はじめに完了判定（serverSnapshotから派生したstate） */
  const [isIntroCompleted, setIsIntroCompleted] = useState(false)
  useEffect(() => {
    if (!serverSnapshot) return
    const completed =
      Number(serverSnapshot.introStep ?? 0) >= 5 &&
      serverSnapshot.introConfirmed === true
    setIsIntroCompleted(completed)
  }, [serverSnapshot])

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
      setTrainingStatus(readTrainingStatus())
    } catch {
      // ignore
    }
  }, [])

  /** 保存処理の唯一の入口。isDataReady かつ pinnedTraining !== null のときだけ PUT する。 */
  const guardedSavePins = useCallback(
    (name: string, pins: PinnableId[]) => {
      if (!isDataReady.current) {
        console.log('[Sync] 保存ブロック中')
        return
      }
      // DynamoDBデータ未取得時はスキップ（localStorageを参照しない）
      if (!serverSnapshot) return
      const merged = {
        ...serverSnapshot,
        pins: pins as string[],
        infra4ViDoneSteps: serverSnapshot.infra4ViDoneSteps ?? [],
        infra4ShellDoneQuestions: serverSnapshot.infra4ShellDoneQuestions ?? [],
        infra4Rag: serverSnapshot.infra4Rag ?? null,
      }
      if (isProgressApiAvailable()) void postProgress(name, merged)
    },
    [serverSnapshot],
  )

  const handleTogglePin = useCallback((id: PinnableId) => {
    const name = getDisplayName().trim().toLowerCase()
    setPinnedTraining((prev) => {
      const list = prev ?? []
      const exists = list.includes(id)
      const next = exists ? list.filter((p) => p !== id) : [...list, id]
      if (name && name !== 'admin') guardedSavePins(name, next)
      safeSetItem(TRAINING_PIN_KEY, JSON.stringify(next))
      return next
    })
  }, [guardedSavePins])

  useEffect(() => {
    if (!resolution || resolution.feature !== 'training') return
    const cat = resolution.training.category
    if (cat === 'intro' || cat === 'wbs') {
      return
    }
    if (cat === 'linuxLevel1') {
      if (openedRef.current === 'linuxLevel1') return
      if (!isIntroCompleted) setShowIntroRequiredPopup(true)
      else {
        window.open(getTrainingUrl('/training/linux-level1'), '_blank')
        openedRef.current = 'linuxLevel1'
      }
    } else if (cat === 'linuxLevel2') {
      if (openedRef.current === 'linuxLevel2') return
      if (!isIntroCompleted) setShowIntroRequiredPopup(true)
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

  const displayName = getDisplayName()?.toLowerCase()
  const isAdminView = displayName === 'admin' || getCurrentRole() === 'manager'
  const isKiraTest = isKiraTestUser()

  /** 初回のみ: サーバーから進捗を取得し pinnedTraining をセット。必要なら localStorage を 1 回だけサーバーにマージ。完了後に isDataReady を true にする。 */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const name = getDisplayName().trim().toLowerCase()
    if (isAdminView || !name || name === 'admin') {
      setPinnedTraining([])
      isDataReady.current = true
      return
    }
    if (!isProgressApiAvailable()) {
      setPinnedTraining([])
      isDataReady.current = true
      return
    }
    isDataReady.current = false
    let cancelled = false
    const load = async () => {
      const snap = await fetchMyProgress(name)
      if (cancelled) return
      if (snap) {
        if (snap.introConfirmed && Number(snap.introStep ?? 0) < 5) {
          clearIntroForCurrentUser()
        }
        restoreProgressToLocalStorage(name, snap)
        setServerSnapshot(snap)
      } else {
        setServerSnapshot(null)
        // serverSnapshot は null のままにして、スケルトン解除は別フラグで管理する
      }
      const serverPins = filterPinnableIds(snap?.pins ?? [])
      const localPins = loadPinnedTrainingTasks()
      if (serverPins.length > 0) {
        setPinnedTraining(serverPins)
        console.log('[Sync] サーバーから取得完了')
      } else if (localPins.length > 0) {
        // DynamoDBデータ（snap）をベースにpinsだけを追加して保存（localStorageをベースにしない）
        const merged = { ...(snap ?? {} as TraineeProgressSnapshot), pins: localPins as string[] }
        if (isProgressApiAvailable()) await postProgress(name, merged)
        setPinnedTraining(localPins)
        console.log('[Sync] 初回: localStorage をサーバーにマージしました')
      } else {
        setPinnedTraining([])
        console.log('[Sync] サーバーから取得完了')
      }
      setIsSnapLoaded(true)
      isDataReady.current = true
    }
    void load()
    return () => { cancelled = true }
  }, [isAdminView])


  // admin 用: アカウント一覧を定期取得し、既存の進捗から自動的に取り込む
  useEffect(() => {
    if (!isAdminView || !isAccountApiAvailable()) return
    let cancelled = false
    const load = async () => {
      if (!isAccountApiAvailable()) return
      const current = await fetchAccounts()
      if (!cancelled) {
        setAccounts(current)
      }
      // 進捗APIが利用可能なら、既存の進捗 + j-terada から不足分を自動登録
      if (!isProgressApiAvailable()) return
      const trainees = await fetchProgressFromApi()
      const snaps: Record<string, import('./progressApi').TraineeProgressFromApi> = {}
      for (const t of trainees) {
        if (t.traineeId) snaps[t.traineeId] = t
      }
      if (!cancelled) setEc2Snapshots(snaps)
      const baseIds = trainees
        .map((t) => (t.traineeId || '').trim().toLowerCase())
        .filter((id) => id && id !== 'admin')
      const extraIds = ['j-terada']
      const allIds = Array.from(new Set([...baseIds, ...extraIds]))
      const existing = new Set(current.map((a) => a.username))
      const missing = allIds.filter((id) => !existing.has(id))
      for (const id of missing) {
        // 既に存在する場合も含めて上書き Put。デフォルトパスワードは「ユーザー名」と同じ。
        // eslint-disable-next-line no-await-in-loop
        await createAccount(id, id)
      }
      if (missing.length > 0 && !cancelled) {
        const refreshed = await fetchAccounts()
        setAccounts(refreshed)
      }
    }
    void load()
    const id = window.setInterval(() => {
      void load()
    }, 5000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [isAdminView])

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    setAccountMessage(null)
    const name = newAccountName.trim().toLowerCase()
    if (!name || name === 'admin') {
      setAccountMessage('有効なユーザー名を入力してください。（admin は除外）')
      return
    }
    if (!newAccountPassword) {
      setAccountMessage('パスワードを入力してください。')
      return
    }
    if (!isAccountApiAvailable()) {
      setAccountMessage('アカウントAPIが未設定です。VITE_PROGRESS_API_URL を確認してください。')
      return
    }
    const ok = await createAccount(name, newAccountPassword)
    if (!ok) {
      setAccountMessage('アカウント作成に失敗しました。ネットワークやAPI設定を確認してください。')
      return
    }
    setNewAccountName('')
    setNewAccountPassword('')
    setAccountMessage('アカウントを作成しました。')
    const list = await fetchAccounts()
    setAccounts(list)
  }

  async function handleImportFromProgress() {
    setAccountMessage(null)
    if (!isAccountApiAvailable() || !isProgressApiAvailable()) {
      setAccountMessage('API が未設定のため取り込みできません。VITE_PROGRESS_API_URL を確認してください。')
      return
    }
    const trainees = await fetchProgressFromApi()
    const baseIds = trainees
      .map((t) => (t.traineeId || '').trim().toLowerCase())
      .filter((id) => id && id !== 'admin')
    const extraIds = ['j-terada']
    const ids = Array.from(new Set([...baseIds, ...extraIds]))
    if (ids.length === 0) {
      setAccountMessage('取り込める既存ユーザーが見つかりませんでした。')
      return
    }
    for (const id of ids) {
      // 既に存在する場合も含めて上書き Put。デフォルトパスワードは「ユーザー名」と同じ。
      // eslint-disable-next-line no-await-in-loop
      await createAccount(id, id)
    }
    const list = await fetchAccounts()
    setAccounts(list)
    setAccountMessage(`既存の進捗から ${ids.length} 件のユーザーを取り込みました。（初期パスワードはユーザー名と同じです）`)
  }

  async function handleConfirmDelete(e: React.FormEvent) {
    e.preventDefault()
    setDeleteError(null)
    if (!deleteTarget) return
    if (deletePassword !== ADMIN_DELETE_PASSWORD) {
      setDeleteError('パスワードが正しくありません。')
      return
    }
    const ok = await deleteAccount(deleteTarget)
    if (!ok) {
      setDeleteError('削除に失敗しました。時間をおいて再度お試しください。')
      return
    }
    setDeletePassword('')
    setDeleteTarget(null)
    const list = await fetchAccounts()
    setAccounts(list)
  }

  async function saveEc2ForUser(username: string) {
    setEc2SaveMsg(null)
    const snap = ec2Snapshots[username]
    const host = (ec2EditHost[username] ?? snap?.ec2Host ?? '').trim() || null
    const uname = (ec2EditUsername[username] ?? snap?.ec2Username ?? '').trim() || null
    const pass = (ec2EditPassword[username] ?? snap?.ec2Password ?? '').trim() || null
    // snapはDynamoDB取得済みデータ。未取得時はlocalStorageを参照せず空ベースを使う
    const base: TraineeProgressSnapshot = snap
      ? { ...snap }
      : { introConfirmed: false, introAt: null, wbsPercent: 0, chapterProgress: [], currentDay: 0, delayedIds: [], updatedAt: '', pins: [] }
    const updated: TraineeProgressSnapshot = { ...base, ec2Host: host, ec2Username: uname, ec2Password: pass }
    const ok = await postProgress(username, updated)
    if (ok) {
      setEc2Snapshots((prev) => ({ ...prev, [username]: { ...base, traineeId: username, ec2Host: host, ec2Username: uname, ec2Password: pass } as import('./progressApi').TraineeProgressFromApi }))
      setEc2SaveMsg(`${username} のEC2接続情報を保存しました。`)
    } else {
      setEc2SaveMsg(`${username} の保存に失敗しました。`)
    }
  }

  /** 受講生画面用：サーバー側の最新進捗（DynamoDB）のスナップショットを定期取得して同期表示に使う */
  const prevSnapshotStrRef = useRef('')
  useEffect(() => {
    if (isAdminView || !isProgressApiAvailable() || typeof window === 'undefined') return
    const name = getDisplayName().trim().toLowerCase()
    if (!name || name === 'admin') return

    let cancelled = false
    const load = async () => {
      const snap = await fetchMyProgress(name)
      if (cancelled || !snap) return
      if (snap.introConfirmed && Number(snap.introStep ?? 0) < 5) {
        clearIntroForCurrentUser()
      }
      // 前回と同じデータならstate更新しない（チラつき防止）
      const newStr = JSON.stringify(snap)
      if (newStr === prevSnapshotStrRef.current) return
      prevSnapshotStrRef.current = newStr
      setServerSnapshot(snap)
    }
    void load()
    const id = window.setInterval(() => {
      void load()
    }, 5000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [isAdminView])

  const navigate = useNavigate()

  /** 演習サーバー作成（実EC2） */
  const handleCreateServer = async () => {
    if (isCreatingServer) return
    const username = getDisplayName().trim().toLowerCase()
    if (!username || username === 'admin') return
    setIsCreatingServer(true)
    setServerCreateMsg(null)
    setServerCreateProgress(5)

    // プログレスバーアニメーション（API 完了まで 90% まで進める）
    const progressInterval = window.setInterval(() => {
      setServerCreateProgress((prev) => prev < 88 ? prev + 1 : prev)
    }, 600)

    try {
      const res = await fetch(`${BASE_URL}/server/create`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'omit',
        body: JSON.stringify({}),
      })
      window.clearInterval(progressInterval)
      setServerCreateProgress(100)

      if (!res.ok) {
        const data = (await res.json()) as { error?: string; message?: string }
        if (data.error === 'server_exists') {
          setServerCreateMsg('サーバーは既に作成されています')
        } else {
          setServerCreateMsg('サーバーの作成に失敗しました。もう一度お試しください')
        }
        return
      }

      const data = (await res.json()) as {
        ok: boolean; instanceId?: string; publicIp?: string | null;
        keyPairName?: string; privateKey?: string; ec2CreatedAt?: string; ec2StartTime?: string; ec2Username?: string
      }

      // 秘密鍵をblobでDL
      const keyPairName = data.keyPairName ?? `nic-${username}`
      const pemFilename = `${keyPairName}.pem`
      if (data.privateKey) {
        const blob = new Blob([data.privateKey], { type: 'application/octet-stream' })
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = pemFilename
        a.click()
        URL.revokeObjectURL(blobUrl)
      }

      // ローカル状態を DynamoDB 保存済みデータで更新
      const base: TraineeProgressSnapshot = serverSnapshot ?? {
        introConfirmed: false, introAt: null, wbsPercent: 0,
        chapterProgress: [], currentDay: 0, delayedIds: [], updatedAt: '', pins: [],
      }
      const updated: TraineeProgressSnapshot = {
        ...base,
        ec2PublicIp: data.publicIp ?? null,
        ec2State: 'running',
        keyPairName,
        ec2Username: data.ec2Username ?? 'ubuntu',
        ec2CreatedAt: data.ec2CreatedAt ?? null,
        ec2StartTime: data.ec2StartTime ?? null,
        ec2Host: data.publicIp ?? null,
        updatedAt: new Date().toISOString(),
      }
      setServerSnapshot(updated)

      // 成功モーダルを表示
      setServerCreatedModal({ publicIp: data.publicIp ?? '', keyPairName, pemFilename })
    } catch {
      window.clearInterval(progressInterval)
      setServerCreateProgress(0)
      setServerCreateMsg('サーバーの作成に失敗しました。もう一度お試しください')
    } finally {
      setIsCreatingServer(false)
    }
  }

  /** 演習サーバー停止（モック） */
  const handleStopServer = async () => {
    const username = getDisplayName().trim().toLowerCase()
    if (!username || username === 'admin' || !serverSnapshot || !isProgressApiAvailable()) return
    const updated: TraineeProgressSnapshot = { ...serverSnapshot, ec2State: 'stopped', updatedAt: new Date().toISOString() }
    setServerSnapshot(updated)
    await postProgress(username, updated)
  }

  /** 演習サーバー起動（モック） */
  const handleStartServer = async () => {
    const username = getDisplayName().trim().toLowerCase()
    if (!username || username === 'admin' || !serverSnapshot || !isProgressApiAvailable()) return
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const ec2StartTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`
    const updated: TraineeProgressSnapshot = { ...serverSnapshot, ec2State: 'running', ec2StartTime, updatedAt: new Date().toISOString() }
    setServerSnapshot(updated)
    await postProgress(username, updated)
  }

  // 「はじめに」（introStep === 5 かつ introConfirmed）完了後 かつ trainingStartDate が設定されている場合のみ遅延判定する
  const trainingStarted = !!serverSnapshot
    && Number(serverSnapshot.introStep ?? 0) === 5
    && serverSnapshot.introConfirmed === true
    && !!serverSnapshot.trainingStartDate
  const delayed = trainingStarted && getDelayedTaskIds().length > 0
  // DynamoDB取得完了まで null を返す（チラつき防止）。取得後はサブタスクのクリア数から計算。
  const progressPct = pinnedTraining === null || !serverSnapshot
    ? null
    : (() => {
        const s = serverSnapshot
        const ch = Array.isArray(s.chapterProgress) ? s.chapterProgress : []
        const subCleared = [
          Number(s.introStep ?? 0) >= 5 && s.introConfirmed ? 1 : 0,     // はじめに
          s.infra1Cleared ? 1 : 0,                                   // 1-1
          s.l1Cleared ? 1 : 0,                                       // 1-2
          ch[1]?.cleared ? 1 : 0,                                    // 2-x
          ch[2]?.cleared ? 1 : 0,                                    // 3-x
          ch[3]?.cleared ? 1 : 0,                                    // 4-x
        ].reduce((a, b) => a + b, 0)
        return { pct: Math.round(subCleared / 8 * 100), completed: subCleared, total: 8 }
      })()
  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* サーバー作成成功モーダル */}
      {serverCreatedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-xl">✓</span>
              <h2 className="text-lg font-bold text-slate-800">サーバーを作成しました</h2>
            </div>
            <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">IPアドレス</p>
                <p className="font-bold font-mono text-slate-800 text-lg">{serverCreatedModal.publicIp || '取得中...'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">接続ユーザー名</p>
                <p className="font-semibold font-mono text-slate-700">ubuntu</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">秘密鍵ファイル（ダウンロード済み）</p>
                <p className="font-mono text-slate-600 text-xs break-all">{serverCreatedModal.pemFilename}</p>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">この情報はトップページの「あなたの演習サーバー」セクションでいつでも確認できます。</p>
            <p className="mt-1.5 text-xs text-amber-600">秘密鍵は作成時のみダウンロード可能です。大切に保管してください。</p>
            <button
              type="button"
              onClick={() => setServerCreatedModal(null)}
              className="mt-5 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              研修を始める
            </button>
          </div>
        </div>
      )}
      <div className="mx-auto flex min-h-screen flex-col">
        <SharedHeader
          delayed={delayed}
          progressPct={progressPct?.pct ?? null}
          completedCount={progressPct?.completed}
          totalCount={progressPct?.total}
          onWbs={() => { window.location.hash = '#/training/infra-wbs' }}
          onLogout={handleLogout}
          isAdmin={isAdminView}
          onAdminMenu={() => (window.location.hash = '#/admin')}
          onAccountPanel={() => setShowAccountPanel(true)}
        />

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
                  className="flex-1 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
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

        <main className="mt-4 flex flex-1 flex-col items-center justify-start mx-auto max-w-5xl px-6 w-full">
          {isAdminView ? (
            <div className="w-full max-w-2xl space-y-4">
              <h1 className="text-lg font-semibold text-slate-800">講師用メニュー</h1>
              <section className="space-y-2">
                <p className="text-sm text-slate-600">受講生の進捗を確認できます。</p>
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className="flex w-full flex-col items-start rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-teal-200 hover:bg-teal-50/50"
                >
                  <span className="text-base font-semibold text-slate-800">受講生の進捗</span>
                  <span className="mt-1 text-xs text-slate-600">WBSに基づく進捗一覧を表示</span>
                </button>
              </section>

              {showAccountPanel && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="account-manage-title"
                >
                  <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
                    <div className="flex items-center justify-between gap-3">
                      <h2 id="account-manage-title" className="text-base font-semibold text-slate-800">
                        アカウント管理
                      </h2>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAccountPanel(false)
                          setAccountMessage(null)
                          setDeleteTarget(null)
                          setDeletePassword('')
                          setDeleteError(null)
                        }}
                        className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"
                      >
                        閉じる
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      admin で作成したアカウントのみ、受講生画面からログインできます。
                    </p>

                    <form onSubmit={handleCreateAccount} className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                        placeholder="新しいユーザー名（例: kira-test）"
                        className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                      <input
                        type="password"
                        value={newAccountPassword}
                        onChange={(e) => setNewAccountPassword(e.target.value)}
                        placeholder="パスワード"
                        className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                      <button
                        type="submit"
                        disabled={!newAccountName.trim() || !newAccountPassword}
                        className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        アカウント作成
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={handleImportFromProgress}
                      className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                    >
                      既存の進捗から受講生アカウントを取り込む
                    </button>
                    {accountMessage && <p className="mt-1 text-[11px] text-slate-600">{accountMessage}</p>}

                    <div className="mt-4">
                      <p className="text-[11px] font-medium text-slate-700">作成済みアカウント一覧</p>
                      {accounts.length === 0 ? (
                        <p className="mt-1 text-[11px] text-slate-500">まだアカウントがありません。</p>
                      ) : (
                        <ul className="mt-2 space-y-1 max-h-40 overflow-auto text-[11px] text-slate-700">
                          {accounts.map((a) => (
                            <li key={a.username} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
                              <span className="font-medium">{a.username}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteTarget(a.username)
                                  setDeletePassword('')
                                  setDeleteError(null)
                                }}
                                className="rounded-lg bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700 hover:bg-rose-200"
                              >
                                削除
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {deleteTarget && (
                      <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3">
                        <p className="text-xs font-semibold text-rose-800">ファイナルアンサー？</p>
                        <p className="mt-1 text-[11px] text-rose-700">
                          ユーザー「{deleteTarget}」を削除します。admin のパスワードを再入力してください。
                        </p>
                        <form onSubmit={handleConfirmDelete} className="mt-2 flex flex-col gap-2">
                          <input
                            type="password"
                            value={deletePassword}
                            onChange={(e) => setDeletePassword(e.target.value)}
                            placeholder="admin パスワード"
                            className="w-full rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-rose-300 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                          />
                          {deleteError && <p className="text-[11px] text-rose-700">{deleteError}</p>}
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteTarget(null)
                                setDeletePassword('')
                                setDeleteError(null)
                              }}
                              className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                            >
                              やめる
                            </button>
                            <button
                              type="submit"
                              className="rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-rose-700"
                            >
                              削除する
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                    <div className="mt-5">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] font-medium text-slate-700">EC2接続情報設定</p>
                        <button
                          type="button"
                          onClick={() => setShowEc2Panel((v) => !v)}
                          className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] text-slate-600 hover:bg-slate-200"
                        >
                          {showEc2Panel ? '閉じる' : '展開'}
                        </button>
                      </div>
                      {showEc2Panel && (
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {accounts.map((a) => {
                            const snap = ec2Snapshots[a.username]
                            return (
                              <div key={a.username} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                                <p className="text-[11px] font-semibold text-slate-700 mb-1.5">{a.username}</p>
                                <div className="space-y-1">
                                  <input
                                    type="text"
                                    placeholder={`接続先IP（例: ${INFRA_BASIC_1_PARAMS.host}）`}
                                    value={ec2EditHost[a.username] ?? snap?.ec2Host ?? ''}
                                    onChange={(e) => setEc2EditHost((prev) => ({ ...prev, [a.username]: e.target.value }))}
                                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none"
                                  />
                                  <input
                                    type="text"
                                    placeholder={`ユーザー名（例: ${INFRA_BASIC_1_PARAMS.userKensyu}）`}
                                    value={ec2EditUsername[a.username] ?? snap?.ec2Username ?? ''}
                                    onChange={(e) => setEc2EditUsername((prev) => ({ ...prev, [a.username]: e.target.value }))}
                                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none"
                                  />
                                  <input
                                    type="text"
                                    placeholder={`パスワード（例: ${INFRA_BASIC_1_PARAMS.password}）`}
                                    value={ec2EditPassword[a.username] ?? snap?.ec2Password ?? ''}
                                    onChange={(e) => setEc2EditPassword((prev) => ({ ...prev, [a.username]: e.target.value }))}
                                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => void saveEc2ForUser(a.username)}
                                    className="mt-1 rounded bg-teal-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-teal-700"
                                  >
                                    保存
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                          {ec2SaveMsg && <p className="text-[11px] text-emerald-700">{ec2SaveMsg}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
          <>
          <div className="w-full max-w-2xl space-y-6">
            {/* 進捗リセットボタン（開発用・kira-testのみ） */}
            {isKiraTestUser() && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm('すべての進捗データをリセットしますか？\n（この操作は元に戻せません）')) return
                    const username = getCurrentDisplayName()
                    if (!username || !isProgressApiAvailable()) {
                      alert('リセットできませんでした。')
                      return
                    }
                    try {
                      await postProgress(username, {
                        introConfirmed: false,
                        introAt: null,
                        introStep: 0,
                        introRiskAnswers: {},
                        wbsPercent: 0,
                        chapterProgress: [],
                        currentDay: 0,
                        delayedIds: [],
                        updatedAt: new Date().toISOString(),
                        pins: [],
                        infra1Checkboxes: [],
                        infra1Cleared: false,
                        l1CurrentPart: 0,
                        l1CurrentQuestion: 0,
                        l1Cleared: false,
                        l2CurrentQuestion: 0,
                        infra32Answers: {},
                        infra4ViDoneSteps: [],
                        infra4ShellDoneQuestions: [],
                        infra5PhaseDone: [],
                        infra5BuildDone: [],
                        infra5TroubleDone: [],
                        infra5SecDone: [],
                      })
                      alert('進捗をリセットしました。ページをリロードします。')
                      window.location.reload()
                    } catch {
                      alert('リセットに失敗しました。')
                    }
                  }}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100"
                >
                  進捗リセット（開発用）
                </button>
              </div>
            )}
            {/* つづきから / はじめに案内バナー: serverSnapshot確定後に一度だけ表示を決定 */}
            {(() => {
              // ── ローディング: snap未取得時はスケルトンのみ表示 ──
              if (!isSnapLoaded) {
                return (
                  <div className="rounded-2xl border-2 border-slate-200 bg-slate-100 p-6 shadow-sm animate-pulse">
                    <div className="h-3 w-20 rounded bg-slate-200" />
                    <div className="mt-3 h-5 w-32 rounded bg-slate-200" />
                    <div className="mt-3 h-4 w-3/4 rounded bg-slate-200" />
                    <div className="mt-5 h-10 w-36 rounded-xl bg-slate-200" />
                  </div>
                )
              }

              const snap = serverSnapshot ?? ({} as TraineeProgressSnapshot)
              const introStep = Number(snap.introStep ?? 0)

              // ── introStepが0: はじめに案内バナーのみ ──
              if (introStep === 0) {
                return (
                  <div className="rounded-2xl border-2 border-teal-400 bg-amber-50 p-6 shadow-sm">
                    <p className="text-sm font-semibold text-amber-800">はじめに</p>
                    <p className="mt-2 text-sm text-slate-700">
                      インフラ基礎課題に進む前に、「はじめに」でプロフェッショナルとしての行動基準を確認してください。
                    </p>
                    <OpenInNewTabButton
                      url={getTrainingUrl('/training/intro')}
                      label="はじめに"
                      className="mt-4 inline-flex rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
                    />
                  </div>
                )
              }

              // ── introStep 1-4: つづきからカード（はじめにの続き）──
              if (introStep >= 1 && introStep <= 4) {
                const stepLabels: Record<number, string> = {
                  1: 'はじめに · 行動基準の確認 Step1/5',
                  2: 'はじめに · AI利用・機密保持 Step2/5',
                  3: 'はじめに · 物理セキュリティ Step3/5',
                  4: 'はじめに · インシデント報告 Step4/5',
                }
                return (
                  <div className="rounded-2xl border-2 border-teal-400 bg-white p-6 shadow-sm">
                    <h2 className="mt-2 text-base font-semibold text-slate-800">つづきから</h2>
                    <p className="mt-1 text-sm text-slate-700">{stepLabels[introStep]}</p>
                    <button type="button" onClick={() => { window.location.hash = '#/training/intro' }} className="mt-4 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700">つづきから →</button>
                  </div>
                )
              }

              // ── introStep 5以上: 課題進捗で「つづきから」を判定 ──

              // 課題1-2途中（最優先）
              const l1Part = snap.l1CurrentPart ?? 0
              const l1Q = snap.l1CurrentQuestion ?? 0
              const l1InProgress = (l1Part > 0 || l1Q > 0) && !(snap.l1Cleared ?? false)
              if (l1InProgress) {
                const partLabels = ['基本操作', 'サーバー構築', '実践問題']
                const partLabel = partLabels[l1Part] ?? '基本操作'
                return (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mt-2 text-base font-semibold text-slate-800">つづきから</h2>
                    <p className="mt-1 text-sm text-slate-700">課題1-2 · {partLabel} {l1Q + 1}/10問</p>
                    <button type="button" onClick={() => {
                      if (isIntroCompleted) window.open(getTrainingUrl('/training/linux-level1'), '_blank')
                      else setShowIntroRequiredPopup(true)
                    }} className="mt-4 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700">つづきから →</button>
                  </div>
                )
              }

              // 課題1-1途中
              const infra1InProgress = (snap.infra1Checkboxes ?? []).some(Boolean) && !(snap.infra1Cleared ?? false)
              if (infra1InProgress) {
                return (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mt-2 text-base font-semibold text-slate-800">つづきから</h2>
                    <p className="mt-1 text-sm text-slate-700">課題1-1 · ツール演習（途中から再開）</p>
                    <button type="button" onClick={() => {
                      if (isIntroCompleted) window.open(getTrainingUrl('/training/infra-basic-1'), '_blank')
                      else setShowIntroRequiredPopup(true)
                    }} className="mt-4 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700">つづきから →</button>
                  </div>
                )
              }

              // 課題2-2途中
              const l2Q = snap.l2CurrentQuestion ?? 0
              if (l2Q > 0) {
                return (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mt-2 text-base font-semibold text-slate-800">つづきから</h2>
                    <p className="mt-1 text-sm text-slate-700">課題2-2 · TCP/IP {l2Q + 1}/10問</p>
                    <button type="button" onClick={() => {
                      if (isIntroCompleted) window.open(getTrainingUrl('/training/linux-level2'), '_blank')
                      else setShowIntroRequiredPopup(true)
                    }} className="mt-4 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700">つづきから →</button>
                  </div>
                )
              }

              // 課題3-2途中
              const infra32InProgress = Object.values(snap.infra32Answers ?? {}).some((v) => v && String(v).trim())
              if (infra32InProgress) {
                return (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mt-2 text-base font-semibold text-slate-800">つづきから</h2>
                    <p className="mt-1 text-sm text-slate-700">課題3-2 · 理解度チェック(途中から再開)</p>
                    <button type="button" onClick={() => {
                      if (isIntroCompleted) window.open(getTrainingUrl('/training/infra-basic-3-top'), '_blank')
                      else setShowIntroRequiredPopup(true)
                    }} className="mt-4 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700">つづきから →</button>
                  </div>
                )
              }

              // 課題4-1途中
              const vi4Done = (snap.infra4ViDoneSteps ?? []).length
              if (vi4Done > 0 && vi4Done < VI_STEPS.length) {
                return (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mt-2 text-base font-semibold text-slate-800">つづきから</h2>
                    <p className="mt-1 text-sm text-slate-700">課題4-1 · vi演習(途中から再開)</p>
                    <button type="button" onClick={() => {
                      if (isIntroCompleted) window.open(getTrainingUrl('/training/infra-basic-4'), '_blank')
                      else setShowIntroRequiredPopup(true)
                    }} className="mt-4 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700">つづきから →</button>
                  </div>
                )
              }

              // 課題4-2途中
              const shell4Done = (snap.infra4ShellDoneQuestions ?? []).length
              if (shell4Done > 0 && shell4Done < SHELL_QUESTIONS.length) {
                return (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mt-2 text-base font-semibold text-slate-800">つづきから</h2>
                    <p className="mt-1 text-sm text-slate-700">課題4-2 · シェルスクリプト(途中から再開)</p>
                    <button type="button" onClick={() => {
                      if (isIntroCompleted) window.open(getTrainingUrl('/training/infra-basic-4'), '_blank')
                      else setShowIntroRequiredPopup(true)
                    }} className="mt-4 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700">つづきから →</button>
                  </div>
                )
              }

              // 全課題完了: つづきからカードを非表示
              return null
            })()}
            {/* j-terada 用：はじめにの下に課題1完了後の案内を表示。課題1クリア前はリンク無効 */}
            {isJTerada(getDisplayName()) && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-base font-semibold text-teal-900">
                  インフラ基礎課題1が完了したら、以下の課題を実施してください。
                </p>
                <ul className="mt-4 space-y-3">
                  <li>
                    {isTask1Cleared() ? (
                      <a
                        href="https://docs.google.com/presentation/d/1Xw--LXH056ekfvkneyzl-ZCFPKJon4vd/edit?usp=drivesdk&ouid=100622650885455094391&rtpof=true&sd=true"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-medium text-teal-800 shadow-sm ring-1 ring-teal-200 hover:bg-teal-100 hover:ring-teal-300"
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
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-medium text-teal-800 shadow-sm ring-1 ring-teal-200 hover:bg-teal-100 hover:ring-teal-300"
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
            <div className="hidden">
              <div className="relative" ref={searchContainerRef}>
                <form ref={searchFormRef} onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <input type="text" value={input} onChange={(event) => setInput(event.target.value)} />
                    <button type="button" onClick={toggleVoiceInput} disabled={_isThinking} />
                  </div>
                </form>
                {showSearchHistory && searchHistory.length > 0 && (
                  <ul className="absolute top-full left-0 right-0 mt-1 rounded-lg bg-white shadow-lg py-1 z-10 max-h-60 overflow-auto">
                    {searchHistory.map((item, index) => (
                      <li
                        key={item}
                        className={`group flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 ${
                          index === searchHistoryHighlightIndex ? 'bg-teal-50' : ''
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
                    pinnedTraining={pinnedTraining ?? []}
                    trainingStatus={trainingStatus}
                    onTogglePin={handleTogglePin}
                    onOpenInfraOrShowIntro={(url: string) => {
                      if (isIntroCompleted) window.open(url, '_blank')
                      else setShowIntroRequiredPopup(true)
                    }}
                    onOpenIntro={() => { window.location.hash = '#/training/intro' }}
                    onOpenWbs={() => { window.location.hash = '#/training/infra-wbs' }}
                  />
                </div>
              </section>
            )}
          </div>

          {/* ピン留めした課題（検索しなくてもすぐアクセス） */}
          {(pinnedTraining ?? []).length > 0 && (
            <section className="mt-6 w-full max-w-2xl rounded-2xl bg-white p-4 text-[11px] text-slate-700 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                ピン留め
              </p>
              <ul className="mt-3 space-y-2 text-slate-700">
                {(pinnedTraining ?? []).includes('intro') && (
                  <li className="flex flex-col gap-1 rounded-xl bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">はじめに</span>
                        <span className="inline-flex items-center justify-center rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          📌
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTogglePin('intro')}
                        className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-500"
                      >
                        <span aria-hidden style={{ filter: 'grayscale(1) opacity(0.5)' }}>📌</span>
                        ピン解除
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => { window.location.hash = '#/training/intro' }}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium bg-teal-600 text-white hover:bg-teal-700"
                    >
                      開く
                    </button>
                  </li>
                )}
                {(pinnedTraining ?? []).includes('infra-basic-1') && (
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
                        className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-500"
                      >
                        <span aria-hidden style={{ filter: 'grayscale(1) opacity(0.5)' }}>📌</span>
                        ピン解除
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (isIntroCompleted || isKiraTest) window.open(getTrainingUrl('/training/infra-basic-top'), '_blank')
                        else setShowIntroRequiredPopup(true)
                      }}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium bg-teal-600 text-white hover:bg-teal-700"
                    >
                      開く
                    </button>
                  </li>
                )}
                {(pinnedTraining ?? []).includes('infra-basic-2') && (
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
                        className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-500"
                      >
                        <span aria-hidden style={{ filter: 'grayscale(1) opacity(0.5)' }}>📌</span>
                        ピン解除
                      </button>
                      {!isKiraTest && !(trainingStatus.infraToolsCleared && trainingStatus.linuxL1Cleared) && (
                        <p className="mt-1 text-[10px] text-amber-700">インフラ基礎課題1をクリアすると利用できます</p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!isKiraTest && !(trainingStatus.infraToolsCleared && trainingStatus.linuxL1Cleared)}
                      onClick={() => {
                        if (isIntroCompleted || isKiraTest) window.open(getTrainingUrl('/training/infra-basic-2-top'), '_blank')
                        else setShowIntroRequiredPopup(true)
                      }}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      開く
                    </button>
                  </li>
                )}
                {(pinnedTraining ?? []).includes('infra-basic-3') && (
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
                        className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-500"
                      >
                        <span aria-hidden style={{ filter: 'grayscale(1) opacity(0.5)' }}>📌</span>
                        ピン解除
                      </button>
                      {!isKiraTest && !trainingStatus.linuxL2Cleared && (
                        <p className="mt-1 text-[10px] text-amber-700">インフラ基礎課題2をクリアすると利用できます</p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!isKiraTest && !trainingStatus.linuxL2Cleared}
                      onClick={() => {
                        if (isIntroCompleted || isKiraTest) window.open(getTrainingUrl('/training/infra-basic-3-top'), '_blank')
                        else setShowIntroRequiredPopup(true)
                      }}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      開く
                    </button>
                  </li>
                )}
              </ul>
            </section>
          )}

          {/* 演習サーバー管理 */}
          {!isAdminView && (
            <section className="mt-6 w-full max-w-2xl">
              {!(serverSnapshot?.ec2PublicIp) ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-sm font-bold text-slate-800">演習サーバー</p>
                  <p className="mt-2 text-sm text-slate-600">まず演習サーバーを作成しましょう</p>
                  <p className="mt-1 text-xs text-slate-500">研修にはLinuxサーバーが必要です。作成は1分で完了します。</p>
                  {isCreatingServer && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-500 mb-1.5">作成中...（約2分）</p>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${serverCreateProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {serverCreateMsg && (
                    <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">
                      {serverCreateMsg}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => { void handleCreateServer() }}
                    disabled={isCreatingServer}
                    className="mt-4 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    サーバーを作成する
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  {/* ヘッダー */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-800">あなたの演習サーバー</p>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${serverSnapshot.ec2State === 'running' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${serverSnapshot.ec2State === 'running' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {serverSnapshot.ec2State === 'running' ? '起動中' : '停止中'}
                    </span>
                  </div>
                  {/* IPアドレス */}
                  <div className="mt-4">
                    <p className="text-xs text-slate-400 mb-1">IPアドレス</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold font-mono text-slate-800 tracking-wide">{serverSnapshot.ec2PublicIp}</span>
                      <button
                        type="button"
                        onClick={() => { void navigator.clipboard.writeText(serverSnapshot.ec2PublicIp ?? '') }}
                        className="rounded-md border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
                        title="コピー"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {/* 接続ユーザー名 */}
                  {serverSnapshot.ec2Username && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-400 mb-1">接続ユーザー名</p>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold font-mono text-slate-700">{serverSnapshot.ec2Username}</span>
                        <button
                          type="button"
                          onClick={() => { void navigator.clipboard.writeText(serverSnapshot.ec2Username ?? '') }}
                          className="rounded-md border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
                          title="コピー"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                  {/* 秘密鍵 */}
                  {serverSnapshot.keyPairName && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-400 mb-1">秘密鍵ファイル</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-slate-600">{serverSnapshot.keyPairName}.pem</span>
                      </div>
                      <p className="mt-1 text-[11px] text-amber-600">※ 秘密鍵は作成時のみダウンロード可能です。紛失した場合はサーバーを削除して再作成してください。</p>
                    </div>
                  )}
                  {/* アクションボタン */}
                  <div className="mt-4">
                    {serverSnapshot.ec2State === 'running' ? (
                      <button
                        type="button"
                        onClick={() => { void handleStopServer() }}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        停止する
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { void handleStartServer() }}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        起動する
                      </button>
                    )}
                  </div>
                  <p className="mt-2.5 text-[10px] text-slate-400">
                    {serverSnapshot.ec2State === 'running'
                      ? '※ 使用後は必ず停止してください'
                      : '※ 起動後、演習を開始してください'}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* 研修カリキュラム */}
          <section className="mt-6 w-full max-w-2xl space-y-3">
            <p className="text-sm font-bold text-slate-800">研修カリキュラム</p>
            {(() => {
              const snap = serverSnapshot
              const introOk = isIntroCompleted
              const canAccessAll = isKiraTestUser()
              const infra1Ok = snap?.infra1Cleared === true && snap?.l1Cleared === true
              const infra2Ok = (snap?.l2CurrentQuestion ?? 0) > 0 && introOk
              const infra3Ok = Object.values(snap?.infra32Answers ?? {}).some((v) => v && String(v).trim())
              const infra4ViDone = (snap?.infra4ViDoneSteps ?? []).length
              const infra4ShellDone = (snap?.infra4ShellDoneQuestions ?? []).length
              const infra4Ok = infra4ViDone >= VI_STEPS.length && infra4ShellDone >= SHELL_QUESTIONS.length
              const infra4Active = infra4ViDone > 0 || infra4ShellDone > 0
              const infra5PhaseDone = (snap?.infra5PhaseDone ?? []).length
              const infra5Ok = infra5PhaseDone >= 5
              const infra5Active = infra5PhaseDone > 0

              type TaskItem = { name: string; sub: string; status: 'done' | 'active' | 'todo'; action: () => void }
              const linuxTasks: TaskItem[] = [
                { name: 'はじめに', sub: '行動基準・セキュリティ基礎', status: introOk ? 'done' : (Number(snap?.introStep ?? 0) >= 1 ? 'active' : 'todo'), action: () => { window.location.hash = '#/training/intro' } },
                { name: 'Linux基本操作・コマンド', sub: 'ツール操作・Linuxコマンド30問', status: infra1Ok ? 'done' : ((snap?.infra1Checkboxes ?? []).some(Boolean) || (snap?.l1CurrentPart ?? 0) > 0 ? 'active' : 'todo'), action: () => { if (introOk || canAccessAll) window.open(getTrainingUrl('/training/infra-basic-top'), '_blank'); else setShowIntroRequiredPopup(true) } },
                { name: 'ネットワーク基礎', sub: 'ネットワーク実践・TCP/IP10問', status: infra2Ok ? 'done' : ((snap?.l2CurrentQuestion ?? 0) > 0 ? 'active' : 'todo'), action: () => { if (introOk || canAccessAll) window.open(getTrainingUrl('/training/infra-basic-2-top'), '_blank'); else setShowIntroRequiredPopup(true) } },
                { name: 'ファイル操作・viエディタ', sub: 'OS/仮想化/クラウド解説・記述チェック', status: infra3Ok ? 'done' : (Object.keys(snap?.infra32Answers ?? {}).length > 0 ? 'active' : 'todo'), action: () => { if (introOk || canAccessAll) window.open(getTrainingUrl('/training/infra-basic-3-top'), '_blank'); else setShowIntroRequiredPopup(true) } },
                { name: 'シェルスクリプト', sub: 'vi演習・シェルスクリプト演習', status: infra4Ok ? 'done' : (infra4Active ? 'active' : 'todo'), action: () => { if (introOk || canAccessAll) window.open(getTrainingUrl('/training/infra-basic-4'), '_blank'); else setShowIntroRequiredPopup(true) } },
                { name: 'サーバー構築（Rocky Linux）', sub: 'OS設定・ディスク・httpd・AIDE・PostgreSQL', status: infra5Ok ? 'done' : (infra5Active ? 'active' : 'todo'), action: () => { if (introOk || canAccessAll) window.open(getTrainingUrl('/training/infra-basic-5'), '_blank'); else setShowIntroRequiredPopup(true) } },
              ]
              const linuxDone = linuxTasks.filter((t) => t.status === 'done').length
              const linuxPct = Math.round((linuxDone / linuxTasks.length) * 100)

              const renderTask = (item: TaskItem) => (
                <li key={item.name} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      item.status === 'done' ? 'bg-emerald-500 text-white' : item.status === 'active' ? 'bg-teal-500 text-white' : 'bg-slate-200 text-slate-400'
                    }`}>
                      {item.status === 'done' ? '✓' : item.status === 'active' ? '▶' : '—'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-slate-800 leading-tight">{item.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">{item.sub}</p>
                    </div>
                  </div>
                  <button type="button" onClick={item.action} className="flex-shrink-0 rounded-lg bg-teal-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-teal-700">
                    開く
                  </button>
                </li>
              )

              type Course = { id: string; icon: string; name: string; isAvailable: boolean; tasks: TaskItem[]; pct: number }
              const courses: Course[] = [
                { id: 'linux', icon: '🐧', name: 'Linuxサーバー基礎', isAvailable: true, tasks: linuxTasks, pct: linuxPct },
                { id: 'aws',   icon: '☁️', name: 'AWSクラウド基礎',   isAvailable: false, tasks: [], pct: 0 },
                { id: 'win',   icon: '🪟', name: 'Windowsサーバー基礎', isAvailable: false, tasks: [], pct: 0 },
              ]

              const activeCourses = courses.filter((c) => c.isAvailable)

              const renderCourseCard = (course: Course) => (
                <div key={course.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  {/* コースヘッダー */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{course.icon}</span>
                      <div>
                        <p className="text-[13px] font-bold text-slate-800">{course.name}</p>
                        <p className="text-[10px] text-slate-400">{course.tasks.filter((t) => t.status === 'done').length} / {course.tasks.length} 完了</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${course.pct}%` }} />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-600 tabular-nums w-8 text-right">{course.pct}%</span>
                    </div>
                  </div>
                  {/* タスク一覧 */}
                  <ul className="divide-y divide-slate-50 px-3 py-2 space-y-1">
                    {course.tasks.map(renderTask)}
                  </ul>
                </div>
              )

              return (
                <>
                  {/* 受講中のコース */}
                  {activeCourses.map(renderCourseCard)}

                  {/* IT業界の歩き方 */}
                  <div className="rounded-2xl border border-teal-100 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-teal-50">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">📚</span>
                        <div>
                          <p className="text-[13px] font-bold text-slate-800">IT業界の歩き方</p>
                        </div>
                      </div>
                    </div>
                    <div className="px-3 py-2">
                      <li className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 gap-2 list-none">
                        <div className="flex items-center gap-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-slate-200 text-slate-400 font-bold">—</span>
                          <p className="text-[13px] font-medium text-slate-800">IT業界の基礎知識</p>
                        </div>
                        <button type="button" onClick={() => { window.location.hash = '#/it-basics' }} className="flex-shrink-0 rounded-lg bg-teal-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-teal-700">開く</button>
                      </li>
                    </div>
                  </div>
                </>
              )
            })()}
          </section>

          </>
          )}
        </main>
      </div>
    </div>
  )
}

type PlaceholderProps = {
  resolution: CommandResolution
  pinnedTraining: PinnableId[]
  trainingStatus: TrainingStatus
  onTogglePin: (id: PinnableId) => void
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
          <div className="mt-2 flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-800">はじめに</h2>
            {pinnedTraining.includes('intro') && (
              <span className="inline-flex items-center justify-center rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                📌
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-600">はじめにのページへアクセスできます。</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onTogglePin('intro')}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:border-amber-500 hover:text-amber-700"
            >
              <span aria-hidden style={{ filter: 'grayscale(1) opacity(0.5)' }}>📌</span>
              {(pinnedTraining ?? []).includes('intro') ? 'ピン解除' : 'ピン留め'}
            </button>
            {onOpenIntro && (
              <button
                type="button"
                onClick={onOpenIntro}
                className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-medium text-white hover:bg-teal-700"
              >
                はじめにを開く
              </button>
            )}
          </div>
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
              className="mt-3 rounded-lg bg-teal-600 px-4 py-2 text-xs font-medium text-white hover:bg-teal-700"
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
                  {(pinnedTraining ?? []).includes('infra-basic-1') && (
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
                  className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-500"
                >
                  <span aria-hidden style={{ filter: 'grayscale(1) opacity(0.5)' }}>📌</span>
                  {(pinnedTraining ?? []).includes('infra-basic-1') ? 'ピン解除' : 'ピン留め'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => onOpenInfraOrShowIntro(getTrainingUrl('/training/infra-basic-top'))}
                className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium bg-teal-600 text-white hover:bg-teal-700"
              >
                開く
              </button>
            </li>
            <li className="flex flex-col gap-1 rounded-xl bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">インフラ基礎課題2</span>
                  {(pinnedTraining ?? []).includes('infra-basic-2') && (
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
                className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-500"
              >
                <span aria-hidden style={{ filter: 'grayscale(1) opacity(0.5)' }}>📌</span>
                {(pinnedTraining ?? []).includes('infra-basic-2') ? 'ピン解除' : 'ピン留め'}
              </button>
              {!isKiraTestUser() && !infra1Cleared && (
                <p className="mt-1 text-[10px] text-amber-700">インフラ基礎課題1をクリアすると利用できます</p>
              )}
              </div>
              <button
                type="button"
                disabled={!isKiraTestUser() && !infra1Cleared}
                onClick={() => onOpenInfraOrShowIntro(getTrainingUrl('/training/infra-basic-2-top'))}
                className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                開く
              </button>
            </li>
            <li className="flex flex-col gap-1 rounded-xl bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">インフラ基礎課題3</span>
                  {(pinnedTraining ?? []).includes('infra-basic-3') && (
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
                  className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-500"
                >
                  <span aria-hidden style={{ filter: 'grayscale(1) opacity(0.5)' }}>📌</span>
                  {(pinnedTraining ?? []).includes('infra-basic-3') ? 'ピン解除' : 'ピン留め'}
                </button>
                {!isKiraTestUser() && !infra2Cleared && (
                  <p className="mt-1 text-[10px] text-amber-700">インフラ基礎課題2をクリアすると利用できます</p>
                )}
              </div>
              <button
                type="button"
                disabled={!isKiraTestUser() && !infra2Cleared}
                onClick={() => onOpenInfraOrShowIntro(getTrainingUrl('/training/infra-basic-3-top'))}
                className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                開く
              </button>
            </li>
            <li className="flex flex-col gap-1 rounded-xl bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">インフラ基礎課題4（vi & シェルスクリプト演習）</span>
                  {(pinnedTraining ?? []).includes('infra-basic-4') && (
                    <span className="inline-flex items-center justify-center rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      📌
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onTogglePin('infra-basic-4')}
                  className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-500"
                >
                  <span aria-hidden style={{ filter: 'grayscale(1) opacity(0.5)' }}>📌</span>
                  {(pinnedTraining ?? []).includes('infra-basic-4') ? 'ピン解除' : 'ピン留め'}
                </button>
                {!isKiraTestUser() && !infra3Cleared && (
                  <p className="mt-1 text-[10px] text-amber-700">インフラ基礎課題3をクリアすると利用できます</p>
                )}
              </div>
              <button
                type="button"
                disabled={!isKiraTestUser() && !infra3Cleared}
                onClick={() => onOpenInfraOrShowIntro(getTrainingUrl('/training/infra-basic-4'))}
                className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                開く
              </button>
            </li>
          </ul>
          <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-slate-800">IT業界の歩き方</span>
                <p className="text-[11px] text-slate-500">ITエンジニアの基礎知識を6カテゴリで学ぶ</p>
              </div>
              <button
                type="button"
                onClick={() => { window.location.hash = '#/it-basics' }}
                className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium bg-teal-600 text-white hover:bg-teal-700"
              >
                開く
              </button>
            </div>
          </div>
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
