import { useState, useEffect, useRef } from 'react'
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
  const [answeredCommands, setAnsweredCommands] = useState<Record<number, string>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  const current = questions[currentIndex]
  const answeredCount = answers.length
  const isFinished = answeredCount === total
  const correctCount = answers.filter((a) => a === 1).length
  const isPass = isFinished && correctCount === totalRequired
  const correctAnswer = current ? getCorrectAnswer(current) : ''

  // 現在の問題が回答済みかどうか
  const isCurrentAnswered = currentIndex < answers.length

  useEffect(() => {
    if (isFinished && storageKey) clearProgress(storageKey)
  }, [isFinished, storageKey])

  useEffect(() => {
    if (lastResult === null && !isCurrentAnswered && inputRef.current) {
      inputRef.current.focus()
    }
  }, [lastResult, currentIndex, isCurrentAnswered])

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
    const normalize = (s: string) => s.trim().replace(/\u3000/g, ' ').replace(/\s+/g, ' ')
    const trimmed = normalize(inputValue)
    const correct = trimmed === normalize(correctAnswer)
    const nextAnswers = [...answers, correct ? 1 : 0]
    setAnswers(nextAnswers)
    setLastResult(correct ? 'correct' : 'wrong')
    setAnsweredCommands((prev) => ({ ...prev, [currentIndex]: trimmed }))
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
    setAnsweredCommands({})
    clearProgress(storageKey)
  }

  function interrupt() {
    saveProgress(storageKey, currentIndex, answers)
    if (onInterrupt) onInterrupt()
  }

  function handlePrev() {
    if (currentIndex > 0) {
      setLastResult(null)
      setInputValue('')
      setCurrentIndex((i) => i - 1)
    }
  }

  function handleNextNav() {
    if (isCurrentAnswered && currentIndex < total - 1) {
      setLastResult(null)
      setInputValue('')
      setCurrentIndex((i) => i + 1)
    }
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
    <div style={{ minHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }} className="bg-slate-50 text-slate-800 p-6">
      {/* 進捗バー + 前後ナビ */}
      <div className="mx-auto max-w-xl w-full" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '0 4px' }}>
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', color: currentIndex === 0 ? '#d1d5db' : '#374151', cursor: currentIndex === 0 ? 'not-allowed' : 'pointer' }}
        >
          ← 前の問題
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
            {currentIndex + 1} / {total}問
          </span>
          <div style={{ flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${((currentIndex + 1) / total) * 100}%`, height: '100%', background: '#0d9488', borderRadius: '3px', transition: 'width 0.3s ease' }} />
          </div>
        </div>
        <button
          type="button"
          onClick={handleNextNav}
          disabled={!isCurrentAnswered || currentIndex >= total - 1}
          style={{ background: isCurrentAnswered && currentIndex < total - 1 ? '#0d9488' : '#e5e7eb', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', color: isCurrentAnswered && currentIndex < total - 1 ? 'white' : '#9ca3af', cursor: isCurrentAnswered && currentIndex < total - 1 ? 'pointer' : 'not-allowed' }}
        >
          次の問題 →
        </button>
      </div>

      <div className="mx-auto max-w-xl w-full" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '40px', minHeight: 'calc(100vh - 200px)' }}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{subtitle}</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-800">{title}</h1>
        <p className="mt-1 text-xs text-slate-400">
          コマンドを入力して実行。一度実行したら正誤を確認し、Enter または「次へ」で次に進み、最後に採点。満点でのみクリア
        </p>

        {/* 回答済みバナー */}
        {isCurrentAnswered && !showFeedback && (
          <div style={{ background: '#f0fdf9', border: '1px solid #d1fae5', borderRadius: '8px', padding: '10px 16px', marginTop: '16px', marginBottom: '16px', fontSize: '13px', color: '#0d9488' }}>
            ✓ この問題は回答済みです（回答内容の変更はできません）
          </div>
        )}

        <p style={{ fontSize: '20px', fontWeight: 600, color: '#111827', marginBottom: '32px', lineHeight: '1.7', marginTop: '16px' }}>{current.prompt}</p>

        <form
          className="mt-4"
          onSubmit={(e) => e.preventDefault()}
        >
          <label htmlFor="cmd-input" className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">
            コマンドを入力
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              id="cmd-input"
              type="text"
              value={isCurrentAnswered && !showFeedback ? (answeredCommands[currentIndex] ?? '') : inputValue}
              onChange={(e) => !showFeedback && !isCurrentAnswered && setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                e.stopPropagation()
                if (showFeedback) {
                  goNext()
                } else if (!isCurrentAnswered && inputValue.trim() !== '') {
                  handleExecute()
                }
              }}
              disabled={showFeedback || isCurrentAnswered}
              placeholder=""
              className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50 disabled:opacity-70"
              autoComplete="off"
              spellCheck={false}
            />
            {isCurrentAnswered && !showFeedback ? (
              <div />
            ) : !showFeedback ? (
              <button
                type="button"
                onClick={handleExecute}
                disabled={inputValue.trim() === ''}
                style={inputValue.trim() === ''
                  ? { background: '#e5e7eb', color: '#9ca3af', cursor: 'not-allowed', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 500, pointerEvents: 'none' as const }
                  : { background: '#0d9488', color: 'white', cursor: 'pointer', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 500 }
                }
                className="shrink-0"
              >
                実行
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                style={{ background: '#0d9488', color: 'white', cursor: 'pointer', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 500 }}
                className="shrink-0"
              >
                {currentIndex < total - 1 ? '次へ' : '終了して得点を見る'}
              </button>
            )}
          </div>
        </form>

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
              <span className="font-medium">✗ 不正解</span>
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
