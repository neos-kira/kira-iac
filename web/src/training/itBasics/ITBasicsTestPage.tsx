import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSafeNavigate } from '../../hooks/useSafeNavigate'
import { IT_BASICS_CATEGORIES, type ITBasicsQuestion } from '../itBasicsData'
import { postProgress, fetchMyProgress, isProgressApiAvailable } from '../../progressApi'
import { getCurrentDisplayName } from '../../auth'
import type { TraineeProgressSnapshot } from '../../traineeProgressStorage'
import { Toast } from '../../components/Toast'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function ITBasicsTestPage() {
  const navigate = useSafeNavigate()
  const { categoryId } = useParams<{ categoryId: string }>()
  const cat = IT_BASICS_CATEGORIES.find((c) => c.id === categoryId)

  const questions = useMemo<ITBasicsQuestion[]>(
    () => (cat ? shuffle(cat.questions).slice(0, 10) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categoryId],
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const [serverSnapshot, setServerSnapshot] = useState<TraineeProgressSnapshot | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null)
  const itBasicsSavedRef = useRef(false)

  useEffect(() => {
    const load = async () => {
      const username = getCurrentDisplayName().trim().toLowerCase()
      if (!username) return
      const snap = await fetchMyProgress(username)
      if (snap) setServerSnapshot(snap)
    }
    void load()
  }, [])

  // 合格時にDynamoDB保存 + トースト表示
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!finished || !cat || score < cat.passingScore || itBasicsSavedRef.current) return
    itBasicsSavedRef.current = true
    const save = async () => {
      if (!categoryId || !isProgressApiAvailable()) {
        setToast({ message: '⚠ 保存に失敗しました', type: 'warning' })
        return
      }
      const username = getCurrentDisplayName().trim().toLowerCase()
      if (!username) {
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
          itBasicsProgress: {
            ...(base.itBasicsProgress ?? {}),
            [categoryId]: { cleared: true, clearedAt: new Date().toISOString() },
          },
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
  }, [finished, score, cat, categoryId, serverSnapshot])

  useEffect(() => {
    document.title = cat ? `${cat.title} — テスト` : 'IT業界の歩き方'
  }, [cat])

  if (!cat || questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-body md:text-body-pc text-slate-600">カテゴリが見つかりません</p>
      </div>
    )
  }

  const q = questions[currentIndex]
  const isCorrect = selectedIndex === q?.correctIndex
  const passed = score >= cat.passingScore

  function handleSelect(ci: number) {
    if (answered) return
    setSelectedIndex(ci)
  }

  function handleAnswer() {
    if (selectedIndex === null || answered) return
    setAnswered(true)
    if (selectedIndex === q.correctIndex) {
      setScore((s) => s + 1)
    }
  }

  function handleNext() {
    if (currentIndex + 1 >= questions.length) {
      setFinished(true)
    } else {
      setCurrentIndex((i) => i + 1)
      setSelectedIndex(null)
      setAnswered(false)
    }
  }

  function handleRetry() {
    setCurrentIndex(0)
    setSelectedIndex(null)
    setAnswered(false)
    setScore(0)
    setFinished(false)
  }

  if (finished) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
        <div className="mx-auto max-w-2xl space-y-6">

          <div className={`rounded-2xl border p-8 text-center shadow-sm ${passed ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
            <p className={`text-3xl font-bold ${passed ? 'text-emerald-700' : 'text-red-700'}`}>
              {passed ? '合格' : '不合格'}
            </p>
            <p className="mt-3 text-display md:text-display-pc font-semibold text-slate-800">
              {score} / {questions.length} 問正解
            </p>
            <p className="mt-1 text-body md:text-body-pc text-slate-600">
              合格ライン: {cat.passingScore} / {questions.length} 問
            </p>
            <div className="mt-6 flex justify-center gap-3">
              {!passed && (
                <button type="button" onClick={handleRetry} className="rounded-xl bg-sky-600 px-6 py-2.5 text-button md:text-button-pc font-medium text-white hover:bg-sky-700">
                  もう一度
                </button>
              )}
              <button type="button" onClick={() => { navigate('/it-basics') }} className="rounded-xl bg-white border border-slate-200 px-6 py-2.5 text-button md:text-button-pc font-medium text-slate-700 hover:bg-slate-50">
                カテゴリ一覧へ
              </button>
            </div>
          </div>
        </div>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <p className="text-label md:text-label-pc text-slate-600">{cat.title}</p>
          <h1 className="text-display md:text-display-pc font-bold text-slate-800 tracking-tight">{cat.title} — 確認テスト</h1>
        </div>
        <div className="flex items-center justify-end">
          <span className="text-body md:text-body-pc text-slate-600">
            {currentIndex + 1} / {questions.length} 問
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-body md:text-body-pc font-semibold text-slate-800 leading-relaxed">{q.prompt}</p>

          <ul className="mt-5 space-y-2">
            {q.choices.map((choice, ci) => {
              const isSelected = selectedIndex === ci
              const isCorrectChoice = ci === q.correctIndex
              let style = 'border-slate-200 bg-white hover:bg-slate-50 cursor-pointer'
              if (answered) {
                if (isCorrectChoice) style = 'border-emerald-300 bg-emerald-50'
                else if (isSelected && !isCorrectChoice) style = 'border-red-300 bg-red-50'
                else style = 'border-slate-200 bg-white'
              } else if (isSelected) {
                style = 'border-sky-300 bg-sky-50'
              }

              let markerStyle = 'bg-slate-200 text-slate-600'
              if (answered) {
                if (isCorrectChoice) markerStyle = 'bg-emerald-500 text-white'
                else if (isSelected) markerStyle = 'bg-red-500 text-white'
              } else if (isSelected) {
                markerStyle = 'bg-sky-200 text-sky-800'
              }

              return (
                <li key={ci}>
                  <button
                    type="button"
                    onClick={() => handleSelect(ci)}
                    disabled={answered}
                    className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${style} ${answered ? 'cursor-default' : ''}`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-label md:text-label-pc font-bold ${markerStyle}`}>
                      {answered && isCorrectChoice ? '✓' : String.fromCharCode(65 + ci)}
                    </span>
                    <span className="text-body md:text-body-pc text-slate-800 flex-1">{choice}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          {!answered && (
            <button
              type="button"
              disabled={selectedIndex === null}
              onClick={handleAnswer}
              className="mt-5 rounded-xl bg-sky-600 px-5 py-2.5 text-button md:text-button-pc font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              回答する
            </button>
          )}

          {answered && (
            <div className={`mt-5 rounded-xl border p-4 ${isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              <p className={`text-body md:text-body-pc font-semibold ${isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                {isCorrect ? '✓ 正解' : '✗ 不正解'}
              </p>
              <p className="mt-2 text-label md:text-label-pc text-slate-700 leading-relaxed">{q.explanation}</p>
              <button
                type="button"
                onClick={handleNext}
                className="mt-4 rounded-xl bg-sky-600 px-5 py-2.5 text-button md:text-button-pc font-medium text-white hover:bg-sky-700"
              >
                {currentIndex + 1 >= questions.length ? '結果を見る' : '次の問題 →'}
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i < currentIndex ? 'bg-sky-400' : i === currentIndex ? 'bg-sky-600' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
