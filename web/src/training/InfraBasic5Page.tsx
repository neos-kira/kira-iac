import { useEffect, useState, useCallback } from 'react'
import { getCurrentUsername } from '../auth'
import {
  WEB_PARAMS, DB_PARAMS,
  BUILD_QUESTIONS, TROUBLE_QUESTIONS, SECURITY_QUESTIONS,
  PHASE_CLEARED_KEYS,
} from './InfraBasic5Data'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'
import { fetchMyProgress, postProgress, isProgressApiAvailable, scoreAnswerV2 } from '../progressApi'
import { getProgressKey } from './trainingWbsData'

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
  pass: { bg: 'bg-emerald-50 border-emerald-200', icon: '\u2705', label: '\u5408\u683c' },
  partial: { bg: 'bg-amber-50 border-amber-200', icon: '\ud83d\udd36', label: '\u90e8\u5206\u7684\u306b\u6b63\u3057\u3044' },
  fail: { bg: 'bg-rose-50 border-rose-200', icon: '\u274c', label: '\u4e0d\u5408\u683c' },
}

export function InfraBasic5Page() {
  const username = getCurrentUsername()
  const [snapshot, setSnapshot] = useState<TraineeProgressSnapshot | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // フェーズ完了状態
  const [phaseDone, setPhaseDone] = useState<Record<number, boolean>>({})

  // 5-1: パラメーターシート
  const [paramValues, setParamValues] = useState<Record<string, string>>({})
  const [paramScore, setParamScore] = useState<ScoreState>({ status: 'idle' })

  // 5-2: 手順書
  const [webProcedure, setWebProcedure] = useState('')
  const [dbProcedure, setDbProcedure] = useState('')
  const [procedureScore, setProcedureScore] = useState<ScoreState>({ status: 'idle' })

  // 5-3: サーバー構築実践
  const [buildAnswers, setBuildAnswers] = useState<Record<number, string>>({})
  const [buildScores, setBuildScores] = useState<Record<number, ScoreState>>({})
  const [buildDone, setBuildDone] = useState<Record<number, boolean>>({})

  // 5-4: トラブルシューティング
  const [troubleAnswers, setTroubleAnswers] = useState<Record<number, string>>({})
  const [troubleScores, setTroubleScores] = useState<Record<number, ScoreState>>({})
  const [troubleDone, setTroubleDone] = useState<Record<number, boolean>>({})

  // 5-5: セキュリティチェック
  const [secAnswers, setSecAnswers] = useState<Record<number, string>>({})
  const [secScores, setSecScores] = useState<Record<number, ScoreState>>({})
  const [secDone, setSecDone] = useState<Record<number, boolean>>({})

  // アコーディオン開閉
  const [openPhase, setOpenPhase] = useState<number>(1)

  useEffect(() => {
    document.title = 'インフラ基礎課題5 - サーバー構築'
  }, [])

  // DynamoDBから進捗をロード
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

      // 完了フェーズを復元
      const phases: Record<number, boolean> = {}
      const donePhases = Array.isArray(resolved.infra5PhaseDone) ? resolved.infra5PhaseDone : []
      for (let i = 1; i <= 5; i++) phases[i] = donePhases.includes(i)
      setPhaseDone(phases)

      // 5-3
      const bd = Array.isArray(resolved.infra5BuildDone) ? resolved.infra5BuildDone : []
      const bs: Record<number, boolean> = {}
      BUILD_QUESTIONS.forEach((q) => { bs[q.q] = bd.includes(q.q) })
      setBuildDone(bs)

      // 5-4
      const td = Array.isArray(resolved.infra5TroubleDone) ? resolved.infra5TroubleDone : []
      const ts: Record<number, boolean> = {}
      TROUBLE_QUESTIONS.forEach((q) => { ts[q.q] = td.includes(q.q) })
      setTroubleDone(ts)

      // 5-5
      const sd = Array.isArray(resolved.infra5SecDone) ? resolved.infra5SecDone : []
      const ss: Record<number, boolean> = {}
      SECURITY_QUESTIONS.forEach((q) => { ss[q.q] = sd.includes(q.q) })
      setSecDone(ss)

      // 最初の未完了フェーズを開く
      for (let i = 1; i <= 5; i++) {
        if (!donePhases.includes(i)) { setOpenPhase(i); break }
      }
    }
    void load()
    return () => { cancelled = true }
  }, [username])

  const applyUpdate = useCallback(
    async (updater: (prev: TraineeProgressSnapshot) => TraineeProgressSnapshot) => {
      if (!isProgressApiAvailable() || typeof window === 'undefined') return
      const name = username.trim().toLowerCase()
      if (!name || name === 'admin' || !snapshot) return
      const next = updater({ ...snapshot })
      setSnapshot(next)
      void postProgress(name, next)
    },
    [username, snapshot],
  )

  const markPhaseDone = useCallback(
    (phase: number) => {
      setPhaseDone((prev) => ({ ...prev, [phase]: true }))
      // localStorage にクリアキーを書き込み（WBS進捗検出用）
      const clearedKey = PHASE_CLEARED_KEYS[phase - 1]
      if (clearedKey && typeof window !== 'undefined') {
        window.localStorage.setItem(getProgressKey(clearedKey), 'true')
      }
      void applyUpdate((snap) => {
        const current = Array.isArray(snap.infra5PhaseDone) ? snap.infra5PhaseDone : []
        const set = new Set(current)
        set.add(phase)
        return { ...snap, infra5PhaseDone: Array.from(set).sort((a, b) => a - b) }
      })
    },
    [applyUpdate],
  )

  // --- 5-1: パラメーターシート採点 ---
  const scoreParams = useCallback(async () => {
    const allParams = [...WEB_PARAMS, ...DB_PARAMS]
    const filled = allParams.every((p) => (paramValues[p.id] ?? '').trim())
    if (!filled) return

    const summary = allParams.map((p) => `${p.label}: ${paramValues[p.id]}`).join('\n')
    setParamScore({ status: 'scoring' })
    try {
      const result = await scoreAnswerV2({
        question: 'WebサーバーとDBサーバーの構築パラメーターシートをレビューしてください。\n\n' + summary,
        scoringCriteria: 'IPアドレスがプライベートIP範囲であること。ポート番号が適切であること（Web:80/443, DB:3306等）。OSが指定されていること。DB名・ユーザー名が設定されていること。パスワードが空でないこと。全項目が埋まっていること。',
        answer: summary,
      })
      setParamScore({ status: 'done', rating: result.rating, comment: result.comment, advice: result.advice })
      if (result.rating === 'pass') markPhaseDone(1)
    } catch {
      setParamScore({ status: 'error', error: 'AIが混雑しています。少し待ってから再試行してください。' })
    }
  }, [paramValues, markPhaseDone])

  // --- 5-2: 手順書採点 ---
  const scoreProcedure = useCallback(async () => {
    if (!webProcedure.trim() || !dbProcedure.trim()) return
    setProcedureScore({ status: 'scoring' })
    try {
      const result = await scoreAnswerV2({
        question: 'Webサーバー構築手順とDBサーバー構築手順をレビューしてください。\n\n【Webサーバー構築手順】\n' + webProcedure + '\n\n【DBサーバー構築手順】\n' + dbProcedure,
        scoringCriteria: '手順として成立していること。パッケージのインストール、起動、設定、確認の流れが含まれていること。Webサーバー（Apache/Nginx）とDBサーバー（MySQL/MariaDB）の構築手順が書かれていること。順序が論理的であること。',
        answer: '【Webサーバー】\n' + webProcedure + '\n\n【DBサーバー】\n' + dbProcedure,
      })
      setProcedureScore({ status: 'done', rating: result.rating, comment: result.comment, advice: result.advice })
      if (result.rating === 'pass') markPhaseDone(2)
    } catch {
      setProcedureScore({ status: 'error', error: 'AIが混雑しています。少し待ってから再試行してください。' })
    }
  }, [webProcedure, dbProcedure, markPhaseDone])

  // --- 5-3: サーバー構築実践 ---
  const scoreBuild = useCallback(async (q: number) => {
    const answer = (buildAnswers[q] ?? '').trim()
    if (!answer) return
    const def = BUILD_QUESTIONS.find((d) => d.q === q)
    if (!def) return
    setBuildScores((prev) => ({ ...prev, [q]: { status: 'scoring' } }))
    try {
      const result = await scoreAnswerV2({
        question: `サーバー構築実践 Q${q}: ${def.title}\n\n【やること】${def.task}\n【貼り付け指示】${def.verify}`,
        scoringCriteria: def.expected,
        answer,
      })
      setBuildScores((prev) => ({ ...prev, [q]: { status: 'done', rating: result.rating, comment: result.comment, advice: result.advice } }))
      if (result.rating === 'pass') {
        setBuildDone((prev) => ({ ...prev, [q]: true }))
        void applyUpdate((snap) => {
          const current = Array.isArray(snap.infra5BuildDone) ? snap.infra5BuildDone : []
          const set = new Set(current); set.add(q)
          return { ...snap, infra5BuildDone: Array.from(set).sort((a, b) => a - b) }
        })
      }
    } catch {
      setBuildScores((prev) => ({ ...prev, [q]: { status: 'error', error: 'AIが混雑しています。少し待ってから再試行してください。' } }))
    }
  }, [buildAnswers, applyUpdate])

  // 5-3 全問クリアで自動フェーズ完了
  useEffect(() => {
    const allDone = BUILD_QUESTIONS.every((q) => buildDone[q.q])
    if (allDone && !phaseDone[3]) markPhaseDone(3)
  }, [buildDone, phaseDone, markPhaseDone])

  // --- 5-4: トラブルシューティング ---
  const scoreTrouble = useCallback(async (q: number) => {
    const answer = (troubleAnswers[q] ?? '').trim()
    if (!answer) return
    const def = TROUBLE_QUESTIONS.find((d) => d.q === q)
    if (!def) return
    setTroubleScores((prev) => ({ ...prev, [q]: { status: 'scoring' } }))
    try {
      const result = await scoreAnswerV2({
        question: `トラブルシューティング Q${q}: ${def.title}\n\n【状況】${def.scenario}\n\n【ログ】\n${def.log}\n\n【指示】${def.verify}`,
        scoringCriteria: def.expected,
        answer,
      })
      setTroubleScores((prev) => ({ ...prev, [q]: { status: 'done', rating: result.rating, comment: result.comment, advice: result.advice } }))
      if (result.rating === 'pass') {
        setTroubleDone((prev) => ({ ...prev, [q]: true }))
        void applyUpdate((snap) => {
          const current = Array.isArray(snap.infra5TroubleDone) ? snap.infra5TroubleDone : []
          const set = new Set(current); set.add(q)
          return { ...snap, infra5TroubleDone: Array.from(set).sort((a, b) => a - b) }
        })
      }
    } catch {
      setTroubleScores((prev) => ({ ...prev, [q]: { status: 'error', error: 'AIが混雑しています。少し待ってから再試行してください。' } }))
    }
  }, [troubleAnswers, applyUpdate])

  // 5-4 全問クリアで自動フェーズ完了
  useEffect(() => {
    const allDone = TROUBLE_QUESTIONS.every((q) => troubleDone[q.q])
    if (allDone && !phaseDone[4]) markPhaseDone(4)
  }, [troubleDone, phaseDone, markPhaseDone])

  // --- 5-5: セキュリティチェック ---
  const scoreSec = useCallback(async (q: number) => {
    const answer = (secAnswers[q] ?? '').trim()
    if (!answer) return
    const def = SECURITY_QUESTIONS.find((d) => d.q === q)
    if (!def) return
    setSecScores((prev) => ({ ...prev, [q]: { status: 'scoring' } }))
    try {
      const result = await scoreAnswerV2({
        question: `セキュリティチェック Q${q}: ${def.title}\n\n【やること】${def.task}\n【貼り付け指示】${def.verify}`,
        scoringCriteria: def.expected,
        answer,
      })
      setSecScores((prev) => ({ ...prev, [q]: { status: 'done', rating: result.rating, comment: result.comment, advice: result.advice } }))
      if (result.rating === 'pass') {
        setSecDone((prev) => ({ ...prev, [q]: true }))
        void applyUpdate((snap) => {
          const current = Array.isArray(snap.infra5SecDone) ? snap.infra5SecDone : []
          const set = new Set(current); set.add(q)
          return { ...snap, infra5SecDone: Array.from(set).sort((a, b) => a - b) }
        })
      }
    } catch {
      setSecScores((prev) => ({ ...prev, [q]: { status: 'error', error: 'AIが混雑しています。少し待ってから再試行してください。' } }))
    }
  }, [secAnswers, applyUpdate])

  // 5-5 全問クリアで自動フェーズ完了
  useEffect(() => {
    const allDone = SECURITY_QUESTIONS.every((q) => secDone[q.q])
    if (allDone && !phaseDone[5]) markPhaseDone(5)
  }, [secDone, phaseDone, markPhaseDone])

  // 中断して保存
  const handleSuspend = async () => {
    if (isSaving) return
    setIsSaving(true)
    setSaveError(null)
    const name = username.trim().toLowerCase()
    if (name && name !== 'admin' && isProgressApiAvailable() && snapshot) {
      const ok = await postProgress(name, { ...snapshot, updatedAt: new Date().toISOString() })
      if (!ok) { setSaveError('保存に失敗しました'); setIsSaving(false); return }
    }
    setIsSaving(false)
    window.location.hash = '#/'
  }

  // フェーズヘッダー
  const PhaseHeader = ({ phase, label, count }: { phase: number; label: string; count?: string }) => {
    const done = phaseDone[phase]
    const unlocked = phase === 1 || phaseDone[phase - 1]
    const isOpen = openPhase === phase
    return (
      <button
        type="button"
        onClick={() => unlocked && setOpenPhase(isOpen ? 0 : phase)}
        disabled={!unlocked}
        className={`w-full flex items-center justify-between px-4 py-3 text-left rounded-xl border ${
          done ? 'border-emerald-200 bg-emerald-50' : unlocked ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
        }`}
      >
        <div className="flex items-center gap-2">
          {done && <span className="text-emerald-600 text-sm">✅</span>}
          <div>
            <p className="text-[12px] font-semibold text-slate-800">{label}</p>
            {count && <p className="text-[10px] text-slate-500">{count}</p>}
          </div>
        </div>
        {unlocked && (
          <span className="text-[11px] text-slate-400">{isOpen ? '▲' : '▼'}</span>
        )}
        {!unlocked && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
            前フェーズをクリアするとアンロック
          </span>
        )}
      </button>
    )
  }

  // 採点結果表示
  const ScoreResult = ({ score }: { score: ScoreState }) => (
    <>
      {score.status === 'done' && score.rating && (
        <div className={`mt-2 rounded-lg border p-2.5 ${RATING_STYLES[score.rating].bg}`}>
          <p className="text-[12px] font-semibold">
            {RATING_STYLES[score.rating].icon} {RATING_STYLES[score.rating].label}
          </p>
          {score.comment && <p className="mt-1 text-[11px] text-slate-700">{score.comment}</p>}
          {score.advice && <p className="mt-1 text-[11px] text-slate-500">{score.advice}</p>}
        </div>
      )}
      {score.status === 'error' && (
        <p className="mt-2 text-[11px] text-red-600">{score.error}</p>
      )}
    </>
  )

  const buildDoneCount = BUILD_QUESTIONS.filter((q) => buildDone[q.q]).length
  const troubleDoneCount = TROUBLE_QUESTIONS.filter((q) => troubleDone[q.q]).length
  const secDoneCount = SECURITY_QUESTIONS.filter((q) => secDone[q.q]).length

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <p className="text-xs text-slate-500">課題5 · 実践演習</p>
          <h1 className="text-xl font-bold text-slate-800">サーバー構築</h1>
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

        {/* 説明カード */}
        <section className="rounded-2xl border border-teal-200 bg-teal-50 p-4 shadow-soft-card">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-teal-700">EC2 サーバー構築演習</p>
          <div className="mt-2 space-y-1 text-[12px] text-teal-900">
            <p>この課題では実際にEC2サーバーを2台構築します。</p>
            <p>パラメーターシートと手順書を自分で作り、</p>
            <p>その通りに構築・トラブル対応まで行います。</p>
          </div>
        </section>

        {/* ===== 5-1: パラメーターシート ===== */}
        <section className="space-y-2">
          <PhaseHeader phase={1} label="5-1 パラメーターシート作成" />
          {openPhase === 1 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card space-y-4">
              {phaseDone[1] ? (
                <p className="text-[12px] text-emerald-700 font-semibold">✅ パラメーターシートのレビューが完了しました。</p>
              ) : (
                <>
                  <div>
                    <p className="text-[12px] font-semibold text-slate-800 mb-2">Webサーバー</p>
                    {WEB_PARAMS.map((p) => (
                      <div key={p.id} className="mb-2">
                        <label className="text-[11px] text-slate-600">{p.label}</label>
                        <input
                          type={p.type}
                          value={paramValues[p.id] ?? ''}
                          onChange={(e) => setParamValues((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder={p.placeholder}
                          className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-slate-800 mb-2">DBサーバー</p>
                    {DB_PARAMS.map((p) => (
                      <div key={p.id} className="mb-2">
                        <label className="text-[11px] text-slate-600">{p.label}</label>
                        <input
                          type={p.type}
                          value={paramValues[p.id] ?? ''}
                          onChange={(e) => setParamValues((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder={p.placeholder}
                          className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => { void scoreParams() }}
                    disabled={paramScore.status === 'scoring' || ![...WEB_PARAMS, ...DB_PARAMS].every((p) => (paramValues[p.id] ?? '').trim())}
                    className="rounded-lg bg-teal-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {paramScore.status === 'scoring' ? 'AIレビュー中...' : 'AIにレビューしてもらう'}
                  </button>
                  <ScoreResult score={paramScore} />
                </>
              )}
            </div>
          )}
        </section>

        {/* ===== 5-2: 手順書作成 ===== */}
        <section className="space-y-2">
          <PhaseHeader phase={2} label="5-2 手順書作成" />
          {openPhase === 2 && (phaseDone[1] || true) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card space-y-4">
              {phaseDone[2] ? (
                <p className="text-[12px] text-emerald-700 font-semibold">✅ 手順書のレビューが完了しました。</p>
              ) : (
                <>
                  <div>
                    <p className="text-[12px] font-semibold text-slate-800 mb-1">Webサーバー構築手順を自分の言葉で書いてください</p>
                    <textarea
                      value={webProcedure}
                      onChange={(e) => setWebProcedure(e.target.value)}
                      rows={8}
                      className="w-full resize-y rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      placeholder="例: 1. SSHでEC2に接続する&#10;2. sudo dnf install httpd -y&#10;3. sudo systemctl start httpd&#10;..."
                      spellCheck={false}
                    />
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-slate-800 mb-1">DBサーバー構築手順を自分の言葉で書いてください</p>
                    <textarea
                      value={dbProcedure}
                      onChange={(e) => setDbProcedure(e.target.value)}
                      rows={8}
                      className="w-full resize-y rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      placeholder="例: 1. SSHでEC2に接続する&#10;2. sudo dnf install mysql-server -y&#10;3. sudo systemctl start mysqld&#10;..."
                      spellCheck={false}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => { void scoreProcedure() }}
                    disabled={procedureScore.status === 'scoring' || !webProcedure.trim() || !dbProcedure.trim()}
                    className="rounded-lg bg-teal-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {procedureScore.status === 'scoring' ? 'AIレビュー中...' : 'AIにレビューしてもらう'}
                  </button>
                  <ScoreResult score={procedureScore} />
                </>
              )}
            </div>
          )}
        </section>

        {/* ===== 5-3: サーバー構築実践 ===== */}
        <section className="space-y-2">
          <PhaseHeader phase={3} label="5-3 サーバー構築実践" count={`${buildDoneCount}/${BUILD_QUESTIONS.length}問完了`} />
          {openPhase === 3 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card space-y-3">
              {BUILD_QUESTIONS.map((q) => {
                const score = buildScores[q.q]
                const done = buildDone[q.q]
                return (
                  <div key={q.q} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12px] font-semibold text-slate-800">Q{q.q}. {q.title}</p>
                      {done && (
                        <span className="shrink-0 rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">済</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-600">{q.task}</p>
                    <p className="mt-1 text-[11px] font-medium text-slate-700">{q.verify}</p>
                    {!done && (
                      <>
                        <textarea
                          value={buildAnswers[q.q] ?? ''}
                          onChange={(e) => setBuildAnswers((prev) => ({ ...prev, [q.q]: e.target.value }))}
                          rows={5}
                          className="mt-2 w-full resize-y rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-[12px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                          placeholder="ここに実行結果を貼り付けてください"
                          spellCheck={false}
                        />
                        <button
                          type="button"
                          onClick={() => { void scoreBuild(q.q) }}
                          disabled={score?.status === 'scoring' || !(buildAnswers[q.q] ?? '').trim()}
                          className="mt-2 rounded-lg bg-teal-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {score?.status === 'scoring' ? 'AI検証中...' : 'AIに確認してもらう'}
                        </button>
                      </>
                    )}
                    {score && <ScoreResult score={score} />}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ===== 5-4: トラブルシューティング ===== */}
        <section className="space-y-2">
          <PhaseHeader phase={4} label="5-4 トラブルシューティング" count={`${troubleDoneCount}/${TROUBLE_QUESTIONS.length}問完了`} />
          {openPhase === 4 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card space-y-3">
              {TROUBLE_QUESTIONS.map((q) => {
                const score = troubleScores[q.q]
                const done = troubleDone[q.q]
                return (
                  <div key={q.q} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12px] font-semibold text-slate-800">Q{q.q}. {q.title}</p>
                      {done && (
                        <span className="shrink-0 rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">済</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-600">{q.scenario}</p>
                    <pre className="mt-2 rounded-lg bg-slate-900 text-slate-200 p-3 text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap">{q.log}</pre>
                    {!done && (
                      <>
                        <textarea
                          value={troubleAnswers[q.q] ?? ''}
                          onChange={(e) => setTroubleAnswers((prev) => ({ ...prev, [q.q]: e.target.value }))}
                          rows={5}
                          className="mt-2 w-full resize-y rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                          placeholder="原因と対処法を記述してください"
                          spellCheck={false}
                        />
                        <button
                          type="button"
                          onClick={() => { void scoreTrouble(q.q) }}
                          disabled={score?.status === 'scoring' || !(troubleAnswers[q.q] ?? '').trim()}
                          className="mt-2 rounded-lg bg-teal-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {score?.status === 'scoring' ? 'AI検証中...' : 'AIに確認してもらう'}
                        </button>
                      </>
                    )}
                    {score && <ScoreResult score={score} />}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ===== 5-5: セキュリティチェック ===== */}
        <section className="space-y-2">
          <PhaseHeader phase={5} label="5-5 セキュリティチェック" count={`${secDoneCount}/${SECURITY_QUESTIONS.length}問完了`} />
          {openPhase === 5 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card space-y-3">
              {SECURITY_QUESTIONS.map((q) => {
                const score = secScores[q.q]
                const done = secDone[q.q]
                return (
                  <div key={q.q} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12px] font-semibold text-slate-800">Q{q.q}. {q.title}</p>
                      {done && (
                        <span className="shrink-0 rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">済</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-600">{q.task}</p>
                    {!done && (
                      <>
                        <textarea
                          value={secAnswers[q.q] ?? ''}
                          onChange={(e) => setSecAnswers((prev) => ({ ...prev, [q.q]: e.target.value }))}
                          rows={5}
                          className="mt-2 w-full resize-y rounded-md border border-slate-300 bg-white px-2 py-1.5 font-mono text-[12px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                          placeholder="ここに実行結果を貼り付けてください"
                          spellCheck={false}
                        />
                        <button
                          type="button"
                          onClick={() => { void scoreSec(q.q) }}
                          disabled={score?.status === 'scoring' || !(secAnswers[q.q] ?? '').trim()}
                          className="mt-2 rounded-lg bg-teal-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {score?.status === 'scoring' ? 'AI検証中...' : 'AIに確認してもらう'}
                        </button>
                      </>
                    )}
                    {score && <ScoreResult score={score} />}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
