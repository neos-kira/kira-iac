import { useEffect, useState, useRef } from 'react'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
import { setIntroConfirmed, setIntroConfirmedForUser, clearIntroForCurrentUser } from './introGate'
import { getCurrentDisplayName } from '../auth'
import { Confetti } from '../components/Confetti'
import { INTRO_RISK_QUESTIONS } from './introRiskData'
import type { MCQuestion, EssayQuestion } from './introRiskData'
import { setTrainingStartDateFromTask1Start, getTrainingStartDate } from './trainingWbsData'
import { fetchMyProgress, postProgress, isProgressApiAvailable, scoreAnswer } from '../progressApi'
import type { ScoreDetails } from '../progressApi'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'

// ── Step 1: 行動基準 ───────────────────────────────────────────────────────────

const CARD_ACCENTS = [
  { bg: 'bg-emerald-100', border: 'border-emerald-200', icon: 'bg-emerald-500' },
  { bg: 'bg-sky-50', border: 'border-sky-100', icon: 'bg-[#7dd3fc]' },
  { bg: 'bg-violet-100', border: 'border-violet-200', icon: 'bg-violet-500' },
  { bg: 'bg-amber-100', border: 'border-amber-200', icon: 'bg-amber-500' },
  { bg: 'bg-sky-50', border: 'border-sky-100', icon: 'bg-[#7dd3fc]' },
] as const

const STANDARDS: Array<{
  title: string
  body: string
  example: string
  icon: string
  codeExample: string | null
  exampleCorrect?: string
  exampleWrong?: string
}> = [
  {
    title: '正確な現状共有 (5W1H)',
    body: '5W1Hを意識し、チームの迅速な意思決定を支援する報告を徹底する。障害報告では次の要素を簡潔な箇条書きで示す。',
    example: '',
    icon: '🖥️',
    codeExample: null,
    exampleCorrect: '障害報告の例：いつ（発生日時）、どこで（サーバ/サービス名）、誰が（どのユーザ/担当）、何が（現象・エラー内容）、なぜ（想定原因）、どのように（再現手順・影響範囲）。再現手順や影響範囲を添える。',
    exampleWrong: '「なんか動かないです」「ちょっとエラーになりました」など曖昧な報告のみで、再現手順や影響範囲を書かない。',
  },
  {
    title: 'AIガバナンスと機密保持',
    body: '外部ツールの利用時は機密情報を適切に抽象化し、プロとして「情報の出し口」を制御する。機密情報を抽象化する具体例：IPアドレス（例: 192.168.1.1 → 192.168.X.X）や顧客名（例: 株式会社A → クライアントX）を特定できない形式に置換してから入力する。',
    example: '',
    icon: '🤖',
    codeExample: null,
    exampleCorrect: 'IPアドレス（例: 192.168.1.1 → 192.168.X.X）や顧客名（例: 株式会社A → クライアントX）を特定できない形式に置換してからAIに入力する。出力も社外にそのまま出さない。',
    exampleWrong: '顧客名・IPアドレス・実名・本番環境の情報をそのままAIに入力する。出力をそのまま社外に共有する。',
  },
  {
    title: '物理セキュリティの遵守',
    body: '常駐先でのID携行や離席時の画面ロックを習慣化し、組織の安全を守る。',
    example: '',
    icon: '🔒',
    codeExample: null,
    exampleCorrect: '離席時はWin+L（またはCmd+Ctrl+Q）で画面ロックし、入館証は肌身離さず携行する。',
    exampleWrong: '離席時にロックせず席を離れる。入館証をデスクに置いたままにする。',
  },
  {
    title: 'リスクの早期共有',
    body: '課題を一人で抱え込まず迅速にエスカレーションし、プロジェクトの停滞（リスク）を防ぐ。',
    example: '',
    icon: '🚩',
    codeExample: null,
    exampleCorrect: '納期に影響しそうな不具合は「〇日までに判断が必要」と期限を明示して報告し、上司・PMと対応方針を決める。',
    exampleWrong: '一人で抱え込んで締切直前まで報告しない。「なんとかなる」と報告を先送りする。',
  },
  {
    title: '事前準備の習慣 (バックアップ)',
    body: '設定変更前には必ずバックアップを取得し、不測の事態でも即時復旧可能な状態を維持する。設定変更前には必ず cp -p でタイムスタンプを維持したバックアップ（例: config.conf.org）を作成する実務慣習を守る。',
    example: '',
    icon: '💾',
    codeExample: '# 設定を変更する前に元の状態を保存（-p でタイムスタンプ維持）\ncp -p /etc/nginx/nginx.conf /etc/nginx/nginx.conf.org\ncp -p /etc/ssh/sshd_config /etc/ssh/sshd_config.org',
    exampleCorrect: '設定変更前には必ず cp -p でタイムスタンプを維持したバックアップ（例: config.conf.org）を作成する。変更後もロールバック手順をメモする。',
    exampleWrong: 'バックアップを取らずに本番の設定を直接編集する。変更前の状態を残さない。',
  },
]

// ── Step 2-4 ──────────────────────────────────────────────────────────────────

const STEP_SECTION: Record<number, string> = {
  3: 'AI利用時の機密保持',
  4: '物理セキュリティ',
  5: 'リスク共有と報告',
}

const STEP_LABELS = ['オリエンテーション', '行動基準確認', 'AI機密保持', '物理セキュリティ', 'リスク報告', '完了']

type ScoringResult = { pass: boolean; feedback: string; details?: ScoreDetails }

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

// ── プログレスバー ─────────────────────────────────────────────────────────────

function StepProgress({ current, onStepClick }: { current: number; onStepClick?: (stepNum: number) => void }) {
  return (
    <div className="flex items-center gap-1.5 mb-6" aria-label="進捗">
      {STEP_LABELS.map((label, i) => {
        const stepNum = i + 1
        const done = stepNum < current
        const active = stepNum === current
        return (
          <div key={i} className="flex items-center gap-1.5">
            <div
              title={label}
              onClick={onStepClick ? () => onStepClick(stepNum) : undefined}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold
                ${onStepClick ? 'cursor-pointer hover:opacity-75' : ''}
                ${done ? 'bg-emerald-500 text-white' : active ? 'text-white' : 'bg-slate-200 text-slate-500'}`}
              style={active ? { background: '#7dd3fc' } : undefined}
            >
              {done ? '✓' : stepNum}
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`h-0.5 w-5 shrink-0 ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── メインコンポーネント ───────────────────────────────────────────────────────

export function IntroPage() {
  const navigate = useSafeNavigate()
  const usernameAtMountRef = useRef<string | null>(null)

  // 現在表示するステップ（DynamoDBのintroStepが正）
  const [step, setStep] = useState<number>(1)
  const [sectionQIdx, setSectionQIdx] = useState(0)
  const [riskAnswers, setRiskAnswers] = useState<Record<string, string>>({})

  // 選択式問題の状態
  const [mcSelected, setMcSelected] = useState<number[]>([])
  const [mcResult, setMcResult] = useState<boolean | null>(null)

  // 記述式問題の状態
  const [currentInput, setCurrentInput] = useState('')
  const [currentResult, setCurrentResult] = useState<ScoringResult | null>(null)
  const [isScoring, setIsScoring] = useState(false)

  const [serverSnapshot, setServerSnapshot] = useState<TraineeProgressSnapshot | null>(null)
  // DynamoDB取得完了前はローディング表示（ユーザーが存在する場合のみ）
  const [isLoadingProgress, setIsLoadingProgress] = useState(true)
  // 今のセッションで初めてStep5に到達したか（コンフェッティ表示判定）
  const [freshCompletion, setFreshCompletion] = useState(false)
  // 中断保存ボタンの状態
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // クリア済みで再アクセス時の振り返り閲覧モード
  const [isReviewMode, setIsReviewMode] = useState(false)

  // ── マウント: DynamoDB復元 ────────────────────────────────────────────────
  useEffect(() => {
    document.title = 'はじめに'
    const username = getCurrentDisplayName().trim().toLowerCase()
    if (usernameAtMountRef.current === null) usernameAtMountRef.current = username

    if (!username || false) {
      // 未ログインはDynamoDB不使用、ステップ1から開始
      setIsLoadingProgress(false)
      return
    }

    fetchMyProgress(username).then(async (snap) => {
      // snapが存在しない、またはintroStepが未設定/0の場合は新規開始としてintroStep=1で初期化保存
      if (!snap || !snap.introStep) {
        const base = snap ?? EMPTY_SNAPSHOT
        const initialized = { ...base, introStep: 1, updatedAt: new Date().toISOString() }
        if (isProgressApiAvailable()) {
          await postProgress(username, initialized)
        }
        setServerSnapshot(initialized)
        setStep(1)
        setIsLoadingProgress(false)
        return
      }
      setServerSnapshot(snap)

      // DynamoDBが唯一の正: introStep===6 かつ introConfirmed のみ完了
      if (snap.introStep === 6 && snap.introConfirmed) {
        setIntroConfirmedForUser(username)
      } else {
        // introStep<5 の場合はlocalStorageをクリアして再開させる
        clearIntroForCurrentUser()
      }

      const savedAnswers = snap.introRiskAnswers ?? {}
      if (Object.keys(savedAnswers).length > 0) setRiskAnswers(savedAnswers)

      // introStep に応じてステップを復元（1〜6 すべて対応）
      const savedStep = snap.introStep
      const isReallyComplete = savedStep === 6 && snap.introConfirmed === true
      if (isReallyComplete) setIsReviewMode(true)
      const resolvedStep = (savedStep === 6 && !isReallyComplete) ? 1 : savedStep

      if (typeof resolvedStep === 'number' && resolvedStep >= 1 && resolvedStep <= 6) {
        setStep(resolvedStep)
        // steps 3-5: sectionQIdx を回答済み数から復元
        if (savedStep >= 3 && savedStep <= 5) {
          const secName = STEP_SECTION[savedStep] ?? ''
          const sqs = INTRO_RISK_QUESTIONS.filter((q) => q.section === secName)
          const answeredIds = new Set(Object.keys(savedAnswers))
          const answeredCount = sqs.filter((q) => answeredIds.has(q.id)).length
          setSectionQIdx(Math.min(answeredCount, Math.max(0, sqs.length - 1)))
        }
      }

      setIsLoadingProgress(false)
    })
  }, [])

  // ── セクション・現在問題の導出 ────────────────────────────────────────────
  const sectionName = STEP_SECTION[step] ?? ''
  const sectionQuestions = INTRO_RISK_QUESTIONS.filter((q) => q.section === sectionName)
  const currentQuestion = sectionQuestions[sectionQIdx] ?? null

  // 問題切替でリセット
  useEffect(() => {
    setMcSelected([])
    setMcResult(null)
    setCurrentInput('')
    setCurrentResult(null)
  }, [currentQuestion?.id])

  // ── 中断して保存（Step1〜4） ──────────────────────────────────────────────
  const handleSuspend = async () => {
    if (isSaving) return
    setIsSaving(true)
    setSaveError(null)
    const uname = getCurrentDisplayName().trim().toLowerCase()
    console.log('[中断保存] username:', uname)
    console.log('[中断保存] serverSnapshot:', serverSnapshot)
    if (uname && isProgressApiAvailable()) {
      const payload: TraineeProgressSnapshot = {
        ...EMPTY_SNAPSHOT,
        ...(serverSnapshot ?? {}),
        introStep: step,
        introConfirmed: step >= 6,
        introRiskAnswers: riskAnswers,
        updatedAt: new Date().toISOString(),
      }
      const token = window.localStorage.getItem('kira-session-token') || document.cookie
      console.log('[中断保存] session token exists:', !!window.localStorage.getItem('kira-session-token'))
      console.log('[中断保存] cookie:', document.cookie.slice(0, 200))
      console.log('[中断保存] token raw:', token?.slice(0, 30))
      const ok = await postProgress(uname, payload)
      console.log('[中断保存] postProgress結果:', ok)
      if (!ok) {
        setSaveError('保存に失敗しました')
        setIsSaving(false)
        return
      }
    }
    setIsSaving(false)
    navigate('/')
  }

  // ── Step 1（オリエンテーション）完了 ────────────────────────────────────
  const handleOrientationComplete = async () => {
    if (isScoring) return
    setIsScoring(true)
    try {
      const username = getCurrentDisplayName().trim().toLowerCase()
      if (username && isProgressApiAvailable()) {
        const base = serverSnapshot ?? EMPTY_SNAPSHOT
        await postProgress(username, {
          ...base,
          introStep: 2,
          updatedAt: new Date().toISOString(),
        })
      }
      setStep(2)
    } finally {
      setIsScoring(false)
    }
  }

  // ── Step 2（行動基準確認）完了 ────────────────────────────────────────────
  const handleStep2Complete = async () => {
    if (isScoring) return
    setIsScoring(true)
    try {
      const username = getCurrentDisplayName().trim().toLowerCase()
      if (username && isProgressApiAvailable()) {
        const base = serverSnapshot ?? EMPTY_SNAPSHOT
        await postProgress(username, {
          ...base,
          introStep: 3,
          introRiskAnswers: riskAnswers,
          updatedAt: new Date().toISOString(),
        })
      }
      setStep(3)
    } finally {
      setIsScoring(false)
    }
  }

  // ── 選択式: 選択トグル ────────────────────────────────────────────────────
  const handleMCSelect = (ci: number) => {
    if (mcResult !== null) return
    if (currentQuestion?.type === 'single') {
      setMcSelected([ci])
    } else {
      setMcSelected((prev) =>
        prev.includes(ci) ? prev.filter((i) => i !== ci) : [...prev, ci]
      )
    }
  }

  // ── 選択式: 答え合わせ ────────────────────────────────────────────────────
  const handleCheckMC = async () => {
    if (!currentQuestion || currentQuestion.type === 'essay') return
    const q = currentQuestion as MCQuestion
    const sortedSel = [...mcSelected].sort((a, b) => a - b)
    const sortedCorrect = [...q.correctIndices].sort((a, b) => a - b)
    const isPass =
      sortedSel.length === sortedCorrect.length &&
      sortedSel.every((v, i) => v === sortedCorrect[i])
    setMcResult(isPass)

    if (isPass) {
      const nextAnswers = { ...riskAnswers, [q.id]: 'PASS' }
      setRiskAnswers(nextAnswers)
      const username = getCurrentDisplayName().trim().toLowerCase()
      if (username && isProgressApiAvailable()) {
        const base = serverSnapshot ?? EMPTY_SNAPSHOT
        await postProgress(username, {
          ...base,
          introStep: step,
          introRiskAnswers: nextAnswers,
          updatedAt: new Date().toISOString(),
        })
      }
    }
  }

  // ── 記述式: Bedrock採点 ───────────────────────────────────────────────────
  const handleScore = async () => {
    if (!currentQuestion || currentQuestion.type !== 'essay' || !currentInput.trim() || isScoring) return
    const q = currentQuestion as EssayQuestion
    setIsScoring(true)
    setCurrentResult(null)
    try {
      const questionWithScenario = q.scenarioText
        ? `${q.prompt}\n\n【断片情報】\n${q.scenarioText}`
        : q.prompt
      const result = await scoreAnswer({
        question: questionWithScenario,
        scoringCriteria: q.scoringCriteria,
        answer: currentInput,
      })
      setCurrentResult(result)

      if (result.pass) {
        const nextAnswers = { ...riskAnswers, [q.id]: currentInput }
        setRiskAnswers(nextAnswers)
        const username = getCurrentDisplayName().trim().toLowerCase()
        if (username && isProgressApiAvailable()) {
          const base = serverSnapshot ?? EMPTY_SNAPSHOT
          await postProgress(username, {
            ...base,
            introStep: step,
            introRiskAnswers: nextAnswers,
            updatedAt: new Date().toISOString(),
          })
        }
      }
    } catch {
      setCurrentResult({ pass: false, feedback: '採点中にエラーが発生しました。ネットワークを確認してもう一度お試しください。' })
    } finally {
      setIsScoring(false)
    }
  }

  // ── リトライ ──────────────────────────────────────────────────────────────
  const handleRetry = () => {
    setMcSelected([])
    setMcResult(null)
    setCurrentResult(null)
    setCurrentInput('')
  }

  // ── 振り返りモード: ステッパークリックで自由にステップ切替 ──────────────
  const handleReviewStepClick = (targetStep: number) => {
    setStep(targetStep)
    setSectionQIdx(0)
    setMcSelected([])
    setMcResult(null)
    setCurrentInput('')
    setCurrentResult(null)
  }

  // ── 前のステップ / 前の問題へ（進捗データは変更しない） ──────────────────
  const handleBack = () => {
    setMcSelected([])
    setMcResult(null)
    setCurrentResult(null)
    setCurrentInput('')

    if (step === 2) {
      setStep(1)
      return
    }
    // steps 3-5: 同セクション内に前の問題があれば戻る、なければ前ステップへ
    if (sectionQIdx > 0) {
      setSectionQIdx((prev) => prev - 1)
    } else {
      const prevStep = step - 1
      if (prevStep === 2) {
        setStep(2)
      } else {
        const prevSectionName = STEP_SECTION[prevStep] ?? ''
        const prevSqs = INTRO_RISK_QUESTIONS.filter((q) => q.section === prevSectionName)
        setSectionQIdx(Math.max(0, prevSqs.length - 1))
        setStep(prevStep)
      }
    }
  }

  // ── 次の問題へ / セクション完了 ───────────────────────────────────────────
  const handleNext = async () => {
    if (isScoring) return
    setIsScoring(true)
    const isLastInSection = sectionQIdx + 1 >= sectionQuestions.length
    const nextStep = step + 1

    try {
      if (isLastInSection) {
        if (nextStep === 6) {
          // 全ステップ完了
          setTrainingStartDateFromTask1Start()
          const trainingStartDate = getTrainingStartDate() || null
          const introAt = new Date().toISOString()
          const who = usernameAtMountRef.current
          if (who && true) setIntroConfirmedForUser(who)
          else setIntroConfirmed()

          const username = getCurrentDisplayName().trim().toLowerCase()
          if (username && isProgressApiAvailable()) {
            const base = serverSnapshot ?? EMPTY_SNAPSHOT
            await postProgress(username, {
              ...base,
              introConfirmed: true,
              introAt,
              introStep: 6,
              introRiskAnswers: riskAnswers,
              trainingStartDate,
              updatedAt: new Date().toISOString(),
            })
          }
          setFreshCompletion(true)
        } else {
          // 次のセクション
          const username = getCurrentDisplayName().trim().toLowerCase()
          if (username && isProgressApiAvailable()) {
            const base = serverSnapshot ?? EMPTY_SNAPSHOT
            await postProgress(username, {
              ...base,
              introStep: nextStep,
              introRiskAnswers: riskAnswers,
              updatedAt: new Date().toISOString(),
            })
          }
          setSectionQIdx(0)
        }
        setStep(nextStep)
      } else {
        setSectionQIdx((prev) => prev + 1)
      }
    } finally {
      setIsScoring(false)
    }
  }

  // ── レイアウトヘルパー ────────────────────────────────────────────────────
  const topBar = (
    <div className="flex items-center justify-end mb-6">
      {!isReviewMode && step >= 1 && step <= 5 ? (
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => { void handleSuspend() }}
            disabled={isSaving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? '保存中...' : '中断して保存'}
          </button>
          {saveError && (
            <p className="text-xs text-red-600">{saveError}</p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50"
        >
          トップへ
        </button>
      )}
    </div>
  )

  const pageLayout = (children: React.ReactNode) => (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-6">
      <div className="mx-auto max-w-2xl">
        {topBar}
        {children}
      </div>
    </div>
  )

  const headerBlock = (
    <div className="mb-6">
      <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">SECTION · はじめに</span>
    </div>
  )

  // ── Render: ローディング ─────────────────────────────────────────────────
  const username = getCurrentDisplayName().trim().toLowerCase()
  if (isLoadingProgress && username) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-800 p-6 flex items-center justify-center">
        <p className="text-sm text-slate-500">読み込み中...</p>
      </div>
    )
  }

  // ── Render: Step 6 完了画面（初回完了: コンフェッティ付き） ──────────────
  if (step === 6 && freshCompletion) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-800 p-6">
        <Confetti />
        <div className="mx-auto max-w-2xl relative z-10">
          {topBar}
          {headerBlock}
          <StepProgress current={6} />
          <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-10 text-center">
            <p className="text-5xl mb-2" aria-hidden>🎉</p>
            <p className="text-2xl font-bold text-slate-800 mb-2">「はじめに」完了！</p>
            <p className="text-sm text-slate-600 mb-8">
              プロフェッショナルとしての行動基準とリスク管理を確認しました。
              <br />インフラ基礎課題1に進みましょう。
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-lg px-8 py-3.5 text-base font-semibold text-slate-900 bg-[#7dd3fc] hover:bg-[#38bdf8]"
            >
              研修を始める
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: Step 6 確認済みバナー（再アクセス時） ────────────────────────
  if (step === 6) {
    return pageLayout(
      <>
        {isReviewMode && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-700">
            ✓ 完了済み — 上の丸いボタンで各ステップの内容を見返せます
          </div>
        )}
        {headerBlock}
        <StepProgress current={6} onStepClick={isReviewMode ? handleReviewStepClick : undefined} />
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-6 space-y-3">
          <p className="text-base font-semibold text-emerald-700">✓ 確認済みです。</p>
          <p className="text-sm text-slate-600">インフラ基礎課題へアクセスできます。</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-lg bg-[#7dd3fc] px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-[#38bdf8]"
          >
            トップページへ →
          </button>
        </div>
      </>
    )
  }

  // ── Render: Step 1 オリエンテーション ────────────────────────────────────
  if (step === 1) {
    const SKILL_TAGS = ['サーバー構築', '障害対応', 'セキュリティ']
    const FLOW_STEPS = [
      { num: 1, label: '行動基準' },
      { num: 2, label: 'Linux' },
      { num: 3, label: 'Network' },
      { num: 4, label: 'vi/Shell' },
      { num: 5, label: '構築' },
    ]
    return pageLayout(
      <>
        {isReviewMode && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-700">
            ✓ 完了済み — 上の丸いボタンで各ステップの内容を見返せます
          </div>
        )}
        {headerBlock}
        <StepProgress current={1} onStepClick={isReviewMode ? handleReviewStepClick : undefined} />

        {/* ヒーローセクション */}
        <section
          className="rounded-xl p-6 mb-6"
          style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0369a1 100%)' }}
        >
          <h1 className="text-2xl font-bold text-white leading-tight">
            この研修が終わる頃には、<br />Linuxサーバーを構築できる
          </h1>
          <p className="mt-3 text-[15px] text-white/90">
            自分のペースで進められます
          </p>
        </section>

        {/* AI講師セクション */}
        <section className="rounded-xl bg-slate-100 p-4 mb-5 flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <rect x="5" y="4" width="14" height="12" rx="2" />
              <circle cx="9" cy="10" r="1.5" fill="currentColor" />
              <circle cx="15" cy="10" r="1.5" fill="currentColor" />
              <path strokeLinecap="round" d="M9 20v-4M15 20v-4M7 16h10" />
              <path strokeLinecap="round" d="M12 4V2M8 4V3M16 4V3" />
            </svg>
          </div>
          <div>
            <p className="text-[15px] font-semibold text-slate-800">AI講師がサポートします</p>
            <p className="mt-1 text-[13px] text-slate-600 leading-relaxed">
              つまずいたら、遠慮なく聞いてください。
            </p>
          </div>
        </section>

        {/* 身につくスキル */}
        <section className="rounded-xl bg-white border border-slate-200 shadow-sm p-5 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">身につくスキル</p>
          <div className="flex flex-wrap gap-2">
            {SKILL_TAGS.map((tag, i) => (
              <span
                key={tag}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium ${
                  i === 0 ? 'bg-sky-50 text-[#38bdf8]' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* 全体の流れ */}
        <section className="rounded-xl bg-white border border-slate-200 shadow-sm p-5 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">全体の流れ</p>
          <div className="flex items-start justify-between">
            {FLOW_STEPS.map((step, i) => (
              <div key={step.num} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                      step.num === 1 ? 'bg-[#7dd3fc] text-slate-900' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {step.num}
                  </div>
                  <span className="mt-1.5 text-[10px] text-slate-500 text-center whitespace-nowrap">{step.label}</span>
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <div className="w-4 sm:w-8 h-0.5 bg-slate-200 mx-0.5 mt-[18px] self-start" />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* はじめるボタン */}
        <div>
          <button
            type="button"
            onClick={handleOrientationComplete}
            disabled={isScoring || isReviewMode}
            className="w-full rounded-lg py-3.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#0ea5e9' }}
          >
            {isScoring ? '保存中...' : 'はじめる →'}
          </button>
        </div>
      </>
    )
  }

  // ── Render: Step 2 行動基準確認 ──────────────────────────────────────────
  if (step === 2) {
    return pageLayout(
      <>
        {isReviewMode && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-700">
            ✓ 完了済み — 上の丸いボタンで各ステップの内容を見返せます
          </div>
        )}
        {headerBlock}
        <StepProgress current={2} onStepClick={isReviewMode ? handleReviewStepClick : undefined} />

        <div className="flex items-center gap-3 mb-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-base" aria-hidden>🖥️</span>
          <h1 className="text-xl font-bold text-slate-800">プロフェッショナルの5つの行動基準</h1>
        </div>
        <p className="text-sm text-slate-600 mb-6">
          プロフェッショナルとして信頼を獲得するための『5つの行動基準』を確認し、次のステップの確認テストに進んでください。
        </p>

        <div className="space-y-4">
          {STANDARDS.map((s, i) => {
            const accent = CARD_ACCENTS[i]
            return (
              <div key={i} className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent.bg} text-base`} aria-hidden>
                      {s.icon}
                    </span>
                    <h2 className="text-base font-semibold text-slate-800">■{s.title}</h2>
                  </div>
                  {s.codeExample ? (
                    <pre className="rounded-lg bg-slate-800 text-slate-300 p-4 text-xs leading-relaxed font-mono overflow-x-auto mb-3">
                      {s.codeExample}
                    </pre>
                  ) : null}
                  <p className="text-sm text-slate-700">{s.body}</p>
                  {s.exampleCorrect != null && s.exampleWrong != null ? (
                    <div className="mt-3 space-y-2">
                      <p className="flex items-baseline gap-2 text-xs">
                        <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-700">正</span>
                        <span className="text-slate-600 border-l-2 border-emerald-200 pl-2">{s.exampleCorrect}</span>
                      </p>
                      <p className="flex items-baseline gap-2 text-xs">
                        <span className="shrink-0 rounded bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-700">誤</span>
                        <span className="text-slate-600 border-l-2 border-rose-200 pl-2">{s.exampleWrong}</span>
                      </p>
                    </div>
                  ) : s.example ? (
                    <p className="mt-2 text-xs text-slate-500 border-l-2 border-slate-200 pl-3">{s.example}</p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={isScoring || isReviewMode}
            className="rounded-lg border border-slate-200 px-5 py-3.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← 前へ
          </button>
          <button
            type="button"
            onClick={handleStep2Complete}
            disabled={isScoring || isReviewMode}
            className="flex-1 rounded-lg bg-[#7dd3fc] py-3.5 text-sm font-semibold text-slate-900 hover:bg-[#38bdf8] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isScoring ? '保存中...' : '確認しました・次へ →'}
          </button>
        </div>
      </>
    )
  }

  // ── Render: Step 2-4 問題 ─────────────────────────────────────────────────
  const isLastInSection = sectionQIdx + 1 >= sectionQuestions.length
  const isLastStep = step === 5
  const nextBtnLabel = isScoring ? '保存中...' : isLastInSection && isLastStep ? '完了' : isLastInSection ? '次のセクションへ →' : '次へ →'

  // 選択式問題
  if (currentQuestion && currentQuestion.type !== 'essay') {
    const q = currentQuestion as MCQuestion
    return pageLayout(
      <>
        {isReviewMode && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-700">
            ✓ 完了済み — 上の丸いボタンで各ステップの内容を見返せます
          </div>
        )}
        {headerBlock}
        <StepProgress current={step} onStepClick={isReviewMode ? handleReviewStepClick : undefined} />

        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-800">{sectionName}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{sectionQIdx + 1} / {sectionQuestions.length}問</p>
        </div>

        {/* 選択肢カード */}
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-5 space-y-4">
          <p className="text-sm font-semibold text-slate-800 leading-relaxed">{q.prompt}</p>
          <ul className="space-y-2">
            {q.choices.map((choice, ci) => {
              const isSelected = mcSelected.includes(ci)
              const isCorrectChoice = q.correctIndices.includes(ci)
              const showCorrect = mcResult === true && isCorrectChoice
              const showWrong = mcResult === false && isSelected && !isCorrectChoice
              const showMissed = false
              return (
                <li key={ci}>
                  <label
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                      mcResult === null ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      showCorrect && isSelected
                        ? 'border-emerald-300 bg-emerald-50'
                        : showWrong
                          ? 'border-red-300 bg-red-50'
                          : showMissed
                            ? 'border-amber-300 bg-amber-50'
                            : isSelected
                              ? 'border-[#7dd3fc] bg-sky-50'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        showCorrect && isSelected
                          ? 'bg-emerald-500 text-white'
                          : showWrong
                            ? 'bg-red-500 text-white'
                            : showMissed
                              ? 'bg-amber-500 text-white'
                              : isSelected
                                ? 'bg-sky-100 text-[#38bdf8]'
                                : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {showCorrect && isSelected ? '✓' : showMissed ? '!' : String.fromCharCode(65 + ci)}
                    </span>
                    <span className="text-sm text-slate-800 flex-1">{choice}</span>
                    <input
                      type={q.type === 'multi' ? 'checkbox' : 'radio'}
                      name={`mc-${q.id}`}
                      checked={isSelected}
                      disabled={mcResult !== null}
                      onChange={() => handleMCSelect(ci)}
                      className="sr-only"
                    />
                  </label>
                </li>
              )
            })}
          </ul>

        </div>

        {mcResult === null && (
          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBack}
              disabled={isScoring || isReviewMode}
              className="rounded-lg border border-slate-200 px-5 py-3.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← 前へ
            </button>
            <button
              type="button"
              disabled={mcSelected.length === 0 || isReviewMode}
              onClick={handleCheckMC}
              className="flex-1 rounded-xl bg-[#7dd3fc] py-3.5 text-sm font-medium text-slate-900 hover:bg-[#38bdf8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              確認する
            </button>
          </div>
        )}

        {/* 結果フィードバック */}
        {mcResult !== null && (
          <div
            className={`mt-4 rounded-xl border p-5 ${
              mcResult ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
            }`}
          >
            <p className={`text-base font-semibold ${mcResult ? 'text-emerald-700' : 'text-red-700'}`}>
              {mcResult ? '✓ 正解' : '✗ 不正解'}
            </p>
            {!mcResult && (
              <p className="mt-1 text-sm text-slate-700">
                正しい選択肢をすべて選んでください（{q.type === 'multi' ? '複数選択可' : '単一選択'}）。
              </p>
            )}
            <div className="mt-4">
              {mcResult ? (
                <button
                  type="button"
                  disabled={isScoring}
                  onClick={handleNext}
                  className="rounded-xl bg-[#7dd3fc] px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-[#38bdf8] disabled:opacity-50"
                >
                  {nextBtnLabel}
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
          </div>
        )}
      </>
    )
  }

  // 記述式問題（Step 4）
  const eq = currentQuestion as EssayQuestion | null
  return pageLayout(
    <>
      {isReviewMode && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-700">
          ✓ 完了済み — 上の丸いボタンで各ステップの内容を見返せます
        </div>
      )}
      {headerBlock}
      <StepProgress current={step} onStepClick={isReviewMode ? handleReviewStepClick : undefined} />

      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-800">{sectionName}</h2>
        <p className="mt-0.5 text-xs text-slate-500">{sectionQIdx + 1} / {sectionQuestions.length}問</p>
      </div>

      {/* 記述式問題カード */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-5 space-y-4">
        <p className="text-sm font-semibold text-slate-800">{eq?.prompt ?? ''}</p>
        {eq?.scenarioText && (
          <pre className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap font-sans">
            {eq.scenarioText}
          </pre>
        )}
        {isReviewMode ? (
          (() => {
            const savedAnswer = riskAnswers[eq?.id ?? ''] ?? ''
            return savedAnswer ? (
              <textarea
                className="w-full rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-slate-800 resize-none disabled:opacity-100"
                rows={6}
                value={savedAnswer}
                disabled
                readOnly
              />
            ) : (
              <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-400 italic">
                回答データがありません
              </div>
            )
          })()
        ) : (
          <textarea
            className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none disabled:opacity-60"
            rows={6}
            placeholder="回答を入力してください..."
            value={currentInput}
            disabled={isScoring || currentResult !== null}
            onChange={(e) => setCurrentInput(e.target.value)}
          />
        )}
        {isScoring && (
          <div className="flex flex-col items-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-[3px] border-slate-200 border-t-sky-600" />
            <p className="mt-2 text-sm text-slate-500">AIが採点しています...</p>
          </div>
        )}
      </div>

      {!currentResult && !isScoring && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={isScoring || isReviewMode}
            className="rounded-lg border border-slate-200 px-5 py-3.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← 前へ
          </button>
          <button
            type="button"
            disabled={!currentInput.trim() || isReviewMode}
            onClick={handleScore}
            className="flex-1 rounded-xl bg-[#7dd3fc] py-3.5 text-sm font-medium text-slate-900 hover:bg-[#38bdf8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            採点する
          </button>
        </div>
      )}

      {/* 採点結果 */}
      {currentResult && (
        <div
          className={`mt-4 rounded-xl border p-5 space-y-3 ${
            currentResult.pass ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
          }`}
        >
          <p className={`text-base font-semibold ${currentResult.pass ? 'text-emerald-700' : 'text-red-700'}`}>
            {currentResult.pass ? '✓ 合格' : '✗ 不合格'}
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">{currentResult.feedback}</p>
          {currentResult.details && (
            <ScoreDetailsPanel details={currentResult.details} />
          )}
          <div>
            {currentResult.pass ? (
              <button
                type="button"
                disabled={isScoring}
                onClick={handleNext}
                className="rounded-xl bg-[#7dd3fc] px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-[#38bdf8] disabled:opacity-50"
              >
                {nextBtnLabel}
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
        </div>
      )}
    </>
  )
}

function ScoreDetailsPanel({ details }: { details: ScoreDetails }) {
  const items: { key: keyof ScoreDetails; label: string }[] = [
    { key: 'who',   label: 'Who（誰が）' },
    { key: 'what',  label: 'What（何が）' },
    { key: 'when',  label: 'When（いつ）' },
    { key: 'where', label: 'Where（どこで）' },
    { key: 'why',   label: 'Why（なぜ）' },
    { key: 'how',   label: 'How（どのように）' },
  ]
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold text-slate-600 mb-2">5W1H チェック結果</p>
      <ul className="grid grid-cols-2 gap-1">
        {items.map(({ key, label }) => (
          <li key={key} className="flex items-center gap-1.5 text-xs">
            <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${details[key] ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              {details[key] ? '✓' : '✗'}
            </span>
            <span className={details[key] ? 'text-slate-700' : 'text-slate-400'}>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
