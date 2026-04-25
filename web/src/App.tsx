/**
 * メインテーマ: 白ベース (Light)
 * 全ページを白/ライトで統一する。
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSafeNavigate } from './hooks/useSafeNavigate'
// import { OpenInNewTabButton } from './components/OpenInNewTabButton'
import { NeOSLogo } from './components/NeOSLogo'
import { SharedHeader } from './components/SharedHeader'
import { L1_CLEARED_KEY } from './training/linuxLevel1Data'
import { L2_CLEARED_KEY } from './training/linuxLevel2Data'
import { INFRA_BASIC_1_CLEARED_KEY, INFRA_BASIC_1_PARAMS } from './training/infraBasic1Data'
import { INFRA_BASIC_3_2_CLEARED_KEY } from './training/infraBasic3Data'
import {
  getProgressKey,
  isTask1Cleared,
} from './training/trainingWbsData'
import { isJTerada, J_TERADA_ALLOWED_LINKS } from './specialUsers'
import { clearIntroForCurrentUser } from './training/introGate'
import { LOGIN_FLAG_KEY, getCurrentDisplayName, getCurrentRole, USER_ROLE_KEY } from './auth'
import { restoreProgressToLocalStorage, type TraineeProgressSnapshot } from './traineeProgressStorage'
import { isProgressApiAvailable, postProgress, fetchMyProgress, fetchProgressFromApi, fetchMeInfo, buildAuthHeaders, BASE_URL } from './progressApi'
import { TermsModal } from './components/TermsModal'
import { fetchAdminUsers, createAdminUser, deleteAdminUser, type AdminUser } from './accountsApi'
import { safeGetItem, safeRemoveItem, clearCookieValue } from './utils/storage'
import { HomeDashboard } from './components/HomeDashboard'

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


const USER_DISPLAY_NAME_KEY = 'kira-user-display-name'
function getDisplayName(): string {
  return getCurrentDisplayName()
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

function handleLogout() {
  if (typeof window === 'undefined') return
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
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
        <NeOSLogo height={32} />
        <div className="flex items-center gap-2">
          <span className="text-body md:text-body-pc text-slate-600">j-terada さん</span>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg px-3 py-1.5 text-button md:text-button-pc text-slate-600 hover:bg-slate-100"
          >
            ログアウト
          </button>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 py-8">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-display md:text-display-pc font-semibold text-slate-800 tracking-tight">コマンド問題が終わりました</h1>
          <p className="mt-2 text-body md:text-body-pc text-slate-600">
            以下を行ってください。
          </p>
          <ul className="mt-6 space-y-3">
            {J_TERADA_ALLOWED_LINKS.map(({ label, url }) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl bg-sky-50 px-4 py-3 text-button md:text-button-pc font-medium text-sky-700 hover:bg-sky-100"
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
  const [_trainingStatus, setTrainingStatus] = useState<TrainingStatus>(() => readTrainingStatus())
  /** 初期値 null = 未ロード。サーバー取得完了まで PUT をブロックするため。 */
  const [pinnedTraining, setPinnedTraining] = useState<PinnableId[] | null>(null)
  const [serverSnapshot, setServerSnapshot] = useState<TraineeProgressSnapshot | null>(null)
  const [isSnapLoaded, setIsSnapLoaded] = useState(false)
  /** サーバー初回 GET が完了し pinnedTraining に反映されるまで true にしない。それまでは保存処理をブロック。 */
  const isDataReady = useRef(false)
  const [showIntroRequiredPopup, setShowIntroRequiredPopup] = useState(false)
  const [accounts, setAccounts] = useState<AdminUser[]>([])
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountPassword, setNewAccountPassword] = useState('')
  const [accountMessage, setAccountMessage] = useState<string | null>(null)
  const [showAccountPanel, setShowAccountPanel] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [ec2Snapshots, setEc2Snapshots] = useState<Record<string, import('./progressApi').TraineeProgressFromApi>>({})
  const [ec2EditHost, setEc2EditHost] = useState<Record<string, string>>({})
  const [ec2EditUsername, setEc2EditUsername] = useState<Record<string, string>>({})
  const [ec2EditPassword, setEc2EditPassword] = useState<Record<string, string>>({})
  const [showEc2Panel, setShowEc2Panel] = useState(false)
  const [ec2SaveMsg, setEc2SaveMsg] = useState<string | null>(null)
  const [isCreatingServer, setIsCreatingServer] = useState(false)
  const [serverCreateProgress, setServerCreateProgress] = useState(0)
  const [serverCreatedModal, setServerCreatedModal] = useState<{ publicIp: string; keyPairName: string; pemFilename: string; ec2Username: string } | null>(null)
  const [showStopConfirm, setShowStopConfirm] = useState(false)
  const [isServerActionLoading, setIsServerActionLoading] = useState(false)
  const [ec2StatusError, setEc2StatusError] = useState(false)
  const [pemLostOpen, setPemLostOpen] = useState(false)
  const [copiedField, setCopiedField] = useState<'ip' | 'user' | null>(null)
  /** null=未ロード, ''=未同意, string=同意済み(ISO日付) */
  const [termsAgreedAt, setTermsAgreedAt] = useState<string | null>(null)
  const ec2PollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /** 音声認識中の確定テキストを蓄積（リアルタイム表示用） */
  /** ユーザーがマイクを押して停止した場合 true。onend で再開しない判定に使用 */
  /** 音声認識で表示中の最新テキスト（再開時のベース用） */
  /** 矢印キーで履歴を選択した場合のみ true。Enter で履歴項目を送信する判定に使用 */

  /** はじめに完了判定（serverSnapshotから派生したstate） */
  const [isIntroCompleted, setIsIntroCompleted] = useState(false)
  useEffect(() => {
    if (!serverSnapshot) return
    const completed =
      Number(serverSnapshot.introStep ?? 0) >= 5 &&
      serverSnapshot.introConfirmed === true
    setIsIntroCompleted(completed)
  }, [serverSnapshot])

  /** EC2実ステータス取得（AWS実態）*/
  const doFetchEc2Status = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/server/status`, {
        method: 'GET',
        headers: buildAuthHeaders(),
        credentials: 'omit',
      })
      if (!res.ok) { setEc2StatusError(true); return }
      const data = (await res.json()) as { ok: boolean; status?: string; publicIp?: string | null; instanceId?: string | null }
      if (!data.status) return
      setEc2StatusError(false)
      setServerSnapshot((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          ec2State: data.status as NonNullable<typeof prev.ec2State>,
          ec2PublicIp: data.publicIp ?? prev.ec2PublicIp,
          ec2Host: data.publicIp ?? prev.ec2Host,
          // バックエンドがIPからインスタンスIDを自動解決した場合はフロントにも反映する
          ...(data.instanceId ? { ec2InstanceId: data.instanceId } : {}),
        }
      })
    } catch { setEc2StatusError(true) }
  }, []) // buildAuthHeaders/BASE_URL はモジュールスコープで安定

  /** pending/stopping 中は 3 秒ポーリング */
  useEffect(() => {
    const state = serverSnapshot?.ec2State
    const instanceId = serverSnapshot?.ec2InstanceId
    if (!isSnapLoaded || !instanceId) return
    const isTransient = state === 'pending' || state === 'stopping'
    if (isTransient) {
      if (!ec2PollingRef.current) {
        ec2PollingRef.current = setInterval(() => { void doFetchEc2Status() }, 3000)
      }
    } else {
      if (ec2PollingRef.current) { clearInterval(ec2PollingRef.current); ec2PollingRef.current = null }
    }
    return () => {
      if (ec2PollingRef.current) { clearInterval(ec2PollingRef.current); ec2PollingRef.current = null }
    }
  }, [serverSnapshot?.ec2State, serverSnapshot?.ec2InstanceId, isSnapLoaded, doFetchEc2Status])

  /** 初回ロード時のみ実際の EC2 状態を取得
   * ec2InstanceId が NULL でも ec2PublicIp があれば呼ぶ（バックエンドがIPからIDを自動解決する） */
  const ec2StatusFetchedRef = useRef(false)
  useEffect(() => {
    if (!isSnapLoaded) return
    if (!serverSnapshot?.ec2InstanceId && !serverSnapshot?.ec2PublicIp) return
    if (ec2StatusFetchedRef.current) return
    ec2StatusFetchedRef.current = true
    void doFetchEc2Status()
  }, [isSnapLoaded, serverSnapshot?.ec2InstanceId, serverSnapshot?.ec2PublicIp, doFetchEc2Status])

  function goToIntroAndClosePopup() {
    setShowIntroRequiredPopup(false)
    navigate('/training/intro')
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

  const isAdminView = getCurrentRole() === 'manager'
  /** 初回のみ: サーバーから進捗を取得し pinnedTraining をセット。必要なら localStorage を 1 回だけサーバーにマージ。完了後に isDataReady を true にする。 */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const name = getDisplayName().trim().toLowerCase()
    if (isAdminView || !name) {
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


  // 利用規約同意状態を取得（研修生のみ）
  useEffect(() => {
    if (isAdminView || !isProgressApiAvailable()) return
    fetchMeInfo().then((info) => {
      if (info) setTermsAgreedAt(info.termsAgreedAt ?? '')
    })
  }, [isAdminView])

  // admin 用: アカウント一覧を定期取得し、既存の進捗から自動的に取り込む
  useEffect(() => {
    if (!isAdminView || !isProgressApiAvailable()) return
    let cancelled = false
    const load = async () => {
      if (!isProgressApiAvailable()) return
      const current = await fetchAdminUsers()
      if (!cancelled) {
        setAccounts(current)
      }
      // 既存の進捗 + j-terada から不足分を自動登録
      const trainees = await fetchProgressFromApi()
      const snaps: Record<string, import('./progressApi').TraineeProgressFromApi> = {}
      for (const t of trainees) {
        if (t.traineeId) snaps[t.traineeId] = t
      }
      if (!cancelled) setEc2Snapshots(snaps)
      const baseIds = trainees
        .map((t) => (t.traineeId || '').trim().toLowerCase())
        .filter((id) => !!id)
      const extraIds = ['j-terada']
      const allIds = Array.from(new Set([...baseIds, ...extraIds]))
      const existing = new Set(current.map((a) => a.username))
      const missing = allIds.filter((id) => !existing.has(id))
      for (const id of missing) {
        // 初期パスワードはユーザー名と同じ（8文字未満の場合は0埋め）
        const autoPass = id.length >= 8 ? id : id + '0'.repeat(8 - id.length)
        // eslint-disable-next-line no-await-in-loop
        await createAdminUser(id, autoPass, 'student')
      }
      if (missing.length > 0 && !cancelled) {
        const refreshed = await fetchAdminUsers()
        setAccounts(refreshed)
      }
    }
    void load()
    const id = window.setInterval(() => {
      void load()
    }, 10000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [isAdminView])

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    setAccountMessage(null)
    const name = newAccountName.trim().toLowerCase()
    if (!name) {
      setAccountMessage('有効なユーザー名を入力してください。')
      return
    }
    if (!newAccountPassword) {
      setAccountMessage('パスワードを入力してください。')
      return
    }
    if (!isProgressApiAvailable()) {
      setAccountMessage('アカウントAPIが未設定です。VITE_PROGRESS_API_URL を確認してください。')
      return
    }
    const result = await createAdminUser(name, newAccountPassword, 'student')
    if (!result.ok) {
      setAccountMessage(result.error ?? 'アカウント作成に失敗しました。ネットワークやAPI設定を確認してください。')
      return
    }
    setNewAccountName('')
    setNewAccountPassword('')
    setAccountMessage('アカウントを作成しました。')
    const list = await fetchAdminUsers()
    setAccounts(list)
  }

  async function handleImportFromProgress() {
    setAccountMessage(null)
    if (!isProgressApiAvailable()) {
      setAccountMessage('API が未設定のため取り込みできません。VITE_PROGRESS_API_URL を確認してください。')
      return
    }
    const trainees = await fetchProgressFromApi()
    const baseIds = trainees
      .map((t) => (t.traineeId || '').trim().toLowerCase())
      .filter((id) => !!id)
    const extraIds = ['j-terada']
    const ids = Array.from(new Set([...baseIds, ...extraIds]))
    if (ids.length === 0) {
      setAccountMessage('取り込める既存ユーザーが見つかりませんでした。')
      return
    }
    for (const id of ids) {
      // 初期パスワードはユーザー名と同じ（8文字未満の場合は0埋め）。既存ユーザーはスキップ。
      const autoPass = id.length >= 8 ? id : id + '0'.repeat(8 - id.length)
      // eslint-disable-next-line no-await-in-loop
      await createAdminUser(id, autoPass, 'student')
    }
    const list = await fetchAdminUsers()
    setAccounts(list)
    setAccountMessage(`既存の進捗から ${ids.length} 件のユーザーを取り込みました。（初期パスワードはユーザー名と同じです）`)
  }

  async function handleConfirmDelete() {
    setDeleteError(null)
    if (!deleteTarget) return
    const result = await deleteAdminUser(deleteTarget)
    if (!result.ok) {
      setDeleteError(result.error ?? '削除に失敗しました。時間をおいて再度お試しください。')
      return
    }
    setDeleteTarget(null)
    const list = await fetchAdminUsers()
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
    if (!name) return

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

  const navigate = useSafeNavigate()

  /** 演習サーバー作成（実EC2） */
  const handleCreateServer = async () => {
    if (isCreatingServer) return
    const username = getDisplayName().trim().toLowerCase()
    if (!username) return
    setIsCreatingServer(true)
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
        ec2Username: data.ec2Username ?? 'rocky',
        ec2CreatedAt: data.ec2CreatedAt ?? null,
        ec2StartTime: data.ec2StartTime ?? null,
        ec2Host: data.publicIp ?? null,
        updatedAt: new Date().toISOString(),
      }
      setServerSnapshot(updated)

      // 成功モーダルを表示
      setServerCreatedModal({ publicIp: data.publicIp ?? '', keyPairName, pemFilename, ec2Username: data.ec2Username ?? username })
    } catch {
      window.clearInterval(progressInterval)
      setServerCreateProgress(0)
    } finally {
      setIsCreatingServer(false)
    }
  }

  /** 演習サーバー停止（実EC2） */
  const handleStopServer = async () => {
    if (isServerActionLoading || !serverSnapshot) return
    setShowStopConfirm(false)
    setIsServerActionLoading(true)
    const prevSnapshot = serverSnapshot
    // 楽観的更新: stopping 状態へ（ポーリングが実態を追跡）
    setServerSnapshot({ ...serverSnapshot, ec2State: 'stopping', updatedAt: new Date().toISOString() })
    try {
      const res = await fetch(`${BASE_URL}/server/stop`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'omit',
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        setServerSnapshot(prevSnapshot)
      }
      // 成功時は ec2State: 'stopping' のまま → useEffect がポーリングを開始する
    } catch {
      setServerSnapshot(prevSnapshot)
    } finally {
      setIsServerActionLoading(false)
    }
  }

  /** 演習サーバー起動（実EC2） */
  const handleStartServer = async () => {
    if (isServerActionLoading || !serverSnapshot) return
    setIsServerActionLoading(true)
    const prevSnapshot = serverSnapshot
    // 楽観的更新: pending 状態へ（ポーリングが実態を追跡）
    setServerSnapshot({ ...serverSnapshot, ec2State: 'pending', updatedAt: new Date().toISOString() })
    try {
      const res = await fetch(`${BASE_URL}/server/start`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'omit',
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        setServerSnapshot(prevSnapshot)
      }
      // 成功時は ec2State: 'pending' のまま → useEffect がポーリングを開始する
    } catch {
      setServerSnapshot(prevSnapshot)
    } finally {
      setIsServerActionLoading(false)
    }
  }

  // DynamoDB取得完了まで null を返す（チラつき防止）。取得後はサブタスクのクリア数から計算。
  const progressPct = pinnedTraining === null || !serverSnapshot
    ? null
    : (() => {
        const s = serverSnapshot
        const ch = Array.isArray(s.chapterProgress) ? s.chapterProgress : []
        const subCleared = [
          Number(s.introStep ?? 0) >= 5 && s.introConfirmed ? 1 : 0,     // はじめに
          Object.values((s.itBasicsProgress ?? {}) as Record<string, { cleared: boolean }>).filter(v => v.cleared).length >= 7 ? 1 : 0,  // IT業界の歩き方
          s.l1Cleared ? 1 : 0,                                       // 1-2
          ch[1]?.cleared ? 1 : 0,                                    // 2-x
          ch[2]?.cleared ? 1 : 0,                                    // 3-x
          ch[3]?.cleared ? 1 : 0,                                    // 4-x
        ].reduce((a, b) => a + b, 0)
        return { pct: Math.round(subCleared / 8 * 100), completed: subCleared, total: 8 }
      })()
  // j-terada ユーザーかつ課題1クリア済みの場合は限定ビューを表示（全 hooks 呼び出し後に判定 — Rules of Hooks）
  if (isJTerada(getDisplayName()) && isTask1Cleared()) {
    return <JTeradaRestrictedView />
  }

  if (!isSnapLoaded && !isAdminView) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500" />
      </div>
    )
  }
  return (
    <div className="min-h-screen text-slate-800">
      {/* 利用規約同意モーダル（研修生・未同意の場合） */}
      {!isAdminView && termsAgreedAt === '' && (
        <TermsModal onAgreed={(t) => setTermsAgreedAt(t)} />
      )}
      {/* サーバー作成成功モーダル */}
      {/* 停止確認ダイアログ */}
      {showStopConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-heading md:text-heading-pc font-bold text-slate-800 mb-2 tracking-tight">サーバーを停止しますか？</h2>
            <p className="text-body md:text-body-pc text-slate-600 mb-5">停止中はSSH接続できません。作業中のデータは保持されます。</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowStopConfirm(false)} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-button md:text-button-pc font-medium text-slate-700 hover:bg-slate-50">キャンセル</button>
              <button type="button" onClick={() => { void handleStopServer() }} className="flex-1 rounded-xl bg-red-600 py-2.5 text-button md:text-button-pc font-semibold text-white hover:bg-red-700">停止する</button>
            </div>
          </div>
        </div>
      )}
      {serverCreatedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-display md:text-display-pc">✓</span>
              <h2 className="text-display md:text-display-pc font-bold text-slate-800 tracking-tight">サーバーを作成しました</h2>
            </div>
            <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-body md:text-body-pc">
              <div>
                <p className="text-label md:text-label-pc text-slate-400 mb-0.5">IPアドレス</p>
                <p className="font-bold font-mono text-slate-800 text-display md:text-display-pc">{serverCreatedModal.publicIp || '取得中...'}</p>
              </div>
              <div>
                <p className="text-label md:text-label-pc text-slate-400 mb-0.5">接続ユーザー名</p>
                <p className="font-semibold font-mono text-slate-700">{serverCreatedModal.ec2Username}</p>
              </div>
              <div>
                <p className="text-label md:text-label-pc text-slate-400 mb-0.5">秘密鍵ファイル（ダウンロード済み）</p>
                <p className="font-mono text-slate-600 text-label md:text-label-pc break-all">{serverCreatedModal.pemFilename}</p>
              </div>
            </div>
            <p className="mt-4 text-label md:text-label-pc text-slate-600">この情報はトップページの「あなたの演習サーバー」セクションでいつでも確認できます。</p>
            <p className="mt-1.5 text-label md:text-label-pc font-medium text-amber-600">⚠ この秘密鍵は今回のみダウンロード可能です。大切に保管してください。</p>
            <button
              type="button"
              onClick={() => setServerCreatedModal(null)}
              className="mt-5 w-full rounded-xl py-3 text-button md:text-button-pc font-semibold bg-sky-600 text-white hover:bg-sky-700"
            >
              研修を始める
            </button>
          </div>
        </div>
      )}
      <div className="mx-auto flex min-h-screen flex-col">
        <SharedHeader
          progressPct={progressPct?.pct ?? null}
          completedCount={progressPct?.completed}
          totalCount={progressPct?.total}
          onLogout={handleLogout}
          isAdmin={isAdminView}
          onAdminMenu={() => navigate('/admin')}
          onAccountPanel={() => setShowAccountPanel(true)}
        />

        {/* はじめに未完了時ポップアップ */}
        {showIntroRequiredPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="intro-required-title">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
              <h2 id="intro-required-title" className="text-display md:text-display-pc font-semibold text-slate-800 tracking-tight">はじめに</h2>
              <p className="mt-3 text-body md:text-body-pc text-slate-600">
                インフラ基礎課題にアクセスするには、先に「はじめに」でプロフェッショナルとしての行動基準を確認してください。
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={goToIntroAndClosePopup}
                  className="flex-1 rounded-lg px-4 py-2.5 text-button md:text-button-pc font-medium bg-sky-600 text-white hover:bg-sky-700"
                >
                  はじめに
                </button>
                <button
                  type="button"
                  onClick={() => setShowIntroRequiredPopup(false)}
                  className="rounded-lg bg-slate-100 px-4 py-2.5 text-button md:text-button-pc font-medium text-slate-700 hover:bg-slate-200"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}

        {isAdminView ? (
        <main className="mt-4 flex flex-1 flex-col items-center justify-start mx-auto max-w-5xl px-6 w-full">
          <div className="w-full max-w-2xl space-y-4">
              <h1 className="text-display md:text-display-pc font-semibold text-slate-800 tracking-tight">講師用メニュー</h1>
              <section className="space-y-2">
                <p className="text-body md:text-body-pc text-slate-600">受講生の進捗を確認できます。</p>
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className="flex w-full flex-col items-start rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-sky-200 hover:bg-sky-50/50"
                >
                  <span className="text-heading md:text-heading-pc font-semibold text-slate-800">受講生の進捗</span>
                  <span className="mt-1 text-label md:text-label-pc text-slate-600">WBSに基づく進捗一覧を表示</span>
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
                      <h2 id="account-manage-title" className="text-heading md:text-heading-pc font-semibold text-slate-800 tracking-tight">
                        アカウント管理
                      </h2>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAccountPanel(false)
                          setAccountMessage(null)
                          setDeleteTarget(null)
                          setDeleteError(null)
                        }}
                        className="rounded-full bg-slate-100 px-2 py-1 text-label md:text-label-pc text-slate-600 hover:bg-slate-200"
                      >
                        閉じる
                      </button>
                    </div>
                    <p className="mt-1 text-label md:text-label-pc text-slate-600">
                      管理者が作成したアカウントのみ、受講生画面からログインできます。
                    </p>

                    <form onSubmit={handleCreateAccount} className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                        placeholder="新しいユーザー名（例: kira-test）"
                        className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-label md:text-label-pc text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                      <input
                        type="password"
                        value={newAccountPassword}
                        onChange={(e) => setNewAccountPassword(e.target.value)}
                        placeholder="パスワード"
                        className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-label md:text-label-pc text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                      <button
                        type="submit"
                        disabled={!newAccountName.trim() || !newAccountPassword}
                        className="rounded-lg bg-sky-50 text-sky-700 border border-sky-200 px-3 py-1.5 text-label md:text-label-pc font-medium hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
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
                        <p className="mt-1 text-[11px] text-slate-600">まだアカウントがありません。</p>
                      ) : (
                        <ul className="mt-2 space-y-1 max-h-40 overflow-auto text-[11px] text-slate-700">
                          {accounts.map((a) => (
                            <li key={a.username} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
                              <span className="font-medium">{a.username}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteTarget(a.username)
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
                        <p className="text-label md:text-label-pc font-semibold text-rose-800">ファイナルアンサー？</p>
                        <p className="mt-1 text-[11px] text-rose-700">
                          ユーザー「{deleteTarget}」を削除します。この操作は取り消せません。
                        </p>
                        {deleteError && <p className="mt-1 text-[11px] text-rose-700">{deleteError}</p>}
                        <div className="mt-2 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteTarget(null)
                              setDeleteError(null)
                            }}
                            className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                          >
                            やめる
                          </button>
                          <button
                            type="button"
                            onClick={() => { void handleConfirmDelete() }}
                            className="rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-rose-700"
                          >
                            削除する
                          </button>
                        </div>
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
                                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
                                  />
                                  <input
                                    type="text"
                                    placeholder={`ユーザー名（例: ${INFRA_BASIC_1_PARAMS.userKensyu}）`}
                                    value={ec2EditUsername[a.username] ?? snap?.ec2Username ?? ''}
                                    onChange={(e) => setEc2EditUsername((prev) => ({ ...prev, [a.username]: e.target.value }))}
                                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
                                  />
                                  <input
                                    type="text"
                                    placeholder={`パスワード（例: ${INFRA_BASIC_1_PARAMS.password}）`}
                                    value={ec2EditPassword[a.username] ?? snap?.ec2Password ?? ''}
                                    onChange={(e) => setEc2EditPassword((prev) => ({ ...prev, [a.username]: e.target.value }))}
                                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => void saveEc2ForUser(a.username)}
                                    className="mt-1 rounded bg-sky-50 text-sky-700 border border-sky-200 px-2 py-1 text-[10px] font-medium hover:bg-sky-100"
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
        </main>
        ) : (
        <HomeDashboard
          serverSnapshot={serverSnapshot}
          isSnapLoaded={isSnapLoaded}
          progressPct={progressPct}
          isIntroCompleted={isIntroCompleted}
          isServerActionLoading={isServerActionLoading}
          ec2StatusError={ec2StatusError}
          pemLostOpen={pemLostOpen}
          setPemLostOpen={setPemLostOpen}
          copiedField={copiedField}
          setCopiedField={setCopiedField}
          setShowStopConfirm={setShowStopConfirm}
          handleStartServer={handleStartServer}
          doFetchEc2Status={doFetchEc2Status}
          setEc2StatusError={setEc2StatusError}
          handleCreateServer={handleCreateServer}
          isCreatingServer={isCreatingServer}
          serverCreateProgress={serverCreateProgress}
          setShowIntroRequiredPopup={setShowIntroRequiredPopup}
        />
        )}

      </div>
    </div>
  )
}

export default App
