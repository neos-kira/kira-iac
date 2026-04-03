import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProgressKey } from './trainingWbsData'
import { LINUX_LEVEL1_QUESTIONS, L1_CLEARED_KEY, L1_PROGRESS_KEY } from './linuxLevel1Data'
import type { QuizQuestion } from './linuxLevel1Data'

const PART_SIZE = 10
const PASS_SCORE = 8
const PART_LABELS = ['第1部', '第2部', '第3部']
const PART_NAMES = ['基本操作', 'サーバ構築必須', '実践問題']

type PartSave = { partsCleared: boolean[] }

function loadPartsCleared(key: string): boolean[] {
  if (typeof window === 'undefined') return [false, false, false]
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return [false, false, false]
    const parsed = JSON.parse(raw) as Partial<PartSave>
    if (Array.isArray(parsed.partsCleared) && parsed.partsCleared.length === 3) {
      return parsed.partsCleared as boolean[]
    }
  } catch {
    // ignore
  }
  return [false, false, false]
}

function savePartsCleared(key: string, partsCleared: boolean[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify({ partsCleared }))
  } catch {
    // ignore
  }
}

function getPartQuestions(partIdx: number): QuizQuestion[] {
  return LINUX_LEVEL1_QUESTIONS.slice(partIdx * PART_SIZE, (partIdx + 1) * PART_SIZE)
}

function initialActivePart(cleared: boolean[]): number {
  const next = cleared.findIndex((c) => !c)
  return next === -1 ? 0 : next
}

export function LinuxLevel1Page() {
  const navigate = useNavigate()
  const storageKey = getProgressKey(L1_PROGRESS_KEY)
  const clearedKey = getProgressKey(L1_CLEARED_KEY)

  const initCleared = loadPartsCleared(storageKey)
  const initPart = initialActivePart(initCleared)

  const [partsCleared, setPartsCleared] = useState<boolean[]>(initCleared)
  const [activePart, setActivePart] = useState<number>(initPart)
  const [queue, setQueue] = useState<QuizQuestion[]>(getPartQuestions(initPart))
  const [queueIdx, setQueueIdx] = useState(0)
  // firstAttemptCorrect: questionId → true/false (first attempt result)
  const [firstAttemptCorrect, setFirstAttemptCorrect] = useState<Record<string, boolean>>({})
  const [inputValue, setInputValue] = useState('')
  const [lastResult, setLastResult] = useState<'correct' | 'wrong' | null>(null)
  const [phase, setPhase] = useState<'quiz' | 'part_result' | 'all_clear'>('quiz')
  const [partScore, setPartScore] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = 'インフラ研修1'
  }, [])

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

  function goNext() {
    const isLast = queueIdx >= queue.length - 1
    if (isLast) {
      // 採点
      const partQs = getPartQuestions(activePart)
      // firstAttemptCorrect が更新済みの最新値を参照するため state を直接使う
      const updatedCorrect = { ...firstAttemptCorrect }
      // goNext は lastResult が non-null の時だけ呼ばれる。
      // handleExecute で setFirstAttemptCorrect が呼ばれた後、再レンダリングされてから
      // このクロージャがキャプチャされているので firstAttemptCorrect は最新値のはず。
      const score = partQs.filter((q) => updatedCorrect[q.id] === true).length
      setPartScore(score)

      const pass = score >= PASS_SCORE
      const newPartsCleared = [...partsCleared]
      if (pass) newPartsCleared[activePart] = true
      setPartsCleared(newPartsCleared)
      savePartsCleared(storageKey, newPartsCleared)

      if (pass && newPartsCleared.every(Boolean)) {
        window.localStorage.setItem(clearedKey, 'true')
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
  const correctAnswer = current ? (current.choices[current.correctIndex] ?? '') : ''
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

        <div className="mt-6">
          <button
            type="button"
            onClick={() => { savePartsCleared(storageKey, partsCleared); navigate('/') }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            中断してトップへ戻る
          </button>
        </div>
      </div>
    </div>
  )
}
