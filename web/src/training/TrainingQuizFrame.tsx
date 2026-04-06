import { useState, useEffect } from 'react'
import type { QuizQuestion } from './linuxLevel1Data'

type Props = {
  title: string
  subtitle: string
  questions: QuizQuestion[]
  totalRequired: number
  onClear?: () => void
  storageKey?: string
  /** DynamoDBから取得した再開位置。提供された場合はlocalStorageより優先する */
  serverInitialIndex?: number
  /** 中断時: 現在インデックスと回答配列を受け取りDynamoDB保存する。trueなら遷移、falseならエラー表示 */
  onInterrupt?: (currentIndex: number, answers: number[]) => Promise<boolean>
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

export function TrainingQuizFrame({
  title,
  subtitle,
  questions,
  totalRequired,
  onClear,
  storageKey,
  serverInitialIndex,
  onInterrupt,
}: Props) {
  const total = questions.length
  // serverInitialIndex が提供された場合はそちらを優先（localStorageは参照しない）
  const initial = typeof serverInitialIndex === 'number' && serverInitialIndex > 0 && serverInitialIndex < total
    ? { currentIndex: serverInitialIndex, answers: [] as number[] }
    : loadProgress(storageKey, total)
  const [currentIndex, setCurrentIndex] = useState(initial.currentIndex)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [answers, setAnswers] = useState<number[]>(initial.answers)
  const [isSuspending, setIsSuspending] = useState(false)
  const [suspendError, setSuspendError] = useState<string | null>(null)

  const current = questions[currentIndex]
  const answeredCount = answers.length
  const isFinished = answeredCount === total
  const correctCount = answers.filter((a, i) => a === questions[i].correctIndex).length
  const isPass = isFinished && correctCount === totalRequired

  useEffect(() => {
    if (isFinished && storageKey) clearProgress(storageKey)
  }, [isFinished, storageKey])

  function submit() {
    if (selectedIndex == null) return
    setAnswers((prev) => {
      const nextAnswers = [...prev, selectedIndex]
      const nextIndex = currentIndex < total - 1 ? currentIndex + 1 : currentIndex
      saveProgress(storageKey, nextIndex, nextAnswers)
      return nextAnswers
    })
    setSelectedIndex(null)
    if (currentIndex < total - 1) setCurrentIndex((i) => i + 1)
  }

  function reset() {
    setCurrentIndex(0)
    setSelectedIndex(null)
    setAnswers([])
    clearProgress(storageKey)
  }

  async function interrupt() {
    if (isSuspending) return
    setIsSuspending(true)
    setSuspendError(null)
    if (onInterrupt) {
      const ok = await onInterrupt(currentIndex, answers)
      if (!ok) {
        setSuspendError('保存に失敗しました')
        setIsSuspending(false)
        return
      }
    }
    setIsSuspending(false)
    window.location.hash = '#/'
  }

  if (isFinished) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">RESULT</p>
          <h1 className="mt-2 text-xl font-semibold text-slate-800">{title}</h1>
          <p className="mt-4 text-2xl font-bold text-slate-800">
            得点: {correctCount} / {total}
          </p>
          {isPass ? (
            <>
              <p className="mt-2 text-sm text-emerald-600">合格です。クリア扱いになります。</p>
              {onClear && (
                <button
                  type="button"
                  onClick={() => {
                    clearProgress(storageKey)
                    onClear()
                  }}
                  className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  クリアを記録する
                </button>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-rose-600">
              {totalRequired}/{total} 以上で合格です。もう一度挑戦してください。
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            最初からやり直す
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{subtitle}</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-800">{title}</h1>
        <p className="mt-1 text-xs text-slate-400">
          問題 {currentIndex + 1} / {total}（正誤は出さず、全問終了後に得点を表示します）
        </p>

        <p className="mt-4 text-sm font-medium text-slate-800">{current.prompt}</p>
        <div className="mt-3 grid gap-2">
          {current.choices.map((c, idx) => (
            <label
              key={c}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm ${selectedIndex === idx
                ? 'border-indigo-500/60 bg-indigo-50'
                : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
            >
              <input
                type="radio"
                name={current.id}
                className="h-4 w-4 accent-indigo-500"
                checked={selectedIndex === idx}
                onChange={() => setSelectedIndex(idx)}
              />
              <span className="text-slate-800">{c}</span>
            </label>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={selectedIndex == null}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            {currentIndex < total - 1 ? '次へ' : '終了して得点を見る'}
          </button>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => { void interrupt() }}
              disabled={isSuspending}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSuspending ? '保存中...' : '中断して保存 →'}
            </button>
            {suspendError && <p className="text-xs text-red-600">{suspendError}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
