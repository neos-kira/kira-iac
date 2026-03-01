import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setIntroConfirmed, getIntroConfirmed } from './introGate'
import { Confetti } from '../components/Confetti'

const STANDARDS = [
  { title: '正確な現状共有 (5W1H)', body: '5W1Hを意識し、チームの迅速な意思決定を支援する報告を徹底する。', example: '例: 障害報告では「いつ・どこで・誰が・何が・なぜ・どのように」を簡潔にまとめ、再現手順や影響範囲を添える。', icon: '🖥️', gradient: 'from-indigo-500 to-indigo-700' },
  { title: 'AIガバナンスと機密保持', body: '外部ツールの利用時は機密情報を適切に抽象化・匿名化し、プロとして「情報の出し口」を完全に制御する。', example: '例: 顧客名・IPアドレス・認証情報は仮名や範囲表記に置き換えてからAIに入力し、出力も社外にそのまま出さない。', icon: '🤖', gradient: 'from-purple-500 to-purple-700' },
  { title: '物理セキュリティの遵守', body: '常駐先でのID携行や離席時の画面ロックを習慣化し、組織の安全を守る。', example: '例: 席を立つときは必ずWin+L（またはCmd+Ctrl+Q）でロックし、入館証は肌身離さず携行する。', icon: '🔒', gradient: 'from-violet-500 to-violet-700' },
  { title: 'リスクの早期共有', body: '課題を一人で抱え込まず迅速にエスカレーションし、プロジェクトの停滞（リスク）を防ぐ。', example: '例: 納期に影響しそうな不具合は「〇日までに判断が必要」と期限を明示して報告し、上司・PMと対応方針を決める。', icon: '🚩', gradient: 'from-fuchsia-500 to-fuchsia-700' },
  { title: '確実なリカバリ体制', body: '設定変更前には必ずバックアップを取得し、不測の事態でも即時復旧可能な状態を維持する。', example: '例: 設定ファイルを編集する前に cp -p で .org を付けてコピーし、変更後もロールバック手順をメモしておく。', icon: '💾', gradient: 'from-indigo-600 to-purple-700', codeExample: '# 設定を変更する前に元の状態を保存\ncp -p /etc/nginx/nginx.conf /etc/nginx/nginx.conf.org\ncp -p /etc/ssh/sshd_config /etc/ssh/sshd_config.org' },
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
  const [answers, setAnswers] = useState<number[]>(() => QUIZ_QUESTIONS.map(() => -1))
  const [confirmed, setConfirmed] = useState(false)
  const [showPassScreen, setShowPassScreen] = useState(false)
  const [showReview, setShowReview] = useState(false)

  useEffect(() => {
    document.title = 'はじめに'
    setConfirmed(getIntroConfirmed())
  }, [])

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
    setIntroConfirmed()
    setConfirmed(true)
    navigate('/training/infra-basic-top')
  }

  if (confirmed && !showReview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 text-slate-800 p-6">
        <div className="mx-auto max-w-2xl">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">はじめに</h1>
            <button type="button" onClick={() => navigate('/')} className="text-sm text-slate-600 hover:text-slate-800">
              トップへ戻る
            </button>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-soft-card border border-slate-200 space-y-4">
            <p className="text-sm text-slate-600">確認済みです。インフラ基礎課題へアクセスできます。</p>
            <button
              type="button"
              onClick={() => setShowReview(true)}
              className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              内容を見返す
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (showPassScreen && allCorrect) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 text-slate-800 p-6">
        <Confetti />
        <div className="mx-auto max-w-2xl relative z-10">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-lg font-semibold">はじめに</h1>
            <button type="button" onClick={() => navigate('/')} className="text-sm text-slate-600 hover:text-slate-800">
              トップへ戻る
            </button>
          </div>
          <div className="rounded-2xl bg-white p-10 shadow-soft-card border border-slate-200 text-center">
            <p className="text-4xl mb-2" aria-hidden>🎉</p>
            <p className="text-2xl font-bold text-slate-800 mb-2">全問正解です！</p>
            <p className="text-sm text-slate-600 mb-8">プロフェッショナルとしてのスタンダードを承諾のうえ、課題を開始してください。</p>
            <button
              type="button"
              onClick={handleStartTraining}
              className="rounded-xl bg-gradient-to-r from-purple-600 via-purple-500 to-violet-600 px-8 py-4 text-base font-semibold text-white shadow-lg hover:from-purple-500 hover:via-purple-400 hover:to-violet-500 transition-all"
            >
              演習を開始する
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 text-slate-800 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        {confirmed && showReview && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-indigo-800">確認済みです。下記の内容はいつでも見返せます。</p>
            <button
              type="button"
              onClick={() => setShowReview(false)}
              className="text-sm font-medium text-indigo-700 hover:text-indigo-900 underline"
            >
              簡易表示に戻る
            </button>
          </div>
        )}
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">SECTION · はじめに</p>
          </div>
          <button type="button" onClick={() => navigate('/')} className="text-sm text-slate-600 hover:text-slate-800 shrink-0">
            トップへ戻る
          </button>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-soft-card border border-slate-200">
          <p className="text-sm text-slate-600">
            プロフェッショナルとして信頼を獲得するための『5つの行動基準』を確認し、各項目の確認テストに答えてください。
          </p>
        </div>

        {STANDARDS.map((s, i) => {
          const q = QUIZ_QUESTIONS[i]
          return (
            <div key={i} className="space-y-4">
              {/* 説明カード（リッチアイコン・グラデーション見出し） */}
              <div className="rounded-2xl bg-white shadow-soft-card border border-slate-200 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${s.gradient} text-2xl shadow-md text-white`} aria-hidden>
                      {s.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className={`text-lg font-semibold text-slate-800`}>
                        {s.title}
                      </h2>
                      <p className="mt-2 text-sm text-slate-700">{s.body}</p>
                      <p className="mt-2 text-xs text-slate-500 border-l-2 border-slate-200 pl-3">{s.example}</p>
                      {s.codeExample && (
                        <pre className="mt-3 rounded-xl bg-slate-800 text-slate-300 p-4 text-xs leading-relaxed font-mono overflow-x-auto">
                          {s.codeExample}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 理解度チェック（即時フィードバック） */}
              <div className="rounded-2xl bg-white shadow-soft-card border border-slate-200 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">理解度チェック</p>
                <p className="text-sm font-medium text-slate-800 mb-4">{i + 1}. {q.question}</p>
                <ul className="space-y-2">
                  {q.choices.map((c, ci) => {
                    const isSelected = answers[i] === ci
                    const showCorrect = answers[i] >= 0 && isSelected && ci === q.correctIndex
                    const showWrong = answers[i] >= 0 && isSelected && ci !== q.correctIndex
                    return (
                      <li key={ci}>
                        <label
                          className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all duration-200 ${
                            showCorrect
                              ? 'border-emerald-400 bg-emerald-50'
                              : showWrong
                                ? 'border-amber-300 bg-amber-50'
                                : isSelected
                                  ? 'border-indigo-300 bg-indigo-50'
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
                                    ? 'bg-indigo-500 text-white'
                                    : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {CHOICE_LABELS[ci]}
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
                  <p
                    className={`mt-3 text-sm font-medium animate-[fadeIn_0.3s_ease-out] ${
                      answers[i] === q.correctIndex ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                    role="status"
                  >
                    {answers[i] === q.correctIndex ? '✓ 正解' : `△ 不正解。正解は「${q.choices[q.correctIndex]}」です。`}
                  </p>
                )}
              </div>
            </div>
          )
        })}

        <div className="rounded-2xl bg-white p-5 shadow-soft-card border border-slate-200">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3.5 text-sm font-semibold text-white shadow-soft-card hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            採点する
          </button>
        </div>
      </div>
    </div>
  )
}
