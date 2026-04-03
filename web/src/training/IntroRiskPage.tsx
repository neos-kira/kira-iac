import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { INTRO_RISK_QUESTIONS, INTRO_RISK_CLEARED_KEY } from './introRiskData'
import type { RiskQuestion } from './introRiskData'
import { getProgressKey } from './trainingWbsData'
import { getCurrentDisplayName } from '../auth'
import { fetchMyProgress, postProgress, isProgressApiAvailable } from '../progressApi'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'

type ScoringResult = {
  pass: boolean
  feedback: string
}

const SECTIONS = Array.from(new Set(INTRO_RISK_QUESTIONS.map((q) => q.section)))

function getSectionInfo(q: RiskQuestion) {
  const sectionIndex = SECTIONS.indexOf(q.section)
  const sectionQuestions = INTRO_RISK_QUESTIONS.filter((x) => x.section === q.section)
  const questionInSection = sectionQuestions.indexOf(q) + 1
  const totalInSection = sectionQuestions.length
  return { sectionIndex: sectionIndex + 1, questionInSection, totalInSection }
}

const EMPTY_SNAPSHOT: TraineeProgressSnapshot = {
  introConfirmed: false,
  introAt: null,
  wbsPercent: 0,
  chapterProgress: [],
  currentDay: 0,
  delayedIds: [],
  updatedAt: '',
  pins: [],
}

export function IntroRiskPage() {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<ScoringResult | null>(null)
  const [isScoring, setIsScoring] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [serverSnapshot, setServerSnapshot] = useState<TraineeProgressSnapshot | null>(null)

  useEffect(() => {
    document.title = '導入課題 リスク管理'
  }, [])

  useEffect(() => {
    const username = getCurrentDisplayName().trim().toLowerCase()
    if (!username || username === 'admin') return
    fetchMyProgress(username).then((snap) => {
      if (snap) {
        setServerSnapshot(snap)
        if (snap.introRiskCleared) {
          setIsCompleted(true)
          return
        }
        if (typeof snap.introRiskCurrentQuestion === 'number' && snap.introRiskCurrentQuestion > 0) {
          setCurrentIndex(snap.introRiskCurrentQuestion)
        }
        if (snap.introRiskAnswers && typeof snap.introRiskAnswers === 'object') {
          setAnswers(snap.introRiskAnswers)
        }
      }
    })
  }, [])

  const question = INTRO_RISK_QUESTIONS[currentIndex]
  const currentAnswer = answers[question?.id ?? ''] ?? ''

  const handleScore = async () => {
    if (!question || !currentAnswer.trim() || isScoring) return
    setIsScoring(true)
    setResult(null)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': (import.meta.env.VITE_ANTHROPIC_API_KEY as string) ?? '',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: `あなたはITインフラ研修の採点者です。
以下の採点基準に基づいて回答を採点してください。

採点基準: ${question.scoringCriteria}

受講生の回答: ${currentAnswer}

以下のJSON形式のみで返答してください。
{
  "pass": true or false,
  "feedback": "合格の場合は良かった点、不合格の場合は具体的な改善点を100字以内で"
}`,
            },
          ],
        }),
      })

      const data = (await response.json()) as { content?: { type: string; text: string }[] }
      const text = data.content?.[0]?.text ?? ''
      const match = text.match(/\{[\s\S]*?\}/)
      if (match) {
        const parsed = JSON.parse(match[0]) as ScoringResult
        setResult(parsed)

        if (parsed.pass) {
          const nextAnswers = { ...answers, [question.id]: currentAnswer }
          setAnswers(nextAnswers)

          const username = getCurrentDisplayName().trim().toLowerCase()
          if (username && username !== 'admin' && isProgressApiAvailable()) {
            const base: TraineeProgressSnapshot = serverSnapshot ?? EMPTY_SNAPSHOT
            await postProgress(username, {
              ...base,
              introRiskCurrentQuestion: currentIndex,
              introRiskAnswers: nextAnswers,
              updatedAt: new Date().toISOString(),
            })
          }
        }
      } else {
        setResult({ pass: false, feedback: '採点結果を取得できませんでした。もう一度お試しください。' })
      }
    } catch {
      setResult({ pass: false, feedback: '採点中にエラーが発生しました。もう一度お試しください。' })
    } finally {
      setIsScoring(false)
    }
  }

  const handleNext = async () => {
    const isLast = currentIndex + 1 >= INTRO_RISK_QUESTIONS.length
    if (isLast) {
      const username = getCurrentDisplayName().trim().toLowerCase()
      if (username && username !== 'admin' && isProgressApiAvailable()) {
        const base: TraineeProgressSnapshot = serverSnapshot ?? EMPTY_SNAPSHOT
        await postProgress(username, {
          ...base,
          introRiskCurrentQuestion: INTRO_RISK_QUESTIONS.length,
          introRiskAnswers: answers,
          introRiskCleared: true,
          updatedAt: new Date().toISOString(),
        })
      }
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(getProgressKey(INTRO_RISK_CLEARED_KEY), 'true')
        } catch {
          // ignore
        }
      }
      setIsCompleted(true)
    } else {
      setResult(null)
      setCurrentIndex((prev) => prev + 1)
    }
  }

  const handleRetry = () => {
    setResult(null)
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-emerald-200 bg-white p-10 shadow-sm text-center">
            <p className="text-5xl">🎉</p>
            <h1 className="mt-5 text-xl font-semibold text-slate-800">導入課題クリア！</h1>
            <p className="mt-2 text-sm text-slate-600">
              全 {INTRO_RISK_QUESTIONS.length} 問すべてに合格しました。インフラ基礎課題1に進みましょう。
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mt-7 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700"
            >
              トップへ戻る
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!question) return null

  const sectionInfo = getSectionInfo(question)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              TRAINING · 導入課題 · リスク管理
            </p>
            <h1 className="mt-1 text-xl font-semibold text-slate-800">導入課題 — リスク管理</h1>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            トップへ戻る
          </button>
        </div>

        {/* 進捗表示 */}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="font-medium text-slate-700">
            {sectionInfo.sectionIndex}-{sectionInfo.questionInSection} {question.section}{' '}
            {sectionInfo.questionInSection}/{sectionInfo.totalInSection}問
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5">
            全体 {currentIndex + 1} / {INTRO_RISK_QUESTIONS.length}問
          </span>
        </div>

        {/* 進捗バー */}
        <div className="h-1.5 w-full rounded-full bg-slate-200">
          <div
            className="h-1.5 rounded-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${((currentIndex) / INTRO_RISK_QUESTIONS.length) * 100}%` }}
          />
        </div>

        {/* 問題カード */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
            {question.section}
          </p>
          <p className="text-sm font-medium text-slate-800 whitespace-pre-wrap leading-relaxed">
            {question.prompt}
          </p>

          <textarea
            className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-60"
            rows={6}
            placeholder="回答を入力してください..."
            value={currentAnswer}
            disabled={isScoring || result !== null}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
          />

          {!result && (
            <button
              type="button"
              disabled={!currentAnswer.trim() || isScoring}
              onClick={handleScore}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 transition-opacity"
            >
              {isScoring ? '採点中...' : '採点する'}
            </button>
          )}
        </section>

        {/* 採点結果 */}
        {result && (
          <section
            className={`rounded-2xl border p-5 shadow-sm ${
              result.pass
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-red-200 bg-red-50'
            }`}
          >
            <p
              className={`text-base font-semibold ${
                result.pass ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {result.pass ? '✓ 合格' : '✗ 不合格'}
            </p>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed">{result.feedback}</p>

            <div className="mt-4">
              {result.pass ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  {currentIndex + 1 >= INTRO_RISK_QUESTIONS.length ? '完了' : '次へ →'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="rounded-xl bg-slate-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  もう一度
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
