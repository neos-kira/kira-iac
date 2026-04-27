import { useEffect, useState, useCallback, useRef } from 'react'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
import * as XLSX from 'xlsx'
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
  const navigate = useSafeNavigate()
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
    document.title = 'Ubuntu サーバー構築'
  }, [])

  useEffect(() => {
    const handler = () => { void handleSuspend() }
    window.addEventListener('nic:save-and-leave', handler)
    return () => window.removeEventListener('nic:save-and-leave', handler)
  })

  useEffect(() => {
    const load = async () => {
      const username = getCurrentDisplayName().trim().toLowerCase()
      if (!username || false) { setIsLoading(false); return }
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
      if (!username || false || !isProgressApiAvailable()) return
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
    if (username && isProgressApiAvailable()) {
      const base = serverSnapshot ?? EMPTY_SNAPSHOT
      const ok = await postProgress(username, {
        ...base,
        infra5Checkboxes: checkboxes,
        infra5SectionDone: sectionDone,
        infra5ReviewAnswers: reviewAnswers,
        lastActive: {
          moduleId: 'infra-basic-5',
          label: `課題5 · サーバー構築実践`,
          path: '/training/infra-basic-5',
          savedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      })
      if (!ok) { setSaveError('保存に失敗しました'); setIsSaving(false); return }
    }
    setIsSaving(false)
    navigate('/')
  }

  const handleReviewScore = useCallback(
    async (task: Infra5Task) => {
      const answer = (reviewAnswers[task.id] ?? '').trim()
      if (!answer) return
      setReviewStates((prev) => ({ ...prev, [task.id]: { status: 'scoring' } }))
      try {
        // 通常タスク: 実行結果をAIが検証（verifyCommand + successCriteria）
        // 理解度確認タスク: 手順書テキストをAIが採点（reviewCriteria）
        const question = task.isReview
          ? task.objective
          : `以下の確認コマンドの実行結果を検証してください。\n確認コマンド: ${task.verifyCommand ?? ''}\n`
        const criteria = task.isReview
          ? (task.reviewCriteria ?? task.objective)
          : (task.successCriteria ?? task.objective)

        const result = await scoreAnswerV2({ question, scoringCriteria: criteria, answer })
        setReviewStates((prev) => ({
          ...prev,
          [task.id]: { status: 'done', rating: result.rating, comment: result.comment, advice: result.advice },
        }))
        if (result.rating === 'pass') {
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
        <p className="text-sm text-slate-600">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* ヘッダー */}
        <div>
          <p className="text-label md:text-label-pc text-slate-600">課題5 · サーバー構築</p>
          <h1 className="text-display md:text-display-pc font-bold text-slate-800 tracking-tight">Ubuntu サーバー構築</h1>
        </div>

        {/* 進捗バー + 中断ボタン */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-label md:text-label-pc text-slate-600">進捗</span>
              <span className="text-label md:text-label-pc font-medium text-slate-700">{totalDone} / 40 ({progressPct}%)</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-sky-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
          {saveError && <p className="text-label md:text-label-pc text-red-600">{saveError}</p>}
        </div>

        {/* 概要 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">概要</p>
          <p className="mt-2 text-body md:text-body-pc text-slate-700">
            Ubuntu サーバーを実際に構築します。各セクションを順番に進め、すべてのタスクを完了してください。
          </p>
          <ul className="mt-2 space-y-1 text-label md:text-label-pc text-slate-600 list-disc list-inside">
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
            <p className="text-body md:text-body-pc font-semibold text-emerald-800">🎉 すべてのセクションが完了しました！</p>
            <p className="mt-2 text-body md:text-body-pc text-slate-700">
              Ubuntu サーバー構築の全課題を完了しました。お疲れ様でした。
            </p>
            <button
              type="button"
              onClick={() => { navigate('/') }}
              className="mt-4 rounded-lg bg-sky-600 px-4 py-2.5 text-button md:text-button-pc font-medium text-white hover:bg-sky-700"
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
          <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-sky-100 text-sky-700 text-label md:text-label-pc font-bold">
            {section.number}
          </span>
          <div className="min-w-0">
            <h2 className="text-heading md:text-heading-pc font-semibold text-slate-800 truncate tracking-tight">
              {section.title}
            </h2>
            <p className="text-label md:text-label-pc text-slate-400">
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
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-sky-500 hover:bg-sky-50"
            >
              セクション完了
            </button>
          )}
          <span className="text-slate-400 text-label md:text-label-pc">{isOpen ? '▲' : '▼'}</span>
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
  onReviewAnswerChange,
  onReviewScore,
}: {
  task: Infra5Task
  checked: boolean
  reviewAnswer: string
  reviewState: ReviewState
  onReviewAnswerChange: (v: string) => void
  onReviewScore: () => void
}) {
  const [showHint, setShowHint] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // ── 完了済み ──
  if (checked) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-2 text-left"
          onClick={() => setIsExpanded((v) => !v)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-emerald-600 text-body md:text-body-pc flex-shrink-0">✓</span>
            <span className="text-label md:text-label-pc font-medium text-emerald-800 truncate">
              <span className="text-[11px] text-emerald-500 mr-1">{task.number}</span>
              {task.title}
            </span>
            <span className="flex-shrink-0 rounded-full bg-emerald-200 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">完了</span>
          </div>
          <span className="text-emerald-500 text-[10px] flex-shrink-0 ml-2">{isExpanded ? '▲' : '▼'}</span>
        </button>
        {isExpanded && (
          <div className="px-3 pb-3 border-t border-emerald-200 pt-2 space-y-2">
            <p className="text-label md:text-label-pc text-slate-600">{task.objective}</p>
            {reviewAnswer && (
              <div>
                <p className="text-[11px] font-medium text-slate-600 mb-1">あなたの回答:</p>
                <textarea
                  value={reviewAnswer}
                  disabled
                  readOnly
                  rows={4}
                  className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-label md:text-label-pc text-slate-600 resize-none font-mono cursor-not-allowed opacity-75"
                />
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── 未完了 ──
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
      {/* タスクヘッダー */}
      <div>
        <p className="text-body md:text-body-pc font-medium text-slate-800 leading-snug">
          <span className="text-[11px] text-slate-400 mr-1">{task.number}</span>
          {task.isReview ? <span className="text-sky-700">{task.title}</span> : task.title}
        </p>
        <p className="mt-1 text-label md:text-label-pc text-slate-600">{task.objective}</p>
      </div>

      {/* ヒント（調べ方・考え方のみ） */}
      {task.hint && (
        <div>
          <button
            type="button"
            onClick={() => setShowHint((v) => !v)}
            className="text-[11px] text-sky-500 hover:text-sky-700 underline"
          >
            {showHint ? 'ヒントを隠す' : 'ヒントを見る（考え方）'}
          </button>
          {showHint && (
            <p className="mt-1 rounded-lg bg-sky-50 px-3 py-2 text-label md:text-label-pc text-sky-700">
              {task.hint}
            </p>
          )}
        </div>
      )}

      {/* 通常タスク: 確認コマンド + 実行結果貼り付け + AI検証 */}
      {!task.isReview && task.verifyCommand && (
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <p className="text-[11px] font-medium text-slate-600">
            以下のコマンドを実行し、結果を貼り付けてください：
          </p>
          <code className="block rounded-lg bg-slate-900 px-3 py-2 text-label md:text-label-pc text-emerald-400 font-mono select-all whitespace-pre-wrap">
            $ {task.verifyCommand}
          </code>
          <textarea
            value={reviewAnswer}
            onChange={(e) => onReviewAnswerChange(e.target.value)}
            placeholder="実行結果をここに貼り付けてください..."
            rows={4}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-label md:text-label-pc text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none font-mono"
          />
          <button
            type="button"
            onClick={onReviewScore}
            disabled={!reviewAnswer.trim() || reviewState.status === 'scoring'}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-label md:text-label-pc font-medium text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {reviewState.status === 'scoring' ? 'AI確認中...' : 'AIに提出する'}
          </button>
          <VerifyResult state={reviewState} isReview={false} />
        </div>
      )}

      {/* 理解度確認タスク: テンプレートDL → ファイルUL → AI採点 */}
      {task.isReview && (
        <ReviewUploadSection
          task={task}
          reviewAnswer={reviewAnswer}
          reviewState={reviewState}
          onReviewAnswerChange={onReviewAnswerChange}
          onReviewScore={onReviewScore}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────
// 検証・採点結果表示
// ─────────────────────────────────────

function VerifyResult({ state, isReview }: { state: ReviewState; isReview: boolean }) {
  if (state.status === 'idle') return null
  if (state.status === 'error') {
    return <p className="text-label md:text-label-pc text-red-600">{state.error ?? 'エラーが発生しました。再試行してください。'}</p>
  }
  if (state.status !== 'done' || !state.rating) return null

  return (
    <div className={`rounded-xl border p-3 ${RATING_STYLES[state.rating].bg}`}>
      <p className="text-label md:text-label-pc font-semibold">
        {RATING_STYLES[state.rating].icon} {RATING_STYLES[state.rating].label}
      </p>
      {state.comment && <p className="mt-1 text-label md:text-label-pc text-slate-700">{state.comment}</p>}
      {state.advice && <p className="mt-1 text-label md:text-label-pc text-slate-600">{state.advice}</p>}
      {state.rating === 'pass' && (
        <p className="mt-1 text-label md:text-label-pc text-emerald-700 font-medium">
          {isReview ? '✓ 合格です！完了になりました。' : '✓ 正しく完了しています！完了になりました。'}
        </p>
      )}
    </div>
  )
}

// ─── ReviewUploadSection ─────────────────────────────────────────────────────

function ReviewUploadSection({
  task,
  reviewAnswer,
  reviewState,
  onReviewAnswerChange,
  onReviewScore,
}: {
  task: Infra5Task
  reviewAnswer: string
  reviewState: ReviewState
  onReviewAnswerChange: (v: string) => void
  onReviewScore: () => void
}) {
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError(null)
    setUploadedFileName(file.name)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const texts: string[] = []
      wb.SheetNames.forEach((sheetName) => {
        const sheet = wb.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' })
        const lines = rows
          .map((row) => (row as string[]).map((c) => String(c ?? '')).join('\t'))
          .filter((l) => l.trim())
        if (lines.length > 0) {
          texts.push(`【シート: ${sheetName}】\n${lines.join('\n')}`)
        }
      })
      const extracted = texts.join('\n\n')
      onReviewAnswerChange(extracted || '（内容なし）')
    } catch {
      setParseError('Excelの読み取りに失敗しました。.xlsx/.xls 形式のファイルか確認してください。')
      setUploadedFileName(null)
    }
  }

  const templateUrl = task.templateFile ? `/templates/${task.templateFile}` : null

  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      {/* Step 1: ダウンロード */}
      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
        <p className="text-[11px] font-semibold text-slate-600 mb-2">① テンプレートをダウンロード</p>
        {templateUrl ? (
          <a
            href={templateUrl}
            download
            className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-label md:text-label-pc font-medium text-slate-700 hover:bg-slate-100"
          >
            <span>📥</span> テンプレートをダウンロード（Excel）
          </a>
        ) : (
          <p className="text-label md:text-label-pc text-slate-400">テンプレートファイルが設定されていません</p>
        )}
      </div>

      {/* Step 2: アップロード */}
      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
        <p className="text-[11px] font-semibold text-slate-600 mb-2">② 記入したExcelをアップロード</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
          id={`file-upload-${task.id}`}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          <span>📤</span>
          {uploadedFileName ? uploadedFileName : 'ファイルを選択...'}
        </button>
        {parseError && <p className="mt-1 text-label md:text-label-pc text-red-500">{parseError}</p>}
        {uploadedFileName && !parseError && (
          <p className="mt-1 text-[11px] text-emerald-600">✓ 読み込み完了: {uploadedFileName}</p>
        )}
      </div>

      {/* Step 3: AI採点 */}
      <div>
        <p className="text-[11px] font-semibold text-slate-600 mb-2">③ AIで採点する</p>
        <button
          type="button"
          onClick={onReviewScore}
          disabled={!reviewAnswer.trim() || reviewState.status === 'scoring'}
          className="rounded-lg bg-sky-600 px-3 py-1.5 text-label md:text-label-pc font-medium text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {reviewState.status === 'scoring' ? 'AI採点中...' : 'AIで採点する'}
        </button>
        {!reviewAnswer.trim() && (
          <p className="mt-1 text-[11px] text-slate-400">先にExcelファイルをアップロードしてください</p>
        )}
      </div>

      <VerifyResult state={reviewState} isReview={true} />
    </div>
  )
}
