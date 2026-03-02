import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { setIntroConfirmed, setIntroConfirmedForUser, getIntroConfirmed } from './introGate'
import { getCurrentUsername } from '../auth'
import { Confetti } from '../components/Confetti'

/** カードのアクセント色（画像の緑・青に合わせたパレット） */
const CARD_ACCENTS = [
  { bg: 'bg-emerald-100', border: 'border-emerald-200', icon: 'bg-emerald-500' },
  { bg: 'bg-sky-100', border: 'border-sky-200', icon: 'bg-sky-500' },
  { bg: 'bg-violet-100', border: 'border-violet-200', icon: 'bg-violet-500' },
  { bg: 'bg-amber-100', border: 'border-amber-200', icon: 'bg-amber-500' },
  { bg: 'bg-indigo-100', border: 'border-indigo-200', icon: 'bg-indigo-500' },
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

const QUIZ_QUESTIONS: { id: number; question: string; choices: string[]; correctIndex: number }[] = [
  { id: 0, question: '状況を整理し報告する際に最も意識すべきフレームワークは？', choices: ['5W1H', 'PDCA', 'KPI', 'OKR'], correctIndex: 0 },
  { id: 1, question: '外部AIツールに機密情報（顧客名・IPアドレス等）を入力する際の適切な対応は？', choices: ['顧客名・IPアドレスを適切に抽象化・匿名化してからAIに入力する', 'そのまま入力する', '入力しない', '暗号化して入力する'], correctIndex: 0 },
  { id: 2, question: '離席時に徹底すべき基本的な行動は？', choices: ['画面をロックし、入館証を携行する', 'ディスプレイの電源を切る', '書類をしまう', 'ログアウトするのみ'], correctIndex: 0 },
  { id: 3, question: '解決困難な問題が発生した際の正しい初動は？', choices: ['一人で抱え込まず、迅速に報告・相談する', '自分で解決するまで待つ', '記録だけ残す', '上司に任せる'], correctIndex: 0 },
  { id: 4, question: '設定変更作業の「直前」に必ず行うべき工程は？', choices: ['現状のバックアップを取得する', '変更内容を文書化する', '承認を得る', 'テスト環境で実施する'], correctIndex: 0 },
]

const CHOICE_LABELS = ['A', 'B', 'C', 'D']

export function IntroPage() {
  const navigate = useNavigate()
  const usernameAtMountRef = useRef<string | null>(null)
  const [answers, setAnswers] = useState<number[]>(() => QUIZ_QUESTIONS.map(() => -1))
  const [confirmed, setConfirmed] = useState(false)
  const [showPassScreen, setShowPassScreen] = useState(false)
  const [showReview, setShowReview] = useState(false)

  useEffect(() => {
    document.title = 'はじめに'
    const ok = getIntroConfirmed()
    setConfirmed(ok)
    const user = getCurrentUsername()
    if (usernameAtMountRef.current === null) usernameAtMountRef.current = user
    if (ok && user && user !== 'admin') setIntroConfirmedForUser(user)
  }, [])

  /** 「確認済み」表示中は per-user キーへ毎秒同期し、admin で合格と表示されるようにする */
  useEffect(() => {
    if (!confirmed) return
    const user = getCurrentUsername()
    if (!user || user === 'admin') return
    const sync = () => setIntroConfirmedForUser(user)
    sync()
    const id = setInterval(sync, 1000)
    return () => clearInterval(id)
  }, [confirmed])

  const setAnswer = (i: number, ci: number) => {
    setAnswers((prev) => {
      const next = [...prev]
      next[i] = ci
      return next
    })
  }

  const allAnswered = answers.every((a) => a >= 0)
  const allCorrect = allAnswered && QUIZ_QUESTIONS.every((q, i) => answers[i] === q.correctIndex)

  const handleSubmit = () => {
    if (allCorrect) setShowPassScreen(true)
  }

  const handleStartTraining = () => {
    const who = usernameAtMountRef.current?.trim()
    if (who && who.toLowerCase() !== 'admin') setIntroConfirmedForUser(who)
    else setIntroConfirmed()
    setConfirmed(true)
    navigate('/training/infra-basic-top')
  }

  const topBar = (
    <div className="flex items-center justify-end mb-6">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 shadow-sm hover:bg-slate-50"
      >
        トップに戻る
      </button>
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

  if (confirmed && !showReview) {
    return pageLayout(
      <>
        {headerBlock}
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-6 space-y-4">
          <p className="text-sm text-slate-600">確認済みです。インフラ基礎課題へアクセスできます。</p>
          <button
            type="button"
            onClick={() => setShowReview(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            「はじめに」を見返す
          </button>
        </div>
      </>
    )
  }

  if (showPassScreen && allCorrect) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-800 p-6">
        <Confetti />
        <div className="mx-auto max-w-2xl relative z-10">
          {topBar}
          {headerBlock}
          <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-10 text-center">
            <p className="text-5xl mb-2" aria-hidden>🎉</p>
            <p className="text-2xl font-bold text-slate-800 mb-2">全問正解です！</p>
            <p className="text-sm text-slate-600 mb-8">プロフェッショナルとしてのスタンダードを承諾のうえ、課題を開始してください。</p>
            <button
              type="button"
              onClick={handleStartTraining}
              className="rounded-lg bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-indigo-700"
            >
              演習を開始する
            </button>
          </div>
        </div>
      </div>
    )
  }

  return pageLayout(
    <>
      {confirmed && showReview && (
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-4 mb-6">
          <p className="text-sm text-slate-600">確認済みです。下記の内容はいつでも見返せます。</p>
        </div>
      )}

      {headerBlock}

      <div className="flex items-center gap-3 mb-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-base" aria-hidden>🖥️</span>
        <h1 className="text-xl font-bold text-slate-800">プロフェッショナルの5つの行動基準</h1>
      </div>

      <p className="text-sm text-slate-600 mb-6">
        プロフェッショナルとして信頼を獲得するための『5つの行動基準』を確認し、各項目の確認テストに答えてください。
      </p>

      <div className="space-y-4">
        {STANDARDS.map((s, i) => {
          const accent = CARD_ACCENTS[i]
          const q = QUIZ_QUESTIONS[i]
          return (
            <div key={i} className="space-y-4">
              {/* 解説 */}
              <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent.bg} text-base`} aria-hidden>
                      {s.icon}
                    </span>
                    <h2 className="text-base font-semibold text-slate-800">
                      ■{s.title}
                    </h2>
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
              {/* 理解度チェック */}
              <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-5">
                <p className="text-sm text-slate-600 mb-1">理解度チェック</p>
                <p className="text-base font-semibold text-slate-800 mb-4">{i + 1}. {q.question}</p>
                <ul className="space-y-2">
                  {q.choices.map((c, ci) => {
                    const isSelected = answers[i] === ci
                    const showCorrect = answers[i] >= 0 && isSelected && ci === q.correctIndex
                    const showWrong = answers[i] >= 0 && isSelected && ci !== q.correctIndex
                    return (
                      <li key={ci}>
                        <label
                          className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                            showCorrect
                              ? 'border-emerald-300 bg-emerald-50'
                              : showWrong
                                ? 'border-amber-200 bg-amber-50'
                                : isSelected
                                  ? 'border-sky-200 bg-sky-50'
                                  : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                              showCorrect
                                ? 'bg-emerald-500 text-white'
                                : showWrong
                                  ? 'bg-amber-500 text-white'
                                  : isSelected
                                    ? 'bg-sky-200 text-sky-800'
                                    : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            {showCorrect ? '✓' : CHOICE_LABELS[ci]}
                          </span>
                          <span className="text-sm text-slate-800">{c}</span>
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            checked={answers[i] === ci}
                            onChange={() => setAnswer(i, ci)}
                            className="sr-only"
                          />
                        </label>
                      </li>
                    )
                  })}
                </ul>
                {answers[i] >= 0 && (
                  <div className="mt-3 space-y-2" role="status">
                    <p
                      className={`text-sm font-medium animate-[fadeIn_0.3s_ease-out] ${answers[i] === q.correctIndex ? 'text-emerald-600' : 'text-amber-600'}`}
                    >
                      {answers[i] === q.correctIndex ? '✓ 正解' : `△ 不正解。正解は「${q.choices[q.correctIndex]}」です。`}
                    </p>
                    <p className="text-xs text-slate-600 border-l-2 border-slate-200 pl-3 animate-[fadeIn_0.3s_ease-out]">
                      {s.exampleCorrect}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allAnswered}
          className="w-full rounded-lg bg-indigo-600 py-3.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          確認する
        </button>
      </div>
    </>
  )
}
