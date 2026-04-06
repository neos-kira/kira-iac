import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProgressKey } from './trainingWbsData'
import { LINUX_LEVEL1_QUESTIONS, L1_CLEARED_KEY, L1_PROGRESS_KEY } from './linuxLevel1Data'
import type { QuizQuestion } from './linuxLevel1Data'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'
import { postProgress, isProgressApiAvailable } from '../progressApi'
import { getCurrentDisplayName } from '../auth'
import { fetchMyProgress } from '../progressApi'

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

  // savedQueueIdx がなければ currentQuestion をフォールバックとして使う
  const rawQueueIdx = save.savedQueueIdx ?? save.currentQuestion
  // queue 範囲内かチェック（部クリア後など範囲外になる場合は 0 にリセット）
  const validPosition = rawQueueIdx > 0 && rawQueueIdx < queue.length
  return {
    queue,
    queueIdx: validPosition ? rawQueueIdx : 0,
    // 有効な途中位置のときだけ firstAttemptCorrect を復元（新規開始時はリセット）
    firstAttemptCorrect: validPosition ? firstAttemptCorrect : {},
  }
}

function getPartQuestions(partIdx: number): QuizQuestion[] {
  return LINUX_LEVEL1_QUESTIONS.slice(partIdx * PART_SIZE, (partIdx + 1) * PART_SIZE)
}


export function LinuxLevel1Page() {
  const navigate = useNavigate()
  const storageKey = getProgressKey(L1_PROGRESS_KEY)
  const clearedKey = getProgressKey(L1_CLEARED_KEY)

  const initSave = loadL1Save(storageKey)
  const initPart = initSave.currentPart
  // 中断前の状態（queue / queueIdx / firstAttemptCorrect）を保存データから復元
  const initRestored = buildRestoredL1State(initSave, initPart)

  // DynamoDB復元済みかどうかのフラグ（useEffect完了前に中断されないよう管理）
  const initPartRef = useRef(initPart)
  // マウント時点でlocalStorageにL1データが存在したか（復元条件の判定に使う）
  const hadLocalL1DataRef = useRef(
    typeof window !== 'undefined' && window.localStorage.getItem(getProgressKey(L1_PROGRESS_KEY)) !== null
  )

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
  const [lastResult, setLastResult] = useState<'correct' | 'wrong' | null>(null)
  const [phase, setPhase] = useState<'quiz' | 'part_result' | 'all_clear'>('quiz')
  const [partScore, setPartScore] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = 'インフラ研修1'
  }, [])

  // DynamoDBから初期状態を復元（優先順位: DynamoDB > localStorage > デフォルト）
  useEffect(() => {
    const restore = async () => {
      const username = getCurrentDisplayName().trim().toLowerCase()
      if (!username || username === 'admin') {
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
      // localStorage が空だった場合は無条件に復元、あった場合はサーバーの方が進んでいる場合のみ上書き
      const shouldRestore = !hadLocalL1DataRef.current || serverPart > initPartRef.current
      if (!shouldRestore) {
        setIsLoading(false)
        return
      }

      const serverCurrentQuestion = snap.l1CurrentQuestion ?? 0
      const serverWrongIds = snap.l1WrongIds ?? []

      const newPartsCleared: boolean[] = [false, false, false]
      for (let i = 0; i < serverPart; i++) newPartsCleared[i] = true

      // DynamoDB データから queue / queueIdx / firstAttemptCorrect を復元
      const serverSaveLike = {
        partsCleared: newPartsCleared,
        currentPart: serverPart,
        currentQuestion: serverCurrentQuestion,
        wrongIds: serverWrongIds,
        savedQueueIdx: undefined as number | undefined,
      }
      const serverRestored = buildRestoredL1State(serverSaveLike, serverPart)

      setPartsCleared(newPartsCleared)
      setActivePart(serverPart)
      setQueue(serverRestored.queue)
      setQueueIdx(serverRestored.queueIdx)
      setFirstAttemptCorrect(serverRestored.firstAttemptCorrect)
      setInputValue('')
      setLastResult(null)
      setPhase('quiz')
      setPartScore(0)

      saveL1State(storageKey, newPartsCleared, serverPart, serverCurrentQuestion, serverWrongIds)
      setIsLoading(false)
    }
    void restore()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // フォーカス
  useEffect(() => {
    if (lastResult === null && inputRef.current) inputRef.current.focus()
  }, [lastResult, queueIdx])

  // フィードバック中は Enter → 次へ
  useEffect(() => {
    if (lastResult === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); goNext() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [lastResult, queue, queueIdx, firstAttemptCorrect, activePart, partsCleared])

  const current = queue[queueIdx]
  const firstAttemptCount = Object.keys(firstAttemptCorrect).length
  const isRetrying = firstAttemptCount >= PART_SIZE

  function handleExecute() {
    if (!current || lastResult !== null) return
    const trimmed = inputValue.trim()
    const correctAnswer = (current.choices[current.correctIndex] ?? '').trim()
    const correct = trimmed === correctAnswer
    const isFirstAttempt = !(current.id in firstAttemptCorrect)

    if (isFirstAttempt) {
      setFirstAttemptCorrect((prev) => ({ ...prev, [current.id]: correct }))
      // 不正解の場合、キューの末尾に再追加（初回のみ）
      if (!correct) {
        setQueue((prev) => [...prev, current])
      }
    }

    setLastResult(correct ? 'correct' : 'wrong')
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
        // DynamoDB即時同期：serverSnapshotをベースに変化した値だけ上書き
        const username = getCurrentDisplayName().trim().toLowerCase()
        if (username && username !== 'admin' && isProgressApiAvailable()) {
          const base: TraineeProgressSnapshot = serverSnapshot ?? {
            introConfirmed: false, introAt: null, wbsPercent: 0, chapterProgress: [],
            currentDay: 0, delayedIds: [], updatedAt: '', pins: [],
          }
          await postProgress(username, {
            ...base,
            l1Cleared: true,
            l1CurrentPart: activePart,
            l1CurrentQuestion: PART_SIZE,
            l1WrongIds: [],
            updatedAt: new Date().toISOString(),
          })
        }
        setPhase('all_clear')
      } else {
        setPhase('part_result')
      }
    } else {
      setQueueIdx((i) => i + 1)
      setLastResult(null)
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
    setPhase('quiz')
    setPartScore(0)
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
    if (username && username !== 'admin' && isProgressApiAvailable()) {
      const base: TraineeProgressSnapshot = serverSnapshot ?? {
        introConfirmed: false, introAt: null, wbsPercent: 0, chapterProgress: [],
        currentDay: 0, delayedIds: [], updatedAt: '', pins: [],
      }
      const ok = await postProgress(username, {
        ...base,
        l1CurrentPart: activePart,
        l1CurrentQuestion: currentQuestion,
        l1WrongIds: wrongIds,
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
    window.location.hash = '#/'
  }

  // ────────── 読み込み中 ──────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">読み込み中...</p>
      </div>
    )
  }

  // ────────── 全クリア画面 ──────────
  if (phase === 'all_clear') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">RESULT</p>
          <h1 className="mt-2 text-xl font-semibold text-slate-800">インフラ研修1 — Linuxコマンド30問</h1>
          <p className="mt-4 text-2xl font-bold text-emerald-600">全3部クリア！</p>
          <p className="mt-2 text-sm text-slate-600">
            おめでとうございます。インフラ研修2にチャレンジできます。
          </p>
          <button
            type="button"
            onClick={() => {
              window.alert('インフラ研修1をクリアしました。インフラ研修2にチャレンジできます。')
              navigate('/')
            }}
            className="mt-4 rounded-xl bg-emerald-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            クリアを記録する
          </button>
        </div>
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">RESULT</p>
          <h1 className="mt-2 text-xl font-semibold text-slate-800">
            {label}（{PART_NAMES[activePart]}）
          </h1>
          <p className="mt-4 text-2xl font-bold text-slate-800">
            {label} 結果: {partScore}/{PART_SIZE}問正解
          </p>
          {pass ? (
            <>
              <p className="mt-2 text-base font-semibold text-emerald-600">クリア！</p>
              {activePart < 2 && (
                <button
                  type="button"
                  onClick={() => startPart(activePart + 1)}
                  className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  {PART_LABELS[activePart + 1]}（{PART_NAMES[activePart + 1]}）へ進む
                </button>
              )}
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-rose-600">
                クリアには {PASS_SCORE}問 以上の正解が必要です。
              </p>
              <button
                type="button"
                onClick={() => startPart(activePart)}
                className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                もう一度チャレンジ
              </button>
            </>
          )}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
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
  // 再出題バッジは「再出題問題に回答中かつまだ正解していない」ときだけ表示
  const showRetryBadge = isRetry && lastResult !== 'correct'
  const showFeedback = lastResult !== null

  const progressLabel = isRetrying
    ? `${PART_LABELS[activePart]} 復習中`
    : `${PART_LABELS[activePart]} ${firstAttemptCount + 1}/${PART_SIZE}問`

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          TRAINING · LINUX · LEVEL 1
        </p>
        <h1 className="mt-2 text-xl font-semibold text-slate-800">
          インフラ研修1 — Linuxコマンド30問
        </h1>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-xs text-slate-500">{progressLabel}</p>
          {showRetryBadge && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              再出題
            </span>
          )}
        </div>

        <p className="mt-4 text-sm font-medium text-slate-800">{current?.prompt}</p>

        <form className="mt-4" onSubmit={(e) => e.preventDefault()}>
          <label
            htmlFor="cmd-input"
            className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5"
          >
            コマンドを入力
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              id="cmd-input"
              type="text"
              value={inputValue}
              onChange={(e) => !showFeedback && setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                e.stopPropagation()
                if (showFeedback) goNext()
                else if (inputValue.trim() !== '') handleExecute()
              }}
              disabled={showFeedback}
              className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-70"
              autoComplete="off"
              spellCheck={false}
            />
            {!showFeedback ? (
              <button
                type="button"
                onClick={handleExecute}
                disabled={inputValue.trim() === ''}
                className="shrink-0 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                実行
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                className="shrink-0 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                {queueIdx < queue.length - 1 ? '次へ' : '採点する'}
              </button>
            )}
          </div>
        </form>

        {showFeedback && (
          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
              lastResult === 'correct'
                ? 'border-emerald-500/50 bg-emerald-50 text-emerald-800'
                : 'border-rose-500/50 bg-rose-50 text-rose-800'
            }`}
            role="status"
          >
            {lastResult === 'correct' ? (
              <span className="font-medium">✓ 正解</span>
            ) : (
              <span className="font-medium">✗ 不正解</span>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => { void handleInterrupt() }}
            disabled={isSaving}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? '保存中...' : '中断して保存 →'}
          </button>
          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
        </div>
      </div>
    </div>
  )
}
