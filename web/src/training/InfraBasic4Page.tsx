import { useEffect, useState, useCallback } from 'react'
import { getCurrentUsername } from '../auth'
import { VI_STEPS, SHELL_QUESTIONS } from './InfraBasic4Data'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'
import { fetchMyProgress, postProgress, isProgressApiAvailable, scoreAnswerV2 } from '../progressApi'

const EMPTY_SNAPSHOT: TraineeProgressSnapshot = {
  introConfirmed: false, introAt: null, wbsPercent: 0,
  chapterProgress: [], currentDay: 0, delayedIds: [], updatedAt: '', pins: [],
}

type Rating = 'pass' | 'partial' | 'fail'

type ScoreState = {
  status: 'idle' | 'scoring' | 'done' | 'error'
  rating?: Rating
  comment?: string
  advice?: string
  error?: string
}

const RATING_STYLES: Record<Rating, { bg: string; icon: string; label: string }> = {
  pass: { bg: 'bg-emerald-50 border-emerald-200', icon: '✅', label: '合格' },
  partial: { bg: 'bg-amber-50 border-amber-200', icon: '🔶', label: '部分的に正しい' },
  fail: { bg: 'bg-rose-50 border-rose-200', icon: '❌', label: '不合格' },
}

export function InfraBasic4Page() {
  const username = getCurrentUsername()
  const isKiraTest = username === 'kira-test'

  const [snapshot, setSnapshot] = useState<TraineeProgressSnapshot | null>(null)
  const [viDone, setViDone] = useState<Record<number, boolean>>({})
  const [shellDone, setShellDone] = useState<Record<number, boolean>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [viAnswers, setViAnswers] = useState<Record<number, string>>({})
  const [shellAnswers, setShellAnswers] = useState<Record<number, string>>({})
  const [viScores, setViScores] = useState<Record<number, ScoreState>>({})
  const [shellScores, setShellScores] = useState<Record<number, ScoreState>>({})

  const viDoneCount = VI_STEPS.filter((s) => viDone[s.step]).length
  const shellDoneCount = SHELL_QUESTIONS.filter((s) => shellDone[s.q]).length
  const viAll = viDoneCount === VI_STEPS.length
  const shellUnlocked = isKiraTest || viAll

  useEffect(() => {
    document.title = 'インフラ基礎課題4 - vi & シェルスクリプト'
  }, [])

  useEffect(() => {
    if (!isProgressApiAvailable() || typeof window === 'undefined') return
    const name = username.trim().toLowerCase()
    if (!name || name === 'admin') return
    let cancelled = false
    const load = async () => {
      const snap = await fetchMyProgress(name)
      if (cancelled) return
      const resolved = snap ?? EMPTY_SNAPSHOT
      setSnapshot(resolved)
      const viSteps = Array.isArray(resolved.infra4ViDoneSteps) ? resolved.infra4ViDoneSteps : []
      const shellQs = Array.isArray(resolved.infra4ShellDoneQuestions) ? resolved.infra4ShellDoneQuestions : []
      const viState: Record<number, boolean> = {}
      VI_STEPS.forEach((s) => {
        viState[s.step] = viSteps.includes(s.step)
      })
      const shellState: Record<number, boolean> = {}
      SHELL_QUESTIONS.forEach((q) => {
        shellState[q.q] = shellQs.includes(q.q)
      })
      setViDone(viState)
      setShellDone(shellState)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [username])

  const applyUpdate = useCallback(
    async (updater: (prev: TraineeProgressSnapshot) => TraineeProgressSnapshot) => {
      if (!isProgressApiAvailable() || typeof window === 'undefined') return
      const name = username.trim().toLowerCase()
      if (!name || name === 'admin') return
      if (!snapshot) return
      const next = updater({ ...snapshot })
      setSnapshot(next)
      void postProgress(name, next)
    },
    [username, snapshot],
  )

  const markViDone = useCallback(
    (step: number) => {
      setViDone((prev) => ({ ...prev, [step]: true }))
      void applyUpdate((snap) => {
        const current = Array.isArray(snap.infra4ViDoneSteps) ? snap.infra4ViDoneSteps : []
        const set = new Set(current)
        set.add(step)
        return { ...snap, infra4ViDoneSteps: Array.from(set).sort((a, b) => a - b) }
      })
    },
    [applyUpdate],
  )

  const markShellDone = useCallback(
    (q: number) => {
      setShellDone((prev) => ({ ...prev, [q]: true }))
      void applyUpdate((snap) => {
        const current = Array.isArray(snap.infra4ShellDoneQuestions) ? snap.infra4ShellDoneQuestions : []
        const set = new Set(current)
        set.add(q)
        return { ...snap, infra4ShellDoneQuestions: Array.from(set).sort((a, b) => a - b) }
      })
    },
    [applyUpdate],
  )

  const scoreVi = useCallback(
    async (step: number) => {
      const answer = (viAnswers[step] ?? '').trim()
      if (!answer) return
      const def = VI_STEPS.find((s) => s.step === step)
      if (!def) return

      setViScores((prev) => ({ ...prev, [step]: { status: 'scoring' } }))
      try {
        const result = await scoreAnswerV2({
          question: `vi演習 Step ${step}: ${def.label}\n\n【やること】${def.task}\n【貼り付け指示】${def.verify}`,
          scoringCriteria: def.expected,
          answer,
        })
        setViScores((prev) => ({
          ...prev,
          [step]: { status: 'done', rating: result.rating, comment: result.comment, advice: result.advice },
        }))
        if (result.rating === 'pass') {
          markViDone(step)
        }
      } catch {
        setViScores((prev) => ({
          ...prev,
          [step]: { status: 'error', error: 'AIが混雑しています。少し待ってから再試行してください。' },
        }))
      }
    },
    [viAnswers, markViDone],
  )

  const scoreShell = useCallback(
    async (q: number) => {
      const answer = (shellAnswers[q] ?? '').trim()
      if (!answer) return
      const def = SHELL_QUESTIONS.find((s) => s.q === q)
      if (!def) return

      setShellScores((prev) => ({ ...prev, [q]: { status: 'scoring' } }))
      try {
        const result = await scoreAnswerV2({
          question: `シェルスクリプト演習 Q${q}: ${def.title}\n\n【やること】${def.task}\n【貼り付け指示】${def.verify}`,
          scoringCriteria: def.expected,
          answer,
        })
        setShellScores((prev) => ({
          ...prev,
          [q]: { status: 'done', rating: result.rating, comment: result.comment, advice: result.advice },
        }))
        if (result.rating === 'pass') {
          markShellDone(q)
        }
      } catch {
        setShellScores((prev) => ({
          ...prev,
          [q]: { status: 'error', error: 'AIが混雑しています。少し待ってから再試行してください。' },
        }))
      }
    },
    [shellAnswers, markShellDone],
  )

  const handleSuspend = async () => {
    if (isSaving) return
    setIsSaving(true)
    setSaveError(null)
    const name = username.trim().toLowerCase()
    if (name && name !== 'admin' && isProgressApiAvailable()) {
      const base = snapshot ?? EMPTY_SNAPSHOT
      const viSteps = VI_STEPS.filter((s) => viDone[s.step]).map((s) => s.step)
      const shellQs = SHELL_QUESTIONS.filter((q) => shellDone[q.q]).map((q) => q.q)
      const ok = await postProgress(name, {
        ...base,
        infra4ViDoneSteps: viSteps,
        infra4ShellDoneQuestions: shellQs,
        updatedAt: new Date().toISOString(),
      })
      if (!ok) {
        setSaveError('保存に失敗しました')
        setIsSaving(false)
        return
      }
    }
    setIsSaving(false)
    window.location.hash = '#/'
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <p className="text-xs text-slate-500">課題4 · 実践演習</p>
          <h1 className="text-xl font-bold text-slate-800">vi & シェルスクリプト演習</h1>
        </div>
        <header className="flex items-center justify-between">
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => { void handleSuspend() }}
              disabled={isSaving}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? '保存中...' : '中断して保存'}
            </button>
            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
          </div>
        </header>

        {/* ステータス */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">ステータス</p>
          <p className="mt-2 text-sm">
            4-1: {viDoneCount}/{VI_STEPS.length} 問完了 / 4-2: {shellDoneCount}/{SHELL_QUESTIONS.length} 問完了
          </p>
        </section>

        {/* EC2実機演習の説明 */}
        <section className="rounded-2xl border border-teal-200 bg-teal-50 p-4 shadow-soft-card">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-teal-700">EC2 実機演習</p>
          <div className="mt-2 space-y-1 text-[12px] text-teal-900">
            <p>この課題はEC2インスタンスにSSH接続して実機で操作します。</p>
            <ol className="mt-2 list-decimal pl-4 space-y-1 text-[11px] text-teal-800">
              <li>EC2にSSH接続する（接続情報はダッシュボードを確認）</li>
              <li>各ステップの指示に従い、実機でコマンドを実行する</li>
              <li>指定された結果（cat, ls, 実行結果など）をテキストエリアに貼り付ける</li>
              <li>「AIに確認してもらう」ボタンでAIが検証し、合格なら自動で済になる</li>
            </ol>
          </div>
        </section>

        {/* 4-1: vi */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
          <div className="mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">4-1</p>
            <h2 className="mt-1 text-sm font-semibold text-slate-800">vi操作マスター（{VI_STEPS.length}問）</h2>
          </div>
          <div className="space-y-3">
            {VI_STEPS.map((s) => {
              const score = viScores[s.step]
              const done = viDone[s.step]
              return (
                <div key={s.step} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-semibold text-slate-800">
                      Step {s.step}. {s.label}
                    </p>
                    {done && (
                      <span className="shrink-0 rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
                        済
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-600">{s.task}</p>
                  <p className="mt-1 text-[11px] font-medium text-slate-700">{s.verify}</p>

                  {!done && (
                    <>
                      <textarea
                        value={viAnswers[s.step] ?? ''}
                        onChange={(e) => setViAnswers((prev) => ({ ...prev, [s.step]: e.target.value }))}
                        rows={5}
                        className="mt-2 w-full resize-y rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-[12px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        placeholder="ここに実行結果を貼り付けてください"
                        spellCheck={false}
                      />
                      <button
                        type="button"
                        onClick={() => { void scoreVi(s.step) }}
                        disabled={score?.status === 'scoring' || !(viAnswers[s.step] ?? '').trim()}
                        className="mt-2 rounded-lg bg-teal-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {score?.status === 'scoring' ? 'AI検証中...' : 'AIに確認してもらう'}
                      </button>
                    </>
                  )}

                  {score?.status === 'done' && score.rating && (
                    <div className={`mt-2 rounded-lg border p-2.5 ${RATING_STYLES[score.rating].bg}`}>
                      <p className="text-[12px] font-semibold">
                        {RATING_STYLES[score.rating].icon} {RATING_STYLES[score.rating].label}
                      </p>
                      {score.comment && <p className="mt-1 text-[11px] text-slate-700">{score.comment}</p>}
                      {score.advice && <p className="mt-1 text-[11px] text-slate-500">{score.advice}</p>}
                    </div>
                  )}
                  {score?.status === 'error' && (
                    <p className="mt-2 text-[11px] text-red-600">{score.error}</p>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* 4-2: shell */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">4-2</p>
              <h2 className="mt-1 text-sm font-semibold text-slate-800">シェルスクリプト演習（{SHELL_QUESTIONS.length}問）</h2>
            </div>
            {!shellUnlocked && !isKiraTest && (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700 border border-amber-200">
                4-1 を全問クリアするとアンロック
              </span>
            )}
          </div>
          <div className={shellUnlocked ? 'space-y-3' : 'space-y-3 pointer-events-none select-none opacity-60'}>
            {SHELL_QUESTIONS.map((q) => {
              const score = shellScores[q.q]
              const done = shellDone[q.q]
              return (
                <div key={q.q} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-semibold text-slate-800">
                      Q{q.q}. {q.title}
                    </p>
                    {done && (
                      <span className="shrink-0 rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
                        済
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-600">{q.task}</p>
                  <p className="mt-1 text-[11px] font-medium text-slate-700">{q.verify}</p>

                  {!done && (
                    <>
                      <textarea
                        value={shellAnswers[q.q] ?? ''}
                        onChange={(e) => setShellAnswers((prev) => ({ ...prev, [q.q]: e.target.value }))}
                        rows={5}
                        className="mt-2 w-full resize-y rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-[12px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        placeholder="ここにスクリプト内容と実行結果を貼り付けてください"
                        spellCheck={false}
                      />
                      <button
                        type="button"
                        onClick={() => { void scoreShell(q.q) }}
                        disabled={score?.status === 'scoring' || !(shellAnswers[q.q] ?? '').trim()}
                        className="mt-2 rounded-lg bg-teal-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {score?.status === 'scoring' ? 'AI検証中...' : 'AIに確認してもらう'}
                      </button>
                    </>
                  )}

                  {score?.status === 'done' && score.rating && (
                    <div className={`mt-2 rounded-lg border p-2.5 ${RATING_STYLES[score.rating].bg}`}>
                      <p className="text-[12px] font-semibold">
                        {RATING_STYLES[score.rating].icon} {RATING_STYLES[score.rating].label}
                      </p>
                      {score.comment && <p className="mt-1 text-[11px] text-slate-700">{score.comment}</p>}
                      {score.advice && <p className="mt-1 text-[11px] text-slate-500">{score.advice}</p>}
                    </div>
                  )}
                  {score?.status === 'error' && (
                    <p className="mt-2 text-[11px] text-red-600">{score.error}</p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
