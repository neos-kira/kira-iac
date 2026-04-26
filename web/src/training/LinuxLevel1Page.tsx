import { useEffect, useState, useRef } from 'react'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
import { getProgressKey } from './trainingWbsData'
import { useQuizContext } from '../quizContext'
import { LINUX_LEVEL1_QUESTIONS, L1_CLEARED_KEY, L1_PROGRESS_KEY } from './linuxLevel1Data'
import type { QuizQuestion } from './linuxLevel1Data'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'
import { postProgress, isProgressApiAvailable } from '../progressApi'
import { getCurrentDisplayName } from '../auth'
import { fetchMyProgress } from '../progressApi'
import { Toast } from '../components/Toast'

const PART_SIZE = 10
const PASS_SCORE = 8
const PART_LABELS = ['第1部', '第2部', '第3部']
const PART_NAMES = ['基本操作', 'サーバ構築必須', '実践問題']

type L1Save = {
  partsCleared: boolean[]
  currentPart?: number
  currentQuestion?: number  // firstAttemptCount（初回回答済み問数。表示用）
  wrongIds?: string[]
  savedQueueIdx?: number    // 中断時点の queueIdx（復元用。currentQuestion と異なる場合あり）
}

function loadL1Save(key: string): {
  partsCleared: boolean[]
  currentPart: number
  currentQuestion: number
  wrongIds: string[]
  savedQueueIdx: number | undefined
} {
  const defaultVal = {
    partsCleared: [false, false, false],
    currentPart: 0,
    currentQuestion: 0,
    wrongIds: [] as string[],
    savedQueueIdx: undefined as number | undefined,
  }
  if (typeof window === 'undefined') return defaultVal
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return defaultVal
    const parsed = JSON.parse(raw) as Partial<L1Save>
    const partsCleared =
      Array.isArray(parsed.partsCleared) && parsed.partsCleared.length === 3
        ? (parsed.partsCleared as boolean[])
        : [false, false, false]
    const firstUncleared = partsCleared.findIndex((c) => !c)
    const defaultPart = firstUncleared === -1 ? 0 : firstUncleared
    return {
      partsCleared,
      currentPart: typeof parsed.currentPart === 'number' ? parsed.currentPart : defaultPart,
      currentQuestion: typeof parsed.currentQuestion === 'number' ? parsed.currentQuestion : 0,
      wrongIds: Array.isArray(parsed.wrongIds) ? (parsed.wrongIds as string[]) : [],
      savedQueueIdx: typeof parsed.savedQueueIdx === 'number' ? parsed.savedQueueIdx : undefined,
    }
  } catch {
    return defaultVal
  }
}

function saveL1State(
  key: string,
  partsCleared: boolean[],
  currentPart: number,
  currentQuestion: number,
  wrongIds: string[],
  savedQueueIdx?: number,
) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify({ partsCleared, currentPart, currentQuestion, wrongIds, savedQueueIdx }))
  } catch {
    // ignore
  }
}

/**
 * 保存データから quiz の初期状態（queue / queueIdx / firstAttemptCorrect）を復元する。
 * - wrongIds を末尾に追加した queue を再構築する
 * - savedQueueIdx（なければ currentQuestion）を queueIdx として使う
 * - queueIdx が queue 範囲外なら 0 にリセット（例: 部クリア後の次部への移行時）
 */
function buildRestoredL1State(save: ReturnType<typeof loadL1Save>, partIdx: number) {
  const basePartQs = getPartQuestions(partIdx)
  const wrongSet = new Set(save.wrongIds)

  // 初回回答済み問の正誤を復元
  const firstAttemptCorrect: Record<string, boolean> = {}
  for (let i = 0; i < save.currentQuestion && i < PART_SIZE; i++) {
    const q = basePartQs[i]
    if (q) firstAttemptCorrect[q.id] = !wrongSet.has(q.id)
  }

  // 不正解問を末尾に追加した queue を再構築
  const queue: QuizQuestion[] = [
    ...basePartQs,
    ...save.wrongIds
      .map((id) => basePartQs.find((q) => q.id === id))
      .filter((q): q is QuizQuestion => q !== undefined),
  ]

  // 初回正解問の入力欄を復元（choices[correctIndex] を詰める）
  const answeredCommands: Record<number, string> = {}
  for (let i = 0; i < save.currentQuestion && i < PART_SIZE; i++) {
    const q = basePartQs[i]
    if (q && !wrongSet.has(q.id)) {
      answeredCommands[i] = q.choices[q.correctIndex] ?? ''
    }
  }

  // savedQueueIdx がなければ currentQuestion をフォールバックとして使う
  const rawQueueIdx = save.savedQueueIdx ?? save.currentQuestion
  // queue 範囲内かチェック（部クリア後など範囲外になる場合は 0 にリセット）
  // Note: >= 0 にすることで第1問（index 0）でも正しく復元できる
  const validPosition = rawQueueIdx >= 0 && rawQueueIdx < queue.length
  return {
    queue,
    queueIdx: validPosition ? rawQueueIdx : 0,
    // 有効な途中位置のときだけ firstAttemptCorrect を復元（新規開始時はリセット）
    firstAttemptCorrect: validPosition ? firstAttemptCorrect : {},
    answeredCommands: validPosition ? answeredCommands : {},
  }
}

function getPartQuestions(partIdx: number): QuizQuestion[] {
  return LINUX_LEVEL1_QUESTIONS.slice(partIdx * PART_SIZE, (partIdx + 1) * PART_SIZE)
}


export function LinuxLevel1Page() {
  const navigate = useSafeNavigate()
  const { setQuizState } = useQuizContext()
  const storageKey = getProgressKey(L1_PROGRESS_KEY)
  const clearedKey = getProgressKey(L1_CLEARED_KEY)

  const initSave = loadL1Save(storageKey)
  const initPart = initSave.currentPart
  // 中断前の状態（queue / queueIdx / firstAttemptCorrect）を保存データから復元
  const initRestored = buildRestoredL1State(initSave, initPart)

  // DynamoDB復元済みかどうかのフラグ（useEffect完了前に中断されないよう管理）

  // DynamoDBから取得した最新値（postProgressのベース）
  const [serverSnapshot, setServerSnapshot] = useState<TraineeProgressSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [partsCleared, setPartsCleared] = useState<boolean[]>(initSave.partsCleared)
  const [activePart, setActivePart] = useState<number>(initPart)
  // 中断前の queue（不正解問を末尾追加済み）・queueIdx・firstAttemptCorrect を復元
  const [queue, setQueue] = useState<QuizQuestion[]>(initRestored.queue)
  const [queueIdx, setQueueIdx] = useState(initRestored.queueIdx)
  // firstAttemptCorrect: questionId → true/false (初回回答結果)
  const [firstAttemptCorrect, setFirstAttemptCorrect] = useState<Record<string, boolean>>(initRestored.firstAttemptCorrect)
  const [inputValue, setInputValue] = useState('')
  const [lastResult, setLastResult] = useState<'correct' | null>(null)
  const [wrongFeedback, setWrongFeedback] = useState(false)
  const [answeredCommands, setAnsweredCommands] = useState<Record<number, string>>(initRestored.answeredCommands)
  const [phase, setPhase] = useState<'quiz' | 'part_result' | 'all_clear'>('quiz')
  const [partScore, setPartScore] = useState(0)
  const [isExecuting, setIsExecuting] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null)
  const allClearSavedRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const mobileCurrentRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    document.title = 'Linuxコマンド30問'
  }, [])

  useEffect(() => {
    const handler = () => { void handleInterrupt() }
    window.addEventListener('nic:save-and-leave', handler)
    return () => window.removeEventListener('nic:save-and-leave', handler)
  })

  // AI講師にクイズ状態を共有する（currentQuestion / studentAnswer / isCorrect）
  const current = queue[queueIdx]
  useEffect(() => {
    setQuizState({
      currentQuestion: current?.prompt ?? null,
      studentAnswer: inputValue,
      isCorrect: lastResult === 'correct' ? true : wrongFeedback ? false : null,
    })
  }, [current?.prompt, inputValue, lastResult, wrongFeedback, setQuizState])

  // DynamoDBから初期状態を復元（優先順位: DynamoDB > localStorage > デフォルト）
  useEffect(() => {
    const restore = async () => {
      const username = getCurrentDisplayName().trim().toLowerCase()
      if (!username || false) {
        setIsLoading(false)
        return
      }
      const snap = await fetchMyProgress(username)
      // DynamoDB最新値を保持（postProgressのベースとして使う）
      if (snap) setServerSnapshot(snap)
      if (!snap || typeof snap.l1CurrentPart !== 'number') {
        setIsLoading(false)
        return
      }

      const serverPart = snap.l1CurrentPart
      // DynamoDBが唯一の信頼できるデータソース（CLAUDE.md原則）。常にDynamoDBから復元する
      const serverCurrentQuestion = snap.l1CurrentQuestion ?? 0
      const serverWrongIds = snap.l1WrongIds ?? []

      const newPartsCleared: boolean[] = [false, false, false]
      for (let i = 0; i < serverPart; i++) newPartsCleared[i] = true

      // DynamoDB データから queue / queueIdx / firstAttemptCorrect を復元
      // l1SavedQueueIdx: 中断時の実際のキュー位置（l1CurrentQuestion とは異なる）
      const serverSavedQueueIdx = typeof snap.l1SavedQueueIdx === 'number' ? snap.l1SavedQueueIdx : undefined
      const serverSaveLike = {
        partsCleared: newPartsCleared,
        currentPart: serverPart,
        currentQuestion: serverCurrentQuestion,
        wrongIds: serverWrongIds,
        savedQueueIdx: serverSavedQueueIdx,
      }
      const serverRestored = buildRestoredL1State(serverSaveLike, serverPart)

      setPartsCleared(newPartsCleared)
      setActivePart(serverPart)
      setQueue(serverRestored.queue)
      setQueueIdx(serverRestored.queueIdx)
      setFirstAttemptCorrect(serverRestored.firstAttemptCorrect)
      setInputValue('')
      setLastResult(null)
      setWrongFeedback(false)
      setPhase('quiz')
      setPartScore(0)

      // 回答済みコマンドを復元（DynamoDBに保存値があればそちら、なければ choices[correctIndex] で補完）
      if (snap.l1AnsweredCommands && Object.keys(snap.l1AnsweredCommands).length > 0) {
        const restored: Record<number, string> = {}
        Object.entries(snap.l1AnsweredCommands).forEach(([k, v]) => {
          restored[Number(k)] = v
        })
        setAnsweredCommands(restored)
      } else {
        setAnsweredCommands(serverRestored.answeredCommands)
      }

      saveL1State(storageKey, newPartsCleared, serverPart, serverCurrentQuestion, serverWrongIds, serverSavedQueueIdx)
      setIsLoading(false)
    }
    void restore()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // フォーカス（復習モード・変更不可の回答済みの場合はフォーカスしない）
  useEffect(() => {
    const q = queue[queueIdx]
    const cleared = q ? firstAttemptCorrect[q.id] === true : false
    const retry = q ? (q.id in firstAttemptCorrect) : false
    const retryUnanswered = retry && !cleared && lastResult === null
    // 入力可能（未回答 or 再出題問題）のみフォーカス
    const canInput = lastResult === null && (retryUnanswered || !(queueIdx in answeredCommands)) && !cleared
    if (canInput && inputRef.current) inputRef.current.focus()
  }, [lastResult, queueIdx, answeredCommands, queue, firstAttemptCorrect])

  // モバイルナビ: 現在問題ボタンを中央にスクロール
  useEffect(() => {
    mobileCurrentRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [queueIdx])

  // フィードバック中は Enter → 次へ
  useEffect(() => {
    if (lastResult === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); goNext() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [lastResult, queue, queueIdx, firstAttemptCorrect, activePart, partsCleared])

  // 全クリア時にDynamoDB保存 + トースト表示
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (phase !== 'all_clear' || allClearSavedRef.current) return
    allClearSavedRef.current = true
    const save = async () => {
      const username = getCurrentDisplayName().trim().toLowerCase()
      if (!username || !isProgressApiAvailable()) {
        setToast({ message: '⚠ 保存に失敗しました', type: 'warning' })
        return
      }
      const base: TraineeProgressSnapshot = serverSnapshot ?? {
        introConfirmed: false, introAt: null, wbsPercent: 0, chapterProgress: [],
        currentDay: 0, delayedIds: [], updatedAt: '', pins: [],
      }
      try {
        const ok = await postProgress(username, {
          ...base,
          l1Cleared: true,
          l1CurrentPart: activePart,
          l1CurrentQuestion: PART_SIZE,
          l1WrongIds: [],
          l1AnsweredCommands: {},
          updatedAt: new Date().toISOString(),
        })
        setToast(ok
          ? { message: '✓ 進捗を保存しました', type: 'success' }
          : { message: '⚠ 保存に失敗しました', type: 'warning' }
        )
      } catch {
        setToast({ message: '⚠ 保存に失敗しました', type: 'warning' })
      }
    }
    void save()
  }, [phase, activePart, serverSnapshot])

  const firstAttemptCount = Object.keys(firstAttemptCorrect).length

  function handleExecute() {
    if (!current || lastResult !== null || isExecuting) return
    // setIsExecuting(true) を先にレンダリングさせるため、採点処理を setTimeout で遅延する。
    // React 18の自動バッチングにより await Promise.resolve() では描画されないため setTimeout を使う。
    setIsExecuting(true)
    const capturedCurrent = current
    const capturedInput = inputValue
    const capturedQueueIdx = queueIdx
    setTimeout(() => {
      try {
        const normalize = (s: string) => {
          let r = s.trim().replace(/\u3000/g, ' ').replace(/\s+/g, ' ').toLowerCase()
          r = r.replace(/^sudo(\s+-\S+\s+\S+)*\s+/, '')       // sudo (sudo -u root 等も) 除去
          r = r.split(' ').filter((t) => t !== '-y').join(' ').trim()  // -y トークンを除去
          r = r.replace(/(chown\s+\S+?):\S*/g, '$1')           // chown user:group → chown user
          r = r.replace(/["']/g, '')                            // クォート統一（シングル/ダブル除去）
          r = r.replace(/\/\s+/g, ' ').replace(/\/$/, '')      // パス末尾スラッシュ除去
          r = r.replace(/^vim(\s)/, 'vi$1')                    // vim → vi
          r = r.replace(/\bcurl\s+--head\b/, 'curl -i')        // curl --head → curl -I
          return r
        }
        const trimmed = normalize(capturedInput)
        const correctAnswer = normalize(capturedCurrent.choices[capturedCurrent.correctIndex] ?? '')
        const altAnswers = (capturedCurrent.alternatives ?? []).map(normalize)
        const correct = trimmed === correctAnswer || altAnswers.includes(trimmed)
        const isFirstAttempt = !(capturedCurrent.id in firstAttemptCorrect)

        if (correct) {
          // 正解: リトライでも firstAttemptCorrect を true に更新（スコアに反映・復習モード化）
          setFirstAttemptCorrect((prev) => ({ ...prev, [capturedCurrent.id]: true }))
          setLastResult('correct')
          setWrongFeedback(false)
          setAnsweredCommands((prev) => ({ ...prev, [capturedQueueIdx]: trimmed }))
        } else {
          // 不正解: 初回のみ firstAttemptCorrect に記録（キューへの追加は廃止）
          if (isFirstAttempt) {
            setFirstAttemptCorrect((prev) => ({ ...prev, [capturedCurrent.id]: false }))
          }
          setWrongFeedback(true)
          setShakeKey((k) => k + 1)
          // lastResult は null のまま → 入力欄は enabled・実行ボタン継続表示
        }
      } finally {
        setIsExecuting(false)
      }
    }, 0)
  }

  function handlePrevQuestion() {
    if (queueIdx > 0) {
      setLastResult(null)
      setWrongFeedback(false)
      setInputValue('')
      setQueueIdx((i) => i - 1)
    }
  }

  function handleNavigateTo(targetIdx: number) {
    const q = queue[targetIdx]
    if (!q || firstAttemptCorrect[q.id] !== true) return
    setLastResult(null)
    setWrongFeedback(false)
    setInputValue('')
    setQueueIdx(targetIdx)
  }

  async function goNext() {
    const isLast = queueIdx >= queue.length - 1
    if (isLast) {
      // 採点
      const partQs = getPartQuestions(activePart)
      const updatedCorrect = { ...firstAttemptCorrect }
      const score = partQs.filter((q) => updatedCorrect[q.id] === true).length
      setPartScore(score)

      const pass = score >= PASS_SCORE
      const newPartsCleared = [...partsCleared]
      if (pass) newPartsCleared[activePart] = true
      setPartsCleared(newPartsCleared)
      saveL1State(storageKey, newPartsCleared, activePart, PART_SIZE, [])

      if (pass && newPartsCleared.every(Boolean)) {
        window.localStorage.setItem(clearedKey, 'true')
        setPhase('all_clear')
      } else {
        setPhase('part_result')
      }
    } else {
      setQueueIdx((i) => i + 1)
      setLastResult(null)
      setWrongFeedback(false)
      setInputValue('')
    }
  }

  function startPart(partIdx: number) {
    setActivePart(partIdx)
    setQueue(getPartQuestions(partIdx))
    setQueueIdx(0)
    setFirstAttemptCorrect({})
    setInputValue('')
    setLastResult(null)
    setWrongFeedback(false)
    setPhase('quiz')
    setPartScore(0)
    setAnsweredCommands({})
  }

  /** 中断ボタン: DynamoDB保存 → ok なら遷移、失敗なら表示 */
  async function handleInterrupt() {
    if (isSaving) return
    setIsSaving(true)
    setSaveError(null)

    const wrongIds = Object.keys(firstAttemptCorrect).filter((id) => firstAttemptCorrect[id] === false)
    const currentQuestion = firstAttemptCount
    const savedQueueIdx = queueIdx

    // ① localStorage に現在の状態をキャッシュ保存
    saveL1State(storageKey, partsCleared, activePart, currentQuestion, wrongIds, savedQueueIdx)

    // ② DynamoDB に即時同期：serverSnapshotをベースに変化した値だけ上書き
    const username = getCurrentDisplayName().trim().toLowerCase()
    if (username && isProgressApiAvailable()) {
      const base: TraineeProgressSnapshot = serverSnapshot ?? {
        introConfirmed: false, introAt: null, wbsPercent: 0, chapterProgress: [],
        currentDay: 0, delayedIds: [], updatedAt: '', pins: [],
      }
      const cmdMap: Record<string, string> = {}
      Object.entries(answeredCommands).forEach(([k, v]) => { cmdMap[String(k)] = v })
      const partName = PART_NAMES[activePart] ?? '基本操作'
      const ok = await postProgress(username, {
        ...base,
        l1CurrentPart: activePart,
        l1CurrentQuestion: currentQuestion,
        l1SavedQueueIdx: savedQueueIdx,
        l1WrongIds: wrongIds,
        l1AnsweredCommands: cmdMap,
        lastActive: {
          moduleId: 'linux-level1',
          label: `Linuxコマンド30問 · ${partName} ${currentQuestion}/${PART_SIZE}問`,
          path: '/training/linux-level1',
          savedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      })
      if (!ok) {
        setSaveError('保存に失敗しました')
        setIsSaving(false)
        return
      }
    }

    // ③ 保存完了後に遷移
    setIsSaving(false)
    navigate('/')
  }

  // ────────── 読み込み中 ──────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-600">読み込み中...</p>
      </div>
    )
  }

  // ────────── 全クリア画面 ──────────
  if (phase === 'all_clear') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
          <p className="text-sublabel md:text-sublabel-pc font-semibold uppercase tracking-[0.2em] text-slate-400">RESULT</p>
          <h1 className="mt-2 text-display md:text-display-pc font-semibold text-slate-800 tracking-tight">Linuxコマンド30問</h1>
          <p className="mt-4 text-display md:text-display-pc font-bold text-emerald-600">全3部クリア！</p>
          <p className="mt-2 text-body md:text-body-pc text-slate-600">
            おめでとうございます。インフラ研修2にチャレンジできます。
          </p>
          <button
            type="button"
            onClick={() => {
              window.alert('インフラ研修1をクリアしました。インフラ研修2にチャレンジできます。')
              navigate('/')
            }}
            className="mt-4 rounded-xl bg-sky-600 px-4 py-2 text-button md:text-button-pc font-medium text-white hover:bg-sky-700"
          >
            クリアを記録する
          </button>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    )
  }

  // ────────── 部の結果画面 ──────────
  if (phase === 'part_result') {
    const pass = partScore >= PASS_SCORE
    const label = PART_LABELS[activePart]
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
          <p className="text-sublabel md:text-sublabel-pc font-semibold uppercase tracking-[0.2em] text-slate-400">RESULT</p>
          <h1 className="mt-2 text-display md:text-display-pc font-semibold text-slate-800 tracking-tight">
            {label}（{PART_NAMES[activePart]}）
          </h1>
          <p className="mt-4 text-display md:text-display-pc font-bold text-slate-800">
            {label} 結果: {partScore}/{PART_SIZE}問正解
          </p>
          {pass ? (
            <>
              <p className="mt-2 text-body md:text-body-pc font-semibold text-emerald-600">クリア！</p>
              {activePart < 2 && (
                <button
                  type="button"
                  onClick={() => startPart(activePart + 1)}
                  className="mt-4 rounded-xl bg-sky-600 px-4 py-2 text-button md:text-button-pc font-medium text-white hover:bg-sky-700"
                >
                  {PART_LABELS[activePart + 1]}（{PART_NAMES[activePart + 1]}）へ進む
                </button>
              )}
            </>
          ) : (
            <>
              <p className="mt-2 text-body md:text-body-pc text-rose-600">
                クリアには {PASS_SCORE}問 以上の正解が必要です。
              </p>
              <button
                type="button"
                onClick={() => startPart(activePart)}
                className="mt-4 rounded-xl bg-sky-600 px-4 py-2 text-button md:text-button-pc font-medium text-white hover:bg-sky-700"
              >
                もう一度チャレンジ
              </button>
            </>
          )}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-button md:text-button-pc font-medium text-slate-700 hover:bg-slate-50"
            >
              トップへ戻る
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ────────── クイズ画面 ──────────
  const isRetry = current ? (current.id in firstAttemptCorrect) : false
  const showFeedback = lastResult !== null

  // クリア済み = 初回正解済み（firstAttemptCorrectで判定、answeredCommandsがなくても機能する）
  const isCleared = current ? firstAttemptCorrect[current.id] === true : false
  // 復習モード = クリア済みかつフィードバック非表示（「前の問題」で戻ってきた状態）
  const isReviewMode = isCleared && !showFeedback
  // 再出題問題・未正解・フィードバック非表示 = 「前の問題」で不正解問題に戻った状態 or 再出題待ち
  // answeredCommandsに古い不正解回答があっても空入力欄・実行ボタンを表示する
  const isRetryUnanswered = isRetry && !isCleared && !showFeedback

  const progressLabel = `${PART_LABELS[activePart]} ${queueIdx + 1}問目 / 全${queue.length}問`
  const basePartQs = getPartQuestions(activePart)

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-slate-50 text-slate-800">

      {/* ────── モバイル: 上部横スクロールナビ（〜1023px） ────── */}
      <div className="lg:hidden flex-shrink-0 bg-white border-b border-gray-100 px-3 py-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scroll-pl-3">
          {basePartQs.map((q, i) => {
            const isCurrentQ = queueIdx === i
            const isCompletedQ = firstAttemptCorrect[q.id] === true
            return (
              <button
                key={q.id}
                ref={isCurrentQ ? mobileCurrentRef : null}
                type="button"
                onClick={() => { if (isCompletedQ && !isCurrentQ) handleNavigateTo(i) }}
                className={`w-8 h-8 rounded-full text-sm flex-shrink-0 flex items-center justify-center font-medium
                  ${isCurrentQ
                    ? 'bg-sky-500 text-white'
                    : isCompletedQ
                      ? 'bg-green-500 text-white cursor-pointer'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
              >
                {i + 1}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* ────── PC: 左サイドバー（1024px〜） ────── */}
        <aside className="hidden lg:flex flex-col w-48 shrink-0 sticky top-0 h-screen overflow-y-auto bg-white border-r border-gray-100">
          <div className="p-3 pt-4">
            <p className="text-sublabel md:text-sublabel-pc font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">問題一覧</p>
            {basePartQs.map((q, i) => {
              const isCurrentQ = queueIdx === i
              const isCompletedQ = firstAttemptCorrect[q.id] === true
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => { if (isCompletedQ && !isCurrentQ) handleNavigateTo(i) }}
                  className={`w-full text-left py-2 text-sm mb-0.5 flex items-center justify-between
                    ${isCurrentQ
                      ? 'bg-sky-50 text-sky-700 font-bold cursor-default border-l-2 border-sky-500 pl-2 pr-3 rounded-r-lg'
                      : isCompletedQ
                        ? 'bg-green-50 text-green-700 cursor-pointer hover:bg-green-100 rounded-lg px-3'
                        : 'text-gray-300 cursor-not-allowed rounded-lg px-3'
                    }`}
                >
                  <span>{i + 1}問</span>
                  {isCompletedQ && !isCurrentQ && <span className="text-xs">✓</span>}
                </button>
              )
            })}
          </div>
        </aside>

        {/* ────── メインコンテンツ ────── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-y-auto p-3 md:p-6">
          <div className="mx-auto max-w-xl w-full">
            {saveError && <p className="text-xs text-red-600 text-right mb-2">{saveError}</p>}
          </div>
          {/* 進捗バー + ナビゲーション */}
          <div className="mx-auto max-w-xl w-full flex items-center gap-3 mb-2 md:mb-4 px-1">
            <button
              type="button"
              onClick={handlePrevQuestion}
              disabled={queueIdx === 0}
              className={`text-button md:text-button-pc rounded-lg border border-slate-200 px-3.5 py-1.5 whitespace-nowrap ${queueIdx === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-50 cursor-pointer'}`}
            >
              ← 前の問題
            </button>
            <div className="flex-1 flex items-center gap-2">
              <span className="text-label md:text-label-pc text-slate-500 whitespace-nowrap">
                {progressLabel}
              </span>
              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-sky-300 rounded-full transition-all duration-300" style={{ width: `${((queueIdx + 1) / queue.length) * 100}%` }} />
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-xl w-full flex-1 min-h-0 flex flex-col bg-white rounded-xl border border-gray-200 p-5 md:p-10">
        <h1 className="text-display md:text-display-pc font-semibold text-slate-800 tracking-tight">
          Linuxコマンド30問
        </h1>
        <div className="mt-1 flex items-center gap-2" />

        <p className="text-display md:text-display-pc font-bold leading-snug text-gray-900 mt-2 mb-2 md:mt-4 md:mb-8">{current?.prompt}</p>

        {/* 回答済みバナー（クリア済み復習モード以外のみ表示） */}
        {queueIdx in answeredCommands && !showFeedback && !isReviewMode && (
          <div className="text-body md:text-body-pc rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 mb-3 text-emerald-700">
            ✓ 回答済みです（変更できません）
          </div>
        )}

        <form className="mt-2 md:mt-4" onSubmit={(e) => e.preventDefault()}>
          <label
            htmlFor="cmd-input"
            className="block text-[11px] font-medium uppercase tracking-wider text-slate-600 mb-1"
          >
            コマンドを入力
          </label>
          <div className="flex flex-row gap-2 items-center">
            <input
              ref={inputRef}
              id="cmd-input"
              type="text"
              value={
                // 正解フィードバック中: ユーザーが入力したコマンドをそのまま表示
                showFeedback
                  ? inputValue
                  // クリア済み復習モード / 回答済みで変更不可: 保存済み回答を表示
                  : isReviewMode || (!isRetryUnanswered && queueIdx in answeredCommands)
                    ? (answeredCommands[queueIdx] ?? '')
                    : inputValue
              }
              onChange={(e) => !showFeedback && !isReviewMode && (isRetryUnanswered || !(queueIdx in answeredCommands)) && setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                e.stopPropagation()
                if (showFeedback || isReviewMode) { void goNext() }
                else if ((isRetryUnanswered || !(queueIdx in answeredCommands)) && inputValue.trim() !== '' && !isExecuting) handleExecute()
              }}
              disabled={showFeedback || isReviewMode || (!isRetryUnanswered && queueIdx in answeredCommands)}
              className={`flex-1 min-w-0 rounded-xl border px-4 py-3 text-input text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:opacity-80 ${
                isReviewMode || showFeedback
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-slate-300 bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50'
              }`}
              autoComplete="off"
              spellCheck={false}
            />
            {isReviewMode ? (
              // クリア済み復習モード: 「次へ」ボタンを表示（実行ボタンは非表示）
              <button
                type="button"
                onClick={() => { void goNext() }}
                style={{ background: '#0ea5e9', color: 'white', border: 'none' }}
                className="shrink-0 whitespace-nowrap px-3 py-2.5 md:px-5 md:py-2.5 text-button md:text-button-pc font-medium rounded-lg cursor-pointer"
              >
                {queueIdx < queue.length - 1 ? '次へ' : '採点する'}
              </button>
            ) : !isRetryUnanswered && queueIdx in answeredCommands && !showFeedback ? (
              // 回答済みで変更不可（クリア済み以外の特殊ケース）
              <div />
            ) : !showFeedback ? (
              // 未回答 or 再出題問題: 実行ボタン表示
              <button
                type="button"
                onClick={() => { handleExecute() }}
                disabled={inputValue.trim() === '' || isExecuting}
                style={{ border: 'none' }}
                className="shrink-0 whitespace-nowrap px-3 py-2.5 md:px-5 md:py-2.5 text-button md:text-button-pc font-medium rounded-lg cursor-pointer bg-sky-500 text-white disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed disabled:pointer-events-none"
              >
                {isExecuting ? '採点中...' : '実行'}
              </button>
            ) : (
              // フィードバック後: 次へ/採点するボタン
              <button
                type="button"
                onClick={() => { void goNext() }}
                style={{ background: '#0ea5e9', color: 'white', border: 'none' }}
                className="shrink-0 whitespace-nowrap px-3 py-2.5 md:px-5 md:py-2.5 text-button md:text-button-pc font-medium rounded-lg cursor-pointer"
              >
                {queueIdx < queue.length - 1 ? '次へ' : '採点する'}
              </button>
            )}
          </div>
        </form>

        {/* 正解バッジ（クリア済み復習モード） */}
        {isReviewMode && (
          <div
            className="mt-2 md:mt-4 rounded-xl border border-emerald-500/50 bg-emerald-50 px-4 py-2 md:py-3 text-body md:text-body-pc text-emerald-800"
            role="status"
          >
            <span className="font-medium">✓ 正解</span>
          </div>
        )}

        {wrongFeedback && (
          <div
            key={shakeKey}
            className="mt-2 md:mt-4 rounded-xl border border-rose-500/50 bg-rose-50 px-4 py-2 md:py-3 text-body md:text-body-pc text-rose-800 animate-shake"
            role="status"
          >
            <span className="font-medium">✗ 不正解</span>
            <p className="mt-1 text-rose-700">入力したコマンドを見直してみましょう。AI講師に質問することもできます。</p>
          </div>
        )}

        {showFeedback && (
          <div
            className="mt-2 md:mt-4 rounded-xl border border-emerald-500/50 bg-emerald-50 px-4 py-2 md:py-3 text-body md:text-body-pc text-emerald-800"
            role="status"
          >
            <span className="font-medium">✓ 正解</span>
          </div>
        )}

      </div>
        </div>{/* /メインコンテンツ */}
      </div>{/* /flex row */}
    </div>
  )
}
