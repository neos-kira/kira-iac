import { useEffect, useState, useCallback } from 'react'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
import { getProgressKey } from './trainingWbsData'
import {
  INFRA_BASIC_3_2_CLEARED_KEY,
  INFRA_BASIC_3_2_DEFAULT_STATE,
  INFRA_BASIC_3_2_STATE_KEY,
  saveInfraBasic32State,
} from './infraBasic3Data'
import type { InfraBasic32Answers } from './infraBasic3Data'
import { getCurrentDisplayName } from '../auth'
import { fetchMyProgress, postProgress, isProgressApiAvailable, scoreAnswerV2 } from '../progressApi'
import type { ScoreResultV2 } from '../progressApi'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'

const EMPTY_SNAPSHOT: TraineeProgressSnapshot = {
  introConfirmed: false, introAt: null, wbsPercent: 0,
  chapterProgress: [], currentDay: 0, delayedIds: [], updatedAt: '', pins: [],
}

type QuestionId = keyof InfraBasic32Answers

type QuestionDef = {
  id: QuestionId
  title: string
  question: string
  scoringCriteria: string
}

const QUESTIONS: QuestionDef[] = [
  {
    id: 'q1',
    title: 'OSの役割',
    question:
      'OSはアプリケーションとハードウェアの間で何をしている存在か、「CPUとメモリの管理」という観点から自分の言葉で説明してください。',
    scoringCriteria:
      'OS・仮想化・クラウドの概念理解確認テスト。OSがCPUのスケジューリング（プロセスへの時間配分）やメモリの割り当て・保護を行い、アプリケーションがハードウェアを直接操作せずに済むよう仲介・抽象化していることを自分の言葉で説明できているか評価してください。丸暗記の定義文ではなく概念を理解した説明になっているかを重視してください。',
  },
  {
    id: 'q2',
    title: 'CPU負荷とメモリ不足の違い',
    question:
      'CPUの使用率が100%に張り付いている場合と、メモリが不足している場合では、それぞれどのような症状がシステムに現れますか？違いを説明してください。',
    scoringCriteria:
      'OS・仮想化・クラウドの概念理解確認テスト。CPU高負荷時の症状（処理遅延・レスポンス低下・プロセスのキュー待ち等）とメモリ不足時の症状（スワップ発生・OOM Killer・アプリケーションクラッシュ等）を区別して説明できているか評価してください。両者の違いが明確に述べられていることを重視してください。',
  },
  {
    id: 'q3',
    title: 'ハイパーバイザーの種類',
    question:
      'ホスト型ハイパーバイザーとベアメタル型ハイパーバイザーの違いを説明し、なぜ商用環境ではベアメタル型が使われるのか理由を答えてください。',
    scoringCriteria:
      'OS・仮想化・クラウドの概念理解確認テスト。ホスト型（ホストOS上で動作）とベアメタル型（ハードウェア上で直接動作）の構造の違いを説明し、商用環境でベアメタル型が選ばれる理由（オーバーヘッドが少ない・性能が高い・安定性等）を述べられているか評価してください。',
  },
  {
    id: 'q4',
    title: '仮想マシンと物理サーバーの違い',
    question:
      '仮想マシン（VM）は物理サーバーと何が根本的に違いますか？「リソースの共有」という観点から説明してください。',
    scoringCriteria:
      'OS・仮想化・クラウドの概念理解確認テスト。VMが物理ハードウェアのリソース（CPU・メモリ・ストレージ等）を論理的に分割・共有して利用する仕組みであること、1台の物理サーバー上に複数のVMが共存できること、リソースの分離と共有の概念を説明できているか評価してください。',
  },
  {
    id: 'q5',
    title: 'IaaS・PaaS・SaaSの違い',
    question:
      'IaaS・PaaS・SaaSの違いを、「利用者がどこまで管理するか」という観点から説明してください。',
    scoringCriteria:
      'OS・仮想化・クラウドの概念理解確認テスト。IaaS（インフラのみ提供、OS以上は利用者管理）、PaaS（ミドルウェアまで提供、アプリのみ利用者管理）、SaaS（すべて提供済み、利用者は使うだけ）という管理範囲の違いを正しく説明できているか評価してください。',
  },
  {
    id: 'q6',
    title: '責任共有モデル',
    question:
      'AWSのEC2を使う場合、OSのセキュリティパッチ適用はAWSと利用者のどちらの責任ですか？責任共有モデルの観点から理由も含めて答えてください。',
    scoringCriteria:
      'OS・仮想化・クラウドの概念理解確認テスト。EC2（IaaS）ではOSのセキュリティパッチ適用は利用者の責任であること、AWSは物理インフラ・ハイパーバイザー層の管理を担当し、OS以上は利用者が管理するという責任共有モデルの線引きを正しく説明できているか評価してください。',
  },
  {
    id: 'q7',
    title: 'AWSが選ばれる理由',
    question:
      'なぜ国内のITインフラ案件ではAWSが多く採用されているのか、AzureやGCPと比較しながら説明してください。',
    scoringCriteria:
      'OS・仮想化・クラウドの概念理解確認テスト。AWSの強み（サービスの豊富さ・早期参入による実績・情報量・東京リージョンの充実等）を述べた上で、Azure（Microsoft製品との親和性・AD連携）やGCP（データ分析・コンテナ基盤）と比較し、国内でAWSが選ばれる理由を説明できているか評価してください。',
  },
  {
    id: 'q8',
    title: 'クラウドのメリット',
    question:
      'クラウドを使うと「サーバーを買わなくていい」以外にどのようなメリットがありますか？運用コスト・スケーラビリティの観点から説明してください。',
    scoringCriteria:
      'OS・仮想化・クラウドの概念理解確認テスト。初期投資不要以外のメリットとして、運用コスト面（従量課金・人件費削減・運用負荷軽減等）やスケーラビリティ面（需要に応じた拡張・縮小・オートスケーリング等）を具体的に説明できているか評価してください。',
  },
]

type Rating = ScoreResultV2['rating']

type ScoringStatus = 'idle' | 'scoring' | 'done' | 'error'

type QuestionState = {
  status: ScoringStatus
  rating: Rating | null
  comment: string
  advice: string
  error: string
}

const DEFAULT_Q_STATE: QuestionState = {
  status: 'idle',
  rating: null,
  comment: '',
  advice: '',
  error: '',
}

const RATING_CONFIG: Record<Rating, {
  bg: string
  borderLeft: string
  label: string
  emoji: string
  textColor: string
  adviceColor: string
}> = {
  pass: {
    bg: '#f0fdf4',
    borderLeft: '#16a34a',
    label: '理解できています',
    emoji: '\u2705',
    textColor: '#166534',
    adviceColor: '#4ade80',
  },
  partial: {
    bg: '#fffbeb',
    borderLeft: '#d97706',
    label: 'もう少しです',
    emoji: '\ud83d\udd36',
    textColor: '#92400e',
    adviceColor: '#b45309',
  },
  fail: {
    bg: '#fef2f2',
    borderLeft: '#dc2626',
    label: '再挑戦してください',
    emoji: '\u274c',
    textColor: '#991b1b',
    adviceColor: '#b91c1c',
  },
}

export function InfraBasic32Page() {
  const navigate = useSafeNavigate()
  const stateKey = getProgressKey(INFRA_BASIC_3_2_STATE_KEY)
  const clearedKey = getProgressKey(INFRA_BASIC_3_2_CLEARED_KEY)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [state, setState] = useState(INFRA_BASIC_3_2_DEFAULT_STATE)
  const [serverSnapshot, setServerSnapshot] = useState<TraineeProgressSnapshot | null>(null)
  const [qStates, setQStates] = useState<Record<QuestionId, QuestionState>>({
    q1: { ...DEFAULT_Q_STATE },
    q2: { ...DEFAULT_Q_STATE },
    q3: { ...DEFAULT_Q_STATE },
    q4: { ...DEFAULT_Q_STATE },
    q5: { ...DEFAULT_Q_STATE },
    q6: { ...DEFAULT_Q_STATE },
    q7: { ...DEFAULT_Q_STATE },
    q8: { ...DEFAULT_Q_STATE },
  })

  useEffect(() => {
    document.title = 'インフラ基礎課題3-2 OS・仮想化・クラウド理解度チェック'
  }, [])

  useEffect(() => {
    const load = async () => {
      const username = getCurrentDisplayName().trim().toLowerCase()
      if (!username || false) {
        setIsLoading(false)
        return
      }
      const snap = await fetchMyProgress(username)
      if (snap) {
        setServerSnapshot(snap)
        if (snap.infra32Answers && Object.keys(snap.infra32Answers).length > 0) {
          setState((prev) => ({
            ...prev,
            answers: { ...prev.answers, ...snap.infra32Answers },
          }))
        }
      }
      setIsLoading(false)
    }
    void load()
  }, [])

  const updateAnswer = (id: QuestionId, value: string) => {
    setState((prev) => {
      const next = {
        ...prev,
        answers: { ...prev.answers, [id]: value },
      }
      saveInfraBasic32State(next, stateKey)
      return next
    })
  }

  const syncToDynamo = useCallback(
    async (answers: InfraBasic32Answers) => {
      const username = getCurrentDisplayName().trim().toLowerCase()
      if (!username || false || !isProgressApiAvailable()) return
      const base = serverSnapshot ?? EMPTY_SNAPSHOT
      await postProgress(username, {
        ...base,
        infra32Answers: answers,
        updatedAt: new Date().toISOString(),
      })
    },
    [serverSnapshot],
  )

  const scoreOne = useCallback(
    async (q: QuestionDef) => {
      const answer = state.answers[q.id].trim()
      if (!answer) return

      setQStates((prev) => ({
        ...prev,
        [q.id]: { ...DEFAULT_Q_STATE, status: 'scoring' },
      }))

      try {
        const result = await scoreAnswerV2({
          question: q.question,
          scoringCriteria: q.scoringCriteria,
          answer,
        })
        setQStates((prev) => ({
          ...prev,
          [q.id]: {
            status: 'done',
            rating: result.rating,
            comment: result.comment,
            advice: result.advice,
            error: '',
          },
        }))

        setState((prev) => {
          const next = {
            ...prev,
            results: {
              ...prev.results,
              [q.id]: { checked: true, pass: result.rating === 'pass', feedback: result.comment },
            },
          }
          saveInfraBasic32State(next, stateKey)
          return next
        })
      } catch {
        setQStates((prev) => ({
          ...prev,
          [q.id]: {
            ...prev[q.id],
            status: 'error',
            error: 'AIが混雑しています。少し待ってから再試行してください。',
          },
        }))
      }
    },
    [state.answers, stateKey],
  )

  const handleScoreAll = async () => {
    const targets = QUESTIONS.filter((q) => state.answers[q.id].trim())
    await Promise.allSettled(targets.map((q) => scoreOne(q)))
    await syncToDynamo(state.answers)

    const allPass = QUESTIONS.every((q) => {
      const r = state.results[q.id]
      return r?.checked && r?.pass
    })
    if (allPass && typeof window !== 'undefined') {
      window.localStorage.setItem(clearedKey, 'true')
    }
  }

  const handleScoreOne = async (q: QuestionDef) => {
    await scoreOne(q)
    await syncToDynamo(state.answers)
  }

  const handleSuspend = async () => {
    if (isSaving) return
    setIsSaving(true)
    setSaveError(null)
    const username = getCurrentDisplayName().trim().toLowerCase()
    if (username && isProgressApiAvailable()) {
      const base = serverSnapshot ?? EMPTY_SNAPSHOT
      const answeredCount = Object.values(state.answers).filter((v) => v && v.trim()).length
      const ok = await postProgress(username, {
        ...base,
        infra32Answers: state.answers,
        lastActive: {
          moduleId: 'infra-basic-3-2',
          label: `課題3-2 · 理解度チェック ${answeredCount}/${QUESTIONS.length}問`,
          path: '/training/infra-basic-3-2',
          savedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      })
      if (!ok) {
        setSaveError('保存に失敗しました')
        setIsSaving(false)
        return
      }
    }
    setIsSaving(false)
    navigate('/')
  }

  const resetAll = () => {
    setState(INFRA_BASIC_3_2_DEFAULT_STATE)
    setQStates({
      q1: { ...DEFAULT_Q_STATE },
      q2: { ...DEFAULT_Q_STATE },
      q3: { ...DEFAULT_Q_STATE },
      q4: { ...DEFAULT_Q_STATE },
      q5: { ...DEFAULT_Q_STATE },
      q6: { ...DEFAULT_Q_STATE },
      q7: { ...DEFAULT_Q_STATE },
      q8: { ...DEFAULT_Q_STATE },
    })
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(stateKey)
      window.localStorage.removeItem(clearedKey)
    }
  }

  const passCount = QUESTIONS.filter((q) => qStates[q.id].status === 'done' && qStates[q.id].rating === 'pass').length

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* パンくず・タイトル */}
        <button type="button" onClick={() => navigate('/training/infra-basic-3-top')} className="inline-flex items-center gap-1 text-sm text-sky-700 hover:text-sky-800">
          ← 課題一覧に戻る
        </button>
        <div>
          <p className="text-xs text-slate-500">課題3-2 · 理解度チェック</p>
          <h1 className="text-xl font-bold text-slate-800">OS・仮想化・クラウド 記述式チェック</h1>
        </div>

        {/* 中断ボタン */}
        <div className="flex justify-end">
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

        {/* 問題カード */}
        {QUESTIONS.map((q, idx) => {
          const qs = qStates[q.id]
          const config = qs.rating ? RATING_CONFIG[qs.rating] : null

          return (
            <div
              key={q.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft-card space-y-3"
            >
              <p className="font-semibold text-slate-800">
                {idx + 1}. {q.title}
              </p>
              <p className="text-sm text-slate-500">{q.question}</p>
              <textarea
                value={state.answers[q.id]}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40"
                placeholder="ここに回答を入力してください"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { void handleScoreOne(q) }}
                  disabled={!state.answers[q.id].trim() || qs.status === 'scoring'}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  この問題を採点する
                </button>
              </div>

              {/* 採点中 */}
              {qs.status === 'scoring' && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  採点中...
                </div>
              )}

              {/* 採点結果 */}
              {qs.status === 'done' && config && (
                <div
                  className="rounded-xl p-4 space-y-2"
                  style={{
                    backgroundColor: config.bg,
                    borderLeft: `4px solid ${config.borderLeft}`,
                  }}
                >
                  <p className="text-heading md:text-heading-pc" style={{ fontWeight: 'bold', color: config.textColor }}>
                    {config.emoji} {config.label}
                  </p>
                  <p className="text-button md:text-button-pc" style={{ color: config.textColor }}>
                    {qs.comment}
                  </p>
                  <p className="text-body md:text-body-pc" style={{ color: config.adviceColor, fontStyle: 'italic' }}>
                    {qs.advice}
                  </p>
                </div>
              )}

              {/* エラー */}
              {qs.status === 'error' && (
                <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: '#f9fafb' }}>
                  <p className="text-button md:text-button-pc" style={{ color: '#6b7280' }}>{qs.error}</p>
                  <button
                    type="button"
                    onClick={() => { void handleScoreOne(q) }}
                    className="rounded-lg bg-sky-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-sky-700"
                  >
                    再試行
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {/* ページ下部アクション */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => { void handleScoreAll() }}
            className="w-full rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white hover:bg-sky-700"
          >
            全問採点する
          </button>
          <button
            type="button"
            onClick={resetAll}
            className="w-full rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            入力内容をすべてリセット
          </button>
          <p className="text-center text-sm text-slate-500">
            {passCount} / {QUESTIONS.length} 問 \u2705 合格
          </p>
        </div>
      </div>
    </div>
  )
}
