import { useRef, useState } from 'react'

type Grade = 'S' | 'A' | 'B' | 'C' | 'D'

/** Web Speech API 用の型（ブラウザ組み込み型がない場合のフォールバック） */
interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
}
interface SpeechRecognitionResultEvent {
  resultIndex: number
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionResultList {
  length: number
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionResult {
  length: number
  isFinal: boolean
  [index: number]: { transcript: string }
}

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance; webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition
    : undefined

/** 各セクションの言語化ガイド（技術的思考ヒント） */
const SECTION_HINTS: { label: string; key: string; hint: string }[] = [
  {
    label: '【対象】',
    key: 'env',
    hint:
      '「誰が、どこで」を明確に。「自分のPCから、課題2のCentOSに対して」のように、物理的な位置関係を含めると伝わりやすくなります。',
  },
  {
    label: '【事象】',
    key: 'issue',
    hint:
      '「動かない」はNG。「どのコマンドを打った時に、どんなエラーが出たか」を正確に写してください。',
  },
  {
    label: '【試したこと】',
    key: 'inv',
    hint:
      '「〇〇を試しました」だけでなく、その時のログ（cat /var/log/messages 等）の一部を添えると、プロはすぐに原因を特定できます。',
  },
  {
    label: '【仮説】',
    key: 'hypo',
    hint:
      '勘でも構いません。「設定ファイルの記述ミスかもしれない」など、自分なりの予測を1行足すだけで、レビューの質が変わります。',
  },
]

type MentorResult = {
  grade: Grade
  summary: string
  rewritten: string
  hints: string[]
}

function evaluateQuestion(raw: string): MentorResult {
  const text = raw.trim()
  if (!text) {
    return {
      grade: 'D',
      summary: '内容がほとんど書かれていません。「対象 / 事象 / 確認したこと / 仮説」の4つを意識して書いてみましょう。',
      rewritten:
        '【対象】\n（どのサーバ / OS / アプリについての話か）\n\n【事象】\n（何が起きているか。エラー文や再現手順）\n\n【試したこと】\n（既に実施したコマンドやログ確認）\n\n【仮説】\n（何が原因だと考えているか）',
      hints: ['まずは「いつ・どこで・何が起きているか」を 2〜3 行で書き出してみましょう。'],
    }
  }

  // 依存的な質問は即 D 判定
  const wantsAnswer =
    /答えを教えて|正解を教えて|解答を教えて|教えてください|教えて下さい|tell me the answer|give me the answer/i.test(
      text,
    )
  if (wantsAnswer) {
    return {
      grade: 'D',
      summary:
        '「答えを教えてください」という依存的な質問になっています。エンジニアの仕事はまず現状を整理し、自分なりの仮説を立てることです。',
      rewritten:
        '【対象】\n（例: ○○環境の ×× サーバ / インフラ基礎課題3-2 の Q1 など）\n\n【事象】\n（例: ～～というエラーが発生し、△△ができない）\n\n【試したこと】\n（例: ログの場所・確認した設定・実行したコマンドなど）\n\n【仮説】\n（例: □□ の設定ミス、ネットワーク経路の問題 などと考えている）',
      hints: [
        '「対象」「事象」「試したこと」「仮説」の4つを日本語で書き出してから、再度相談してください。',
        'まずは自分なりの仮説を 1 行でも書く習慣をつけると、現場での成長が早くなります。',
      ],
    }
  }

  // ラベル付き（対象：…）または一文で5W1Hの内容が含まれるか
  const hasTarget =
    /対象[:：]/.test(text) || /(環境|接続|サーバ|SSH|CentOS|課題\d|PCから|どこで)/.test(text)
  const hasEvent =
    /(事象|症状)[:：]/.test(text) || /(ping|疎通|timeout|タイムアウト|エラー|できない|失敗|実行した)/.test(text)
  const hasTried =
    /(試したこと|確認|実施したこと)[:：]/.test(text) ||
    /(確認|試した|停止|通る|firewalld|LAN|他端末)/.test(text)
  const hasHypo =
    /(仮説|原因予想|推測)[:：]/.test(text) ||
    /(疑い|考え|ミス|ルーティング|設定|原因|教えて|どのログ)/.test(text)
  const flags = [hasTarget, hasEvent, hasTried, hasHypo]
  const count = flags.filter(Boolean).length

  let grade: Grade
  if (count === 4) grade = 'S'
  else if (count === 3) grade = 'A'
  else if (count === 2) grade = 'B'
  else if (count === 1) grade = 'C'
  else grade = 'D'

  let summary: string
  switch (grade) {
    case 'S':
      summary = '対象・事象・試したこと・仮説が揃っており、そのまま現場でも通用する質問レベルです。'
      break
    case 'A':
      summary = 'ほぼ必要な情報は揃っていますが、一部の観点（対象 or 仮説など）が薄いため、もう一歩整理するとさらに良くなります。'
      break
    case 'B':
      summary = '断片的な情報はありますが、「誰が・どこで・何をして・どうなったか」が読み手に伝わりにくい状態です。4要素を意識して追記しましょう。'
      break
    case 'C':
      summary = '状況は伝わり始めていますが、現状の説明と試したこと・仮説が分かれておらず、原因切り分けの材料が不足しています。'
      break
    default:
      summary = '情報が足りず、回答者が状況をイメージしづらい状態です。4つの観点を順番に埋めてみましょう。'
      break
  }

  const rewritten =
    '【対象】\n' +
    (hasTarget ? '（既に「対象:」として書かれている内容をここに集約）' : 'どのサーバ / OS / アプリ /課題かを 1 行で書きます。') +
    '\n\n【事象】\n' +
    (hasEvent ? '発生している事象やエラー内容を、時系列で 2〜3 行にまとめます。' : 'いつ・どの操作をした時に・何が起きたかを整理します。') +
    '\n\n【試したこと】\n' +
    (hasTried ? 'ログ確認や再起動、実行したコマンドなど、既に試した対応を列挙します。' : 'どのログを見たか、どのコマンドを実行したかを具体的に書きます。') +
    '\n\n【仮説】\n' +
    (hasHypo ? '考えている原因候補を 1〜2 個に絞って記載します。' : '「○○の設定が誤っている」「△△のネットワーク経路が怪しい」など、原因の仮説を書きます。')

  const hints: string[] = []
  if (!hasTarget) hints.push('「対象: ○○サーバ / 課題3-2 Q1 など」の行を足すと、レビュー側が前提を誤解しにくくなります。')
  if (!hasEvent) hints.push('「事象: ××の操作で △△ エラーが発生」のように、具体的な動作とエラーを 1 行でまとめましょう。')
  if (!hasTried) hints.push('「試したこと: ログの場所 / 実行コマンド / 再起動の有無」などを書き出すと、二度手間の回答を防げます。')
  if (!hasHypo) hints.push('「仮説: ～が原因と考えている」の 1 行を足すだけで、先輩からのコメントの質が一段上がります。')

  return { grade, summary, rewritten, hints }
}

export function MentorDesk() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [result, setResult] = useState<MentorResult | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [voiceUnsupported, setVoiceUnsupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  const startVoiceInput = () => {
    if (!SpeechRecognitionAPI) {
      setVoiceUnsupported(true)
      setTimeout(() => setVoiceUnsupported(false), 3000)
      return
    }
    if (isListening) return
    try {
      const recognition = new SpeechRecognitionAPI()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'ja-JP'
      recognition.onresult = (event: SpeechRecognitionResultEvent) => {
        let finalText = ''
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i]
          if (res.isFinal) {
            finalText += res[0].transcript
          } else {
            interim += res[0].transcript
          }
        }
        if (finalText) {
          setInput((prev) => prev + finalText)
        }
        setInterimTranscript(interim)
      }
      recognition.onerror = () => {
        recognition.stop()
        setIsListening(false)
        recognitionRef.current = null
      }
      recognition.onend = () => {
        setIsListening(false)
        recognitionRef.current = null
      }
      recognition.start()
      recognitionRef.current = recognition
      setIsListening(true)
    } catch {
      setIsListening(false)
      recognitionRef.current = null
    }
  }

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      recognitionRef.current = null
    }
    setIsListening(false)
    setInterimTranscript('')
  }

  const handleAnalyze = () => {
    const text = input.trim()
    if (!text) return
    setIsEvaluating(true)
    try {
      const r = evaluateQuestion(text)
      setResult(r)
    } finally {
      setIsEvaluating(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setResult(null)
  }

  return (
    <>
      {/* フローティングボタン（アイコンのみ・右下で邪魔にならない配置） */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-slate-600 bg-slate-950/95 text-slate-100 shadow-lg hover:border-brand-500/60 hover:bg-slate-800/95 hover:text-white"
        title="AIメンターに相談（質問添削）"
        aria-label="AIメンターに相談（質問添削）"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {/* 相談デスク（スライドインパネル） */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* 背景オーバーレイ */}
          <div className="absolute inset-0 bg-slate-950/60" onClick={handleClose} />

          {/* パネル本体 */}
          <div className="relative z-50 flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-950/98 p-4 text-[11px] text-slate-100 shadow-xl">
            <header className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-200">
                  MENTOR · QUESTION DESK
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-50">AIメンター相談デスク（質問添削専用）</p>
                <p className="mt-1 text-[10px] text-slate-400">
                  ※ 正解やコマンドは一切お伝えしません。質問内容の整理と添削のみを行います。
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:border-slate-500 hover:text-slate-50"
              >
                閉じる
              </button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto">
              <div className="space-y-2">
                {/* チャットで送るイメージの例文（5W1H 一文） */}
                <details className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-3" open>
                  <summary className="cursor-pointer text-[10px] font-semibold text-slate-300">
                    チャットで送るイメージ（例文）
                  </summary>
                  <p className="mt-2 text-[10px] text-slate-400">
                    一文で5W1H（誰が・どこで・何が・なぜ・どうしたか）が伝わる形で送ると、先輩やメンターが状況を把握しやすくなります。
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-900/80 p-2.5 text-[10px] leading-relaxed text-slate-200">
                    {`課題2のCentOSにSSH接続中、ping 8.8.8.8 がタイムアウトで疎通できない。同一LAN他端末では通る・firewalld停止済みなので、DGかルーティングの設定ミスではないかと考えています。この見立てで合っていますか？確認すべきログはどれがよいでしょうか。`}
                  </pre>
                </details>

                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold text-slate-300">
                    質問内容（質問したい内容をそのまま貼ってもOKです）
                  </p>
                  <span className="text-[9px] text-slate-500">タップで開始／停止・音声→文字</span>
                </div>
                <div className="relative">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    rows={6}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 pr-12 text-[11px] text-slate-50 placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
                    placeholder="上の例文のように、一文で5W1Hが伝わる形で自分の状況を入力してください。"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (isListening) {
                        stopVoiceInput()
                      } else {
                        startVoiceInput()
                      }
                    }}
                    className={`absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${isListening
                        ? 'animate-pulse border-rose-500 bg-rose-600 text-white'
                        : 'border-slate-600 bg-slate-800/90 text-slate-300 hover:border-slate-500 hover:bg-slate-700/90'
                      }`}
                    title="タップで音声入力を開始／停止"
                  >
                    <span className="sr-only">音声入力</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                  </button>
                </div>
                {isListening && (
                  <p className="flex items-center gap-1.5 text-[10px] text-amber-400">
                    <span className="animate-pulse">🎤</span>
                    <span>聞き取り中:</span>
                    <span className="text-slate-200">
                      {interimTranscript || '（話すとここに表示されます）'}
                    </span>
                  </p>
                )}
                {/* 文章を組み立てるためのチェックリスト（各項目に ? ツールチップ） */}
                <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-3">
                  <p className="mb-2 text-[10px] font-semibold text-slate-300">
                    文章を組み立てるためのチェックリスト
                  </p>
                  <ul className="space-y-2">
                    {SECTION_HINTS.map(({ label, key, hint }) => (
                      <li key={key} className="group relative flex items-start gap-2">
                        <span className="text-[11px] font-medium text-slate-200">{label}</span>
                        <span
                          className="flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-slate-600 bg-slate-800/80 text-[10px] text-slate-400 hover:border-slate-500 hover:text-slate-200"
                          title={hint}
                        >
                          ?
                        </span>
                        <div className="absolute left-6 top-6 z-10 max-w-[280px] rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-[10px] leading-relaxed text-slate-200 shadow-xl opacity-0 transition-opacity duration-150 group-hover:opacity-100 pointer-events-none">
                          {hint}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] text-slate-400">
                    ※ 「答えを教えてください」だけの内容は D 判定となり、まず状況整理を促します。
                  </p>
                  <div className="flex items-center gap-2">
                    {isListening && (
                      <span className="text-[10px] font-medium text-rose-400">音声認識中...</span>
                    )}
                    {voiceUnsupported && (
                      <span className="text-[10px] text-amber-400">お使いのブラウザでは音声入力に未対応です</span>
                    )}
                    <button
                      type="button"
                      onClick={handleAnalyze}
                      className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-soft-card hover:from-brand-400 hover:to-brand-600"
                    >
                      {isEvaluating ? '評価中…' : '質問を添削する'}
                    </button>
                  </div>
                </div>
              </div>

              {result && (
                <div className="space-y-3 rounded-2xl border border-slate-800/80 bg-slate-950/90 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-slate-300">評価結果（S〜D）</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${result.grade === 'S' || result.grade === 'A'
                          ? 'border border-emerald-500/60 bg-emerald-600/20 text-emerald-100'
                          : result.grade === 'B'
                            ? 'border border-amber-500/60 bg-amber-900/30 text-amber-100'
                            : 'border border-rose-500/60 bg-rose-900/30 text-rose-100'
                        }`}
                    >
                      評価: {result.grade}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-200">{result.summary}</p>

                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-slate-300">プロ仕様の質問文フォーマット（たたき台）</p>
                    <pre className="max-h-40 overflow-auto rounded-lg border border-slate-800 bg-slate-950/80 p-2 text-[11px] text-slate-100">
                      {result.rewritten}
                    </pre>
                  </div>

                  {result.hints.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-slate-300">調査の方向性（抽象的ヒント）</p>
                      <ul className="list-disc space-y-1 pl-5 text-[11px] text-slate-200">
                        {result.hints.map((h, idx) => (
                          <li key={idx}>{h}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-500">
                    ※ ここでは「どの OS ログを見るべきか」「どの解説セクションを読み直すべきか」といった方向性のみを案内し、課題の正解や具体的な
                    コマンドは一切提示しません。
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

