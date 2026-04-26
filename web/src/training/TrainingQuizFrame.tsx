import { useState, useEffect } from 'react'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
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
  const navigate = useSafeNavigate()
  const total = questions.length
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

  // 現在の問題が回答済みかどうか
  const isCurrentAnswered = currentIndex < answers.length
  // 回答済み問題の選択肢インデックス
  const answeredChoice = isCurrentAnswered ? answers[currentIndex] : null

  useEffect(() => {
    if (isFinished && storageKey) clearProgress(storageKey)
  }, [isFinished, storageKey])

  useEffect(() => {
    const handler = () => { void interrupt() }
    window.addEventListener('nic:save-and-leave', handler)
    return () => window.removeEventListener('nic:save-and-leave', handler)
  })

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
    navigate('/')
  }

  function handlePrev() {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1)
      setSelectedIndex(null)
    }
  }

  function handleNext() {
    if (isCurrentAnswered && currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1)
      setSelectedIndex(null)
    }
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
                  className="mt-4 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
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
    <div style={{ minHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }} className="bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-xl w-full">
        {suspendError && <p className="text-xs text-red-600 text-right mb-4">{suspendError}</p>}
      </div>

      {/* 進捗バー + 前後ナビ */}
      <div className="mx-auto max-w-xl w-full flex items-center gap-3 mb-4 px-1">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className={`text-button md:text-button-pc rounded-lg border border-slate-200 px-3 py-1.5 ${currentIndex === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-50 cursor-pointer'}`}
        >
          ← 前の問題
        </button>
        <div className="flex-1 flex items-center gap-2">
          <span className="text-label md:text-label-pc text-slate-500 whitespace-nowrap">
            {currentIndex + 1} / {total}問
          </span>
          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-sky-300 rounded-full transition-all duration-300" style={{ width: `${((currentIndex + 1) / total) * 100}%` }} />
          </div>
        </div>
        <button
          type="button"
          onClick={handleNext}
          disabled={!isCurrentAnswered || currentIndex >= total - 1}
          className={`text-button md:text-button-pc rounded-lg px-3 py-1.5 ${isCurrentAnswered && currentIndex < total - 1 ? 'bg-sky-500 text-white cursor-pointer hover:bg-sky-600' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
        >
          次の問題 →
        </button>
      </div>

      <div className="mx-auto max-w-xl w-full flex flex-col bg-white rounded-xl border border-slate-200 p-10" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{subtitle}</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-800">{title}</h1>
        <span className="text-label md:text-label-pc rounded bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1.5 mt-2 mb-4 inline-block">
          正誤は出さず、全問終了後に得点を表示します
        </span>

        {/* 回答済みバナー */}
        {isCurrentAnswered && (
          <div className="text-body md:text-body-pc rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 mb-4 text-emerald-700">
            ✓ この問題は回答済みです（回答内容の変更はできません）
          </div>
        )}

        <p className="text-display md:text-display-pc font-semibold text-slate-800 mb-8 leading-relaxed">{current.prompt}</p>
        <div className="grid gap-2">
          {current.choices.map((c, idx) => {
            const isSelected = isCurrentAnswered ? answeredChoice === idx : selectedIndex === idx
            return (
              <label
                key={c}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${isSelected
                  ? 'border-sky-500/60 bg-sky-50'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  } ${isCurrentAnswered ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <input
                  type="radio"
                  name={current.id}
                  className="h-4 w-4 accent-sky-600"
                  checked={isSelected}
                  onChange={() => { if (!isCurrentAnswered) setSelectedIndex(idx) }}
                  disabled={isCurrentAnswered}
                />
                <span className="text-slate-800">{c}</span>
              </label>
            )
          })}
        </div>

        {!isCurrentAnswered && (
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={selectedIndex == null}
              className={`text-button md:text-button-pc rounded-lg px-6 py-2.5 font-medium ${selectedIndex == null ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-sky-500 text-white cursor-pointer hover:bg-sky-600'}`}
            >
              {currentIndex < total - 1 ? '次へ' : '終了して得点を見る'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
