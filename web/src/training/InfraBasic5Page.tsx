import { useEffect, useState, useCallback } from 'react'
import { getProgressKey } from './trainingWbsData'
import {
  INFRA5_CLEARED_KEY,
  INFRA5_SECTIONS,
  PHASE_CLEARED_KEYS,
  type Infra5Section,
  type Infra5Task,
} from './InfraBasic5Data'
import { fetchMyProgress, postProgress, isProgressApiAvailable, scoreAnswerV2 } from '../progressApi'
import { getCurrentDisplayName } from '../auth'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'

const EMPTY_SNAPSHOT: TraineeProgressSnapshot = {
  introConfirmed: false, introAt: null, wbsPercent: 0,
  chapterProgress: [], currentDay: 0, delayedIds: [], updatedAt: '', pins: [],
}

type Rating = 'pass' | 'partial' | 'fail'

type ReviewState = {
  status: 'idle' | 'scoring' | 'done' | 'error'
  rating?: Rating
  comment?: string
  advice?: string
  error?: string
}

const RATING_STYLES: Record<Rating, { bg: string; label: string; icon: string }> = {
  pass: { bg: 'bg-emerald-50 border-emerald-200', label: '合格', icon: '✅' },
  partial: { bg: 'bg-amber-50 border-amber-200', label: '部分的に正しい', icon: '🔶' },
  fail: { bg: 'bg-rose-50 border-rose-200', label: '不合格', icon: '❌' },
}

export function InfraBasic5Page() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [serverSnapshot, setServerSnapshot] = useState<TraineeProgressSnapshot | null>(null)
  const [checkboxes, setCheckboxes] = useState<boolean[]>(Array(40).fill(false))
  const [sectionDone, setSectionDone] = useState<Record<string, boolean>>({})
  const [reviewAnswers, setReviewAnswers] = useState<Record<string, string>>({})
  const [reviewStates, setReviewStates] = useState<Record<string, ReviewState>>({})
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ s1: true })

  useEffect(() => {
    document.title = 'インフラ基礎課題5 - サーバー構築'
  }, [])

  useEffect(() => {
    const load = async () => {
      const username = getCurrentDisplayName().trim().toLowerCase()
      if (!username || username === 'admin') { setIsLoading(false); return }
      const snap = await fetchMyProgress(username)
      if (snap) {
        setServerSnapshot(snap)
        const boxes = Array.isArray(snap.infra5Checkboxes) ? snap.infra5Checkboxes : Array(40).fill(false)
        // 配列長を40に正規化
        const normalized = Array(40).fill(false)
        boxes.forEach((v, i) => { if (i < 40) normalized[i] = !!v })
        setCheckboxes(normalized)
        setSectionDone(snap.infra5SectionDone ?? {})
        setReviewAnswers(snap.infra5ReviewAnswers ?? {})
        // 最初の未完了セクションを開く
        const done = snap.infra5SectionDone ?? {}
        let found = false
        const open: Record<string, boolean> = {}
        for (const sec of INFRA5_SECTIONS) {
          if (!done[sec.id] && !found) { open[sec.id] = true; found = true }
        }
        if (!found) open[INFRA5_SECTIONS[0].id] = true
        setOpenSections(open)
      }
      setIsLoading(false)
    }
    void load()
  }, [])

  const syncToServer = useCallback(
    async (
      nextCheckboxes: boolean[],
      nextSectionDone: Record<string, boolean>,
      nextReviewAnswers: Record<string, string>,
    ) => {
      const username = getCurrentDisplayName().trim().toLowerCase()
      if (!username || username === 'admin' || !isProgressApiAvailable()) return
      const base = serverSnapshot ?? EMPTY_SNAPSHOT
      const allDone = INFRA5_SECTIONS.every((s) => nextSectionDone[s.id])
      await postProgress(username, {
        ...base,
        infra5Checkboxes: nextCheckboxes,
        infra5SectionDone: nextSectionDone,
        infra5ReviewAnswers: nextReviewAnswers,
        updatedAt: new Date().toISOString(),
      })
      // localStorage のクリアキーを更新（WBS進捗連動）
      INFRA5_SECTIONS.forEach((sec, i) => {
        const key = getProgressKey(PHASE_CLEARED_KEYS[i])
        if (nextSectionDone[sec.id]) window.localStorage.setItem(key, 'true')
        else window.localStorage.removeItem(key)
      })
      const allKey = getProgressKey(INFRA5_CLEARED_KEY)
      if (allDone) window.localStorage.setItem(allKey, 'true')
      else window.localStorage.removeItem(allKey)
    },
    [serverSnapshot],
  )

  const toggleCheck = useCallback(
    async (index: number) => {
      const next = [...checkboxes]
      next[index] = !next[index]
      setCheckboxes(next)
      await syncToServer(next, sectionDone, reviewAnswers)
    },
    [checkboxes, sectionDone, reviewAnswers, syncToServer],
  )

  const toggleSectionDone = useCallback(
    async (sectionId: string) => {
      const next = { ...sectionDone, [sectionId]: !sectionDone[sectionId] }
      setSectionDone(next)
      await syncToServer(checkboxes, next, reviewAnswers)
    },
    [checkboxes, sectionDone, reviewAnswers, syncToServer],
  )

  const handleSuspend = async () => {
    if (isSaving) return
    setIsSaving(true)
    setSaveError(null)
    const username = getCurrentDisplayName().trim().toLowerCase()
    if (username && username !== 'admin' && isProgressApiAvailable()) {
      const base = serverSnapshot ?? EMPTY_SNAPSHOT
      const ok = await postProgress(username, {
        ...base,
        infra5Checkboxes: checkboxes,
        infra5SectionDone: sectionDone,
        infra5ReviewAnswers: reviewAnswers,
        updatedAt: new Date().toISOString(),
      })
      if (!ok) { setSaveError('保存に失敗しました'); setIsSaving(false); return }
    }
    setIsSaving(false)
    window.location.hash = '#/'
  }

  const handleReviewScore = useCallback(
    async (task: Infra5Task) => {
      const answer = (reviewAnswers[task.id] ?? '').trim()
      if (!answer) return
      setReviewStates((prev) => ({ ...prev, [task.id]: { status: 'scoring' } }))
      try {
        const result = await scoreAnswerV2({
          question: task.objective,
          scoringCriteria: task.reviewCriteria ?? task.objective,
          answer,
        })
        setReviewStates((prev) => ({
          ...prev,
          [task.id]: { status: 'done', rating: result.rating, comment: result.comment, advice: result.advice },
        }))
        if (result.rating === 'pass') {
          // 合格時: チェックボックスをオンにしてセクションを完了にする
          const nextCb = [...checkboxes]
          nextCb[task.index] = true
          setCheckboxes(nextCb)
          const sec = INFRA5_SECTIONS.find((s) => s.id === task.sectionId)!
          const allChecked = sec.tasks.every((t) => nextCb[t.index])
          const nextDone = allChecked ? { ...sectionDone, [task.sectionId]: true } : sectionDone
          if (allChecked) setSectionDone(nextDone)
          await syncToServer(nextCb, nextDone, reviewAnswers)
        }
      } catch (e) {
        setReviewStates((prev) => ({ ...prev, [task.id]: { status: 'error', error: String(e) } }))
      }
    },
    [reviewAnswers, checkboxes, sectionDone, syncToServer],
  )

  const totalDone = checkboxes.filter(Boolean).length
  const progressPct = Math.round((totalDone / 40) * 100)
  const allSectionsDone = INFRA5_SECTIONS.every((s) => sectionDone[s.id])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* ヘッダー */}
        <div>
          <p className="text-xs text-slate-500">課題5 · サーバー構築</p>
          <h1 className="text-xl font-bold text-slate-800">インフラ基礎課題5 - Rocky Linux サーバー構築</h1>
        </div>

        {/* 進捗バー + 中断ボタン */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">進捗</span>
              <span className="text-xs font-medium text-slate-700">{totalDone} / 40 ({progressPct}%)</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-indigo-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
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
        </div>

        {/* 概要 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">概要</p>
          <p className="mt-2 text-sm text-slate-700">
            Rocky Linux 8 サーバーを実際に構築します。各セクションを順番に進め、すべてのタスクを完了してください。
          </p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600 list-disc list-inside">
            <li>各タスクを完了したらチェックを入れてください</li>
            <li>【理解度確認】タスクは手順の内容を記述してAI採点を受けてください</li>
            <li>セクションの全タスクが完了したら「セクション完了」を押してください</li>
          </ul>
        </section>

        {/* セクション一覧 */}
        {INFRA5_SECTIONS.map((section, secIdx) => (
          <SectionBlock
            key={section.id}
            section={section}
            checkboxes={checkboxes}
            sectionDone={sectionDone[section.id] ?? false}
            reviewAnswers={reviewAnswers}
            reviewStates={reviewStates}
            isOpen={openSections[section.id] ?? false}
            onToggleOpen={() =>
              setOpenSections((prev) => ({ ...prev, [section.id]: !prev[section.id] }))
            }
            onToggleCheck={toggleCheck}
            onToggleSectionDone={() => { void toggleSectionDone(section.id) }}
            onReviewAnswerChange={(taskId, value) => {
              const next = { ...reviewAnswers, [taskId]: value }
              setReviewAnswers(next)
            }}
            onReviewScore={(task) => { void handleReviewScore(task) }}
            sectionIndex={secIdx}
          />
        ))}

        {/* 全完了メッセージ */}
        {allSectionsDone && (
          <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 shadow-soft-card">
            <p className="text-sm font-semibold text-emerald-800">🎉 すべてのセクションが完了しました！</p>
            <p className="mt-2 text-sm text-slate-700">
              Rocky Linux サーバー構築の全課題を完了しました。お疲れ様でした。
            </p>
            <button
              type="button"
              onClick={() => { window.location.hash = '#/' }}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              トップに戻る
            </button>
          </section>
        )}

      </div>
    </div>
  )
}

// ─────────────────────────────────────
// SectionBlock コンポーネント
// ─────────────────────────────────────

function SectionBlock({
  section,
  checkboxes,
  sectionDone,
  reviewAnswers,
  reviewStates,
  isOpen,
  onToggleOpen,
  onToggleCheck,
  onToggleSectionDone,
  onReviewAnswerChange,
  onReviewScore,
}: {
  section: Infra5Section
  checkboxes: boolean[]
  sectionDone: boolean
  reviewAnswers: Record<string, string>
  reviewStates: Record<string, ReviewState>
  isOpen: boolean
  onToggleOpen: () => void
  onToggleCheck: (index: number) => Promise<void>
  onToggleSectionDone: () => void
  onReviewAnswerChange: (taskId: string, value: string) => void
  onReviewScore: (task: Infra5Task) => void
  sectionIndex?: number
}) {
  const doneCount = section.tasks.filter((t) => checkboxes[t.index]).length

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-soft-card overflow-hidden">
      {/* セクションヘッダー */}
      <div
        className="flex items-center justify-between gap-2 p-4 cursor-pointer select-none hover:bg-slate-50"
        onClick={onToggleOpen}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
            {section.number}
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-800 truncate">
              {section.title}
            </h2>
            <p className="text-xs text-slate-400">
              {doneCount} / {section.tasks.length} 完了
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {sectionDone ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleSectionDone() }}
              className="cursor-pointer rounded-full border border-emerald-500/60 bg-emerald-600/20 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-600/30"
              title="クリックで未完了に戻す"
            >
              済
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleSectionDone() }}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-indigo-500 hover:bg-indigo-50"
            >
              セクション完了
            </button>
          )}
          <span className="text-slate-400 text-xs">{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* タスク一覧（アコーディオン） */}
      {isOpen && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-2 space-y-3">
          {section.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              checked={checkboxes[task.index] ?? false}
              reviewAnswer={reviewAnswers[task.id] ?? ''}
              reviewState={reviewStates[task.id] ?? { status: 'idle' }}
              onToggle={() => { void onToggleCheck(task.index) }}
              onReviewAnswerChange={(v) => onReviewAnswerChange(task.id, v)}
              onReviewScore={() => onReviewScore(task)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// ─────────────────────────────────────
// TaskRow コンポーネント
// ─────────────────────────────────────

function TaskRow({
  task,
  checked,
  reviewAnswer,
  reviewState,
  onToggle,
  onReviewAnswerChange,
  onReviewScore,
}: {
  task: Infra5Task
  checked: boolean
  reviewAnswer: string
  reviewState: ReviewState
  onToggle: () => void
  onReviewAnswerChange: (v: string) => void
  onReviewScore: () => void
}) {
  const [showHint, setShowHint] = useState(false)

  return (
    <div className={`rounded-xl border p-3 transition-colors ${checked ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}>
      {/* タスクヘッダー */}
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id={`task-${task.id}`}
          checked={checked}
          onChange={onToggle}
          className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600"
        />
        <div className="flex-1 min-w-0">
          <label
            htmlFor={`task-${task.id}`}
            className={`cursor-pointer text-sm font-medium leading-snug ${checked ? 'text-slate-400 line-through' : task.isReview ? 'text-indigo-700' : 'text-slate-800'}`}
          >
            <span className="text-[11px] text-slate-400 mr-1">{task.number}</span>
            {task.title}
          </label>
          {!checked && (
            <p className="mt-1 text-xs text-slate-500">{task.objective}</p>
          )}
        </div>
      </div>

      {/* ヒント */}
      {!checked && task.hint && (
        <div className="mt-2 ml-6">
          <button
            type="button"
            onClick={() => setShowHint((v) => !v)}
            className="text-[11px] text-indigo-500 hover:text-indigo-700 underline"
          >
            {showHint ? 'ヒントを隠す' : 'ヒントを見る'}
          </button>
          {showHint && (
            <p className="mt-1 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700 font-mono whitespace-pre-wrap">
              {task.hint}
            </p>
          )}
        </div>
      )}

      {/* 理解度確認: テキストエリア + AI採点 */}
      {task.isReview && !checked && (
        <div className="mt-3 ml-6 space-y-2">
          <textarea
            value={reviewAnswer}
            onChange={(e) => onReviewAnswerChange(e.target.value)}
            placeholder="実施した手順と内容を記述してください..."
            rows={4}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          />
          <button
            type="button"
            onClick={onReviewScore}
            disabled={!reviewAnswer.trim() || reviewState.status === 'scoring'}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {reviewState.status === 'scoring' ? 'AI採点中...' : 'AIに採点してもらう'}
          </button>
          {/* 採点結果 */}
          {reviewState.status === 'done' && reviewState.rating && (
            <div className={`rounded-xl border p-3 ${RATING_STYLES[reviewState.rating].bg}`}>
              <p className="text-xs font-semibold">
                {RATING_STYLES[reviewState.rating].icon} {RATING_STYLES[reviewState.rating].label}
              </p>
              {reviewState.comment && <p className="mt-1 text-xs text-slate-700">{reviewState.comment}</p>}
              {reviewState.advice && <p className="mt-1 text-xs text-slate-500">{reviewState.advice}</p>}
              {reviewState.rating === 'pass' && (
                <p className="mt-1 text-xs text-emerald-700 font-medium">チェックボックスが自動でオンになりました ✓</p>
              )}
            </div>
          )}
          {reviewState.status === 'error' && (
            <p className="text-xs text-red-600">{reviewState.error ?? 'エラーが発生しました'}</p>
          )}
        </div>
      )}
    </div>
  )
}
