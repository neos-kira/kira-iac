import { useState, useEffect } from 'react'
import type { QuizQuestion } from './linuxLevel1Data'

type Props = {
  title: string
  subtitle: string
  questions: QuizQuestion[]
  totalRequired: number
  onClear?: () => void
  storageKey?: string
  onInterrupt?: () => void
}

type SavedProgress = {
  currentIndex: number
  answers: number[]
}

function loadProgress(storageKey: string | undefined, total: number): SavedProgress {
  if (!storageKey || typeof window === 'undefined') {
    return { currentIndex: 0, answers: [] }
  }
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return { currentIndex: 0, answers: [] }
    const parsed = JSON.parse(raw) as Partial<SavedProgress>
    if (
      typeof parsed.currentIndex === 'number' &&
      Array.isArray(parsed.answers) &&
      parsed.currentIndex >= 0 &&
      parsed.currentIndex < total &&
      parsed.answers.length <= total
    ) {
      return { currentIndex: parsed.currentIndex, answers: parsed.answers as number[] }
    }
  } catch {
    // ignore
  }
  return { currentIndex: 0, answers: [] }
}

function saveProgress(storageKey: string | undefined, currentIndex: number, answers: number[]) {
  if (!storageKey || typeof window === 'undefined') return
  try {
    const payload: SavedProgress = { currentIndex, answers }
    window.localStorage.setItem(storageKey, JSON.stringify(payload))
  } catch {
    // ignore
  }
}

function clearProgress(storageKey: string | undefined) {
  if (!storageKey || typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(storageKey)
  } catch {
    // ignore
  }
}

function getCorrectAnswer(q: QuizQuestion): string {
  return q.choices[q.correctIndex] ?? ''
}

export function TrainingCommandQuizFrame({
  title,
  subtitle,
  questions,
  totalRequired,
  onClear,
  storageKey,
  onInterrupt,
}: Props) {
  const total = questions.length
  const initial = loadProgress(storageKey, total)
  const [currentIndex, setCurrentIndex] = useState(initial.currentIndex)
  const [answers, setAnswers] = useState<number[]>(initial.answers)
  const [inputValue, setInputValue] = useState('')
  const [lastResult, setLastResult] = useState<'correct' | 'wrong' | null>(null)

  const current = questions[currentIndex]
  const answeredCount = answers.length
  const isFinished = answeredCount === total
  const correctCount = answers.filter((a) => a === 1).length
  const isPass = isFinished && correctCount === totalRequired
  const correctAnswer = current ? getCorrectAnswer(current) : ''

  useEffect(() => {
    if (isFinished && storageKey) clearProgress(storageKey)
  }, [isFinished, storageKey])

  // 正解/不正解表示中は Enter で「次へ」を実行
  useEffect(() => {
    if (lastResult === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        goNext()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [lastResult])

  function handleExecute() {
    if (!current || lastResult !== null) return
    const trimmed = inputValue.trim()
    const correct = trimmed === correctAnswer.trim()
    const nextAnswers = [...answers, correct ? 1 : 0]
    setAnswers(nextAnswers)
    setLastResult(correct ? 'correct' : 'wrong')
    saveProgress(storageKey, currentIndex, nextAnswers)
  }

  function goNext() {
    setLastResult(null)
    setInputValue('')
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1)
    }
  }

  function reset() {
    setCurrentIndex(0)
    setAnswers([])
    setLastResult(null)
    setInputValue('')
    clearProgress(storageKey)
  }

  function interrupt() {
    saveProgress(storageKey, currentIndex, answers)
    if (onInterrupt) onInterrupt()
  }

  if (isFinished) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">RESULT</p>
          <h1 className="mt-2 text-xl font-semibold text-slate-800">{title}</h1>
          <p className="mt-4 text-2xl font-bold text-slate-800">
            得点: {correctCount} / {total}
          </p>
          {isPass ? (
            <>
              <p className="mt-2 text-sm text-emerald-300">満点です。クリア扱いになります。</p>
              {onClear && (
                <button
                  type="button"
                  onClick={() => {
                    clearProgress(storageKey)
                    onClear()
                  }}
                  className="mt-4 rounded-xl bg-emerald-600/80 px-4 py-2 text-sm font-medium text-white"
                >
                  クリアを記録する
                </button>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-rose-300">
              満点でのみクリアです。もう一度挑戦してください。
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            最初からやり直す
          </button>
        </div>
      </div>
    )
  }

  const showFeedback = lastResult !== null

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{subtitle}</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-800">{title}</h1>
        <p className="mt-1 text-xs text-slate-400">
          問題 {currentIndex + 1} / {total}（コマンドを入力して実行。一度実行したら正誤を確認し、Enter または「次へ」で次に進み、最後に採点。満点でのみクリア）
        </p>

        <p className="mt-4 text-sm font-medium text-slate-800">{current.prompt}</p>

        <div className="mt-4">
          <label htmlFor="cmd-input" className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">
            コマンドを入力
          </label>
          <div className="flex gap-2">
            <input
              id="cmd-input"
              type="text"
              value={inputValue}
              onChange={(e) => !showFeedback && setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !showFeedback) {
                  e.preventDefault()
                  if (inputValue.trim() !== '') handleExecute()
                }
                if (e.key === 'Enter' && showFeedback) {
                  e.preventDefault()
                  goNext()
                }
              }}
              disabled={showFeedback}
              placeholder="例: ls, pwd"
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
                {currentIndex < total - 1 ? '次へ' : '終了して得点を見る'}
              </button>
            )}
          </div>
        </div>

        {showFeedback && (
          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-sm ${lastResult === 'correct'
              ? 'border-emerald-500/50 bg-emerald-50 text-emerald-800'
              : 'border-rose-500/50 bg-rose-50 text-rose-800'
              }`}
            role="status"
          >
            {lastResult === 'correct' ? (
              <span className="font-medium">✓ 正解</span>
            ) : (
              <p>
                <span className="font-medium">✗ 不正解</span>
                <span className="ml-2 text-slate-600">正解は「{correctAnswer}」です。</span>
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={interrupt}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            中断してトップへ戻る
          </button>
        </div>
      </div>
    </div>
  )
}
