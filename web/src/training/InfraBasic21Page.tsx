import { useEffect, useState, useCallback, useRef } from 'react'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
import { getProgressKey } from './trainingWbsData'
import {
  INFRA_BASIC_21_DEFAULT_STATE,
  INFRA_BASIC_21_STORAGE_KEY,
  loadInfraBasic21State,
  saveInfraBasic21State,
  type InfraBasic21StoredState,
  KNOWLEDGE_QUESTIONS_21,
  type KnowledgeQuestionId,
  type KnowledgeQuestionConfig,
} from './infraBasic21Data'

export function InfraBasic21Page() {
  const navigate = useSafeNavigate()
  const storageKey = getProgressKey(INFRA_BASIC_21_STORAGE_KEY)
  const [state, setState] = useState<InfraBasic21StoredState>(() => loadInfraBasic21State(storageKey))
  const formRef = useRef<HTMLDivElement>(null)
  const markDirty = () => { formRef.current?.setAttribute('data-form-dirty', 'true') }
  const clearDirty = () => { formRef.current?.setAttribute('data-form-dirty', 'false') }
  const [pingCheck, setPingCheck] = useState<{ checked: boolean; pass: boolean; message: string }>({
    checked: false,
    pass: false,
    message: '',
  })

  useEffect(() => {
    document.title = 'インフラ基礎課題2-1 ネットワーク実践編'
  }, [])

  useEffect(() => {
    const handler = () => { saveInfraBasic21State(state, storageKey); clearDirty() }
    window.addEventListener('nic:save-and-leave', handler)
    return () => window.removeEventListener('nic:save-and-leave', handler)
  })

  const updateState = useCallback((updater: (prev: InfraBasic21StoredState) => InfraBasic21StoredState) => {
    setState((prev) => {
      const next = updater(prev)
      saveInfraBasic21State(next, storageKey)
      return next
    })
  }, [storageKey])

  const handlePracticalChange = useCallback(
    (field: keyof InfraBasic21StoredState['practical'], value: string | boolean) => {
      markDirty()
      updateState((prev) => ({
        ...prev,
        practical: {
          ...prev.practical,
          [field]: value,
        },
      }))
      if (field === 'q3PingResult') {
        // 入力が変わったら一旦判定結果をリセット
        setPingCheck({ checked: false, pass: false, message: '' })
      }
    },
    [updateState],
  )

  const handleKnowledgeChange = useCallback(
    (id: KnowledgeQuestionId, value: string) => {
      markDirty()
      updateState((prev) => ({
        ...prev,
        knowledgeAnswers: {
          ...prev.knowledgeAnswers,
          [id]: value,
        },
      }))
    },
    [updateState],
  )

  const handleKnowledgeCheck = useCallback(() => {
    updateState((prev) => {
      const next: InfraBasic21StoredState = {
        ...prev,
        knowledgeResult: { ...prev.knowledgeResult },
      }

      for (const q of KNOWLEDGE_QUESTIONS_21) {
        const answerRaw = prev.knowledgeAnswers[q.id] ?? ''
        const { pass, feedback } = evaluateKnowledgeAnswer(q, answerRaw)
        next.knowledgeResult[q.id] = {
          checked: true,
          pass,
          feedback,
        }
      }

      return next
    })
  }, [updateState])

  const handleReset = useCallback(() => {
    updateState(() => INFRA_BASIC_21_DEFAULT_STATE)
  }, [updateState])

  const kResult = state.knowledgeResult


  const handlePingCheck = () => {
    const { pass, message } = evaluatePingLog(state.practical.q3PingResult)
    setPingCheck({ checked: true, pass, message })
  }

  function evaluateKnowledgeAnswer(q: KnowledgeQuestionConfig, answerRaw: string): { pass: boolean; feedback: string } {
    const answer = (answerRaw ?? '').trim()
    const lower = answer.toLowerCase()

    if (!answer) {
      return {
        pass: false,
        feedback: 'まずは自分の言葉で30文字程度を書いてみましょう。短くても構わないので、要点だけでも言語化してみてください。',
      }
    }

    // 特別扱い: DG 誤設定の問題（因果関係を重視）
    if (q.id === 'dgMisconfig') {
      const outerWords = ['インターネット', '外', '外部']
      const innerWords = ['内部', 'lan', '同一ネットワーク', '社内']
      const ngWords = ['出られない', '出れない', '行けない', '繋がらない', 'つながらない', '通信できない']

      const mentionsOuter = outerWords.some((w) => lower.includes(w.toLowerCase()))
      const mentionsInner = innerWords.some((w) => lower.includes(w.toLowerCase()))
      const mentionsNg = ngWords.some((w) => lower.includes(w.toLowerCase()))

      if (mentionsOuter && mentionsInner && mentionsNg) {
        return {
          pass: true,
          feedback:
            '「LAN 内は通信できるが、インターネットには出られない」という因果関係まで押さえられていて、現場でもそのまま使える説明になっています。',
        }
      }

      return {
        pass: false,
        feedback:
          'デフォルトゲートウェイが誤っていると「内側（LAN）ではどうか」「外側（インターネット）ではどうか」の両方で通信結果がどう変わるかに触れてみましょう。LAN 内はOKだが外には出られない、といった書き方ができると実務で強いです。',
      }
    }

    // 他の設問はキーワードを「意味のヒント」として緩く利用
    const totalGroups = q.keywordGroups.length
    let hitGroups = 0
    for (const group of q.keywordGroups) {
      const hit = group.variants.some((kw) => lower.includes(kw.toLowerCase()))
      if (hit) hitGroups += 1
    }

    const ratio = totalGroups > 0 ? hitGroups / totalGroups : 0
    const pass = ratio >= 0.6 || answer.length >= 40 // 6割以上キーワード or ある程度の分量で本質的に書けていれば合格に近いとみなす

    if (pass) {
      return {
        pass: true,
        feedback:
          '要点は押さえられています。現場のレビューでは、もう一歩だけ具体例（どんな場面でその知識が役立つか）を添えられるとさらに説得力が増します。',
      }
    }

    // 不合格時のアドバイス（キーワード列挙ではなく思考を促す）
    if (q.id === 'macDuplicate') {
      return {
        pass: false,
        feedback:
          'MAC アドレスが重複すると「どんな通信が不安定になるのか」「どんな現象として現場で観測されるか」にもう少し踏み込んでみましょう。（例: 特定端末だけ通信できない／ランダムに切れる等）',
      }
    }

    if (q.id === 'macWhat') {
      return {
        pass: false,
        feedback:
          'MAC アドレスが「どの層で使われるどんな種類のアドレスか」と「IP アドレスとの違い」に触れられると、より実務で通用する説明になります。',
      }
    }

    if (q.id === 'lanWanDiff') {
      return {
        pass: false,
        feedback:
          'LAN と WAN の違いを「カバーする範囲」と「組織の内側/外側」という2軸で整理してみましょう。社内ネットワーク vs インターネット、といった対比ができるとベターです。',
      }
    }

    if (q.id === 'globalIpNeed') {
      return {
        pass: false,
        feedback:
          'グローバルIPが必要な理由を、「世界中で一意に識別する」「インターネット上で宛先を特定する」といった観点からもう一度整理してみましょう。',
      }
    }

    return {
      pass: false,
      feedback:
        '少し抽象的なので、現場でトラブル対応をしている場面をイメージしながら、「その知識がないとどんな困り方をするか」まで書いてみましょう。',
    }
  }

  function evaluatePingLog(raw: string): { pass: boolean; message: string } {
    const text = (raw ?? '').trim()
    if (!text) {
      return { pass: false, message: 'ログを貼り付けてください。' }
    }
    return { pass: true, message: '◎ ログを確認しました。' }
  }

  return (
    <div ref={formRef} className="min-h-screen bg-slate-50 text-slate-800 p-6" data-form-scope="task" data-form-dirty="false">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => { saveInfraBasic21State(state, storageKey); clearDirty(); navigate('/') }}
            className="rounded-lg border border-sky-500 px-4 py-2 text-xs font-medium text-sky-600 hover:bg-sky-50"
          >
            保存して中断
          </button>
        </div>

        <div>
          <p className="text-xs text-slate-500">課題2-1 · ネットワーク実践</p>
          <h1 className="text-xl font-bold text-slate-800">ネットワーク実機調査</h1>
        </div>

        {/* 説明 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-slate-600 flex-1">
              実際の端末・サーバ・ネットワーク機器を調査しながら、
              <span className="font-semibold text-slate-800">IP情報・疎通結果・経路・概念の理解</span>
              を記録する課題です。入力内容はブラウザに保存されるため、ページを閉じても途中から再開できます。
            </p>
            <svg className="shrink-0" width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden>
              {/* ノートPC */}
              <rect x="8" y="30" width="50" height="35" rx="3" stroke="#0d9488" strokeWidth="2.5" fill="#ccfbf1"/>
              <rect x="14" y="36" width="38" height="22" rx="1" fill="#0d9488" opacity=".15"/>
              <path d="M14 42h38M14 48h28M14 54h18" stroke="#0d9488" strokeWidth="1.5" strokeLinecap="round" opacity=".5"/>
              <path d="M4 65h60" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round"/>
              {/* サーバー */}
              <rect x="76" y="24" width="36" height="50" rx="3" stroke="#0d9488" strokeWidth="2.5" fill="#ccfbf1"/>
              <rect x="82" y="30" width="24" height="8" rx="1" fill="#0d9488" opacity=".2"/>
              <circle cx="100" cy="34" r="2" fill="#0d9488"/>
              <rect x="82" y="42" width="24" height="8" rx="1" fill="#0d9488" opacity=".2"/>
              <circle cx="100" cy="46" r="2" fill="#10b981"/>
              <rect x="82" y="54" width="24" height="8" rx="1" fill="#0d9488" opacity=".2"/>
              <circle cx="100" cy="58" r="2" fill="#0d9488" opacity=".4"/>
              {/* 接続線 */}
              <path d="M58 50h18" stroke="#0d9488" strokeWidth="2" strokeDasharray="4 3"/>
              <circle cx="67" cy="50" r="2" fill="#0d9488"/>
            </svg>
          </div>
        </section>

        {/* 1. ネットワーク実機調査 */}
        <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
          <div className="flex items-center justify-between gap-2 border-l-4 border-sky-500 bg-sky-50 p-4 rounded-r-lg">
            <h2 className="text-lg font-bold text-sky-800">1. ネットワーク実機調査</h2>
            <p className="text-[11px] text-slate-600">実際にコマンドを打った結果をここに整理します。</p>
          </div>

          {/* Q1: 自端末の基本情報（旧Q1+Q2統合） */}
          <div className="relative space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="absolute top-3 right-3">
              <svg className="shrink-0" width="64" height="64" viewBox="0 0 80 80" fill="none" aria-hidden overflow="hidden">
                <rect x="10" y="16" width="60" height="40" rx="4" stroke="#0d9488" strokeWidth="2.5" fill="#ccfbf1"/>
                <rect x="16" y="22" width="48" height="28" rx="2" fill="white" stroke="#0d9488" strokeWidth="1"/>
                <text x="19" y="34" fill="#0d9488" fontSize="6" fontFamily="monospace" fontWeight="bold">IP: 192.168.x.x</text>
                <text x="19" y="42" fill="#94a3b8" fontSize="5" fontFamily="monospace">Mask: 255.255.x.0</text>
                <text x="19" y="48" fill="#94a3b8" fontSize="5" fontFamily="monospace">GW: 192.168.x.1</text>
                <path d="M6 56h68" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round"/>
                <rect x="26" y="58" width="28" height="3" rx="1" fill="#0d9488" opacity=".3"/>
              </svg>
            </div>
            <p className="text-xs font-semibold text-sky-600">Q1. 自端末の基本情報</p>
            <p className="text-[11px] text-slate-600 pr-16">
              自分のPCのIPアドレス・サブネットマスク・デフォルトゲートウェイ・MACアドレスを調べて記録します。
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="text-[11px] text-slate-600">
                IPアドレス
                <input type="text" value={state.practical.q1Ip} onChange={(e) => handlePracticalChange('q1Ip', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50" placeholder="IPアドレス" />
              </label>
              <label className="text-[11px] text-slate-600">
                サブネットマスク
                <input type="text" value={state.practical.q1Mask} onChange={(e) => handlePracticalChange('q1Mask', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50" placeholder="サブネットマスク" />
              </label>
              <label className="text-[11px] text-slate-600">
                デフォルトゲートウェイ
                <input type="text" value={state.practical.q1Dg} onChange={(e) => handlePracticalChange('q1Dg', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50" placeholder="デフォルトゲートウェイ" />
              </label>
              <label className="text-[11px] text-slate-600">
                MACアドレス
                <input type="text" value={state.practical.q1Mac} onChange={(e) => handlePracticalChange('q1Mac', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50" placeholder="MACアドレス" />
              </label>
            </div>
          </div>

          {/* Q2: 疎通確認 Ping（旧Q3） */}
          <div className="relative space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="absolute top-3 right-3">
              <svg className="shrink-0" width="64" height="64" viewBox="0 0 70 70" fill="none" aria-hidden>
                <rect x="4" y="20" width="20" height="30" rx="3" stroke="#10b981" strokeWidth="2.5" fill="#d1fae5"/>
                <rect x="46" y="20" width="20" height="30" rx="3" stroke="#10b981" strokeWidth="2.5" fill="#d1fae5"/>
                <path d="M24 30h22" stroke="#10b981" strokeWidth="2" markerEnd="url(#arrowG)"/>
                <path d="M46 40H24" stroke="#10b981" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#arrowG2)"/>
                <circle cx="35" cy="30" r="2" fill="#10b981"/>
                <circle cx="35" cy="40" r="2" fill="#10b981" opacity=".5"/>
                <text x="26" y="56" fill="#10b981" fontSize="7" fontWeight="bold">PING</text>
                <defs><marker id="arrowG" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L6 3L0 6Z" fill="#10b981"/></marker><marker id="arrowG2" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L6 3L0 6Z" fill="#10b981" opacity=".5"/></marker></defs>
              </svg>
            </div>
            <p className="text-xs font-semibold text-sky-600">Q2. 疎通確認（Ping）</p>
              <p className="text-[11px] text-slate-600 pr-16">pingコマンドの実行結果をそのまま貼り付けてください。pingが失敗した場合（ファイアウォール等）も、その結果をそのまま記録してください。</p>
              <textarea
                value={state.practical.q3PingResult}
                onChange={(e) => handlePracticalChange('q3PingResult', e.target.value)}
                className="mt-1 h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                placeholder="例: ping 8.8.8.8 の結果をそのまま貼り付け（成功・失敗どちらでも可）"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePingCheck}
                  className="rounded-lg border border-sky-500 bg-white px-3 py-1.5 text-xs font-medium text-sky-600 hover:bg-sky-50"
                >
                  Pingログを判定する
                </button>
                {pingCheck.checked && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] ${pingCheck.pass
                      ? 'border border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border border-amber-300 bg-amber-50 text-amber-700'
                      }`}
                  >
                    {pingCheck.message}
                  </span>
                )}
              </div>
          </div>

          {/* Q3: 経路確認（旧Q4） */}
          <div className="relative space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="absolute top-3 right-3">
              <svg className="shrink-0" width="64" height="64" viewBox="0 0 70 70" fill="none" aria-hidden>
                <circle cx="10" cy="35" r="7" stroke="#10b981" strokeWidth="2.5" fill="#d1fae5"/>
                <circle cx="30" cy="20" r="5" stroke="#10b981" strokeWidth="2" fill="#d1fae5"/>
                <circle cx="45" cy="40" r="5" stroke="#10b981" strokeWidth="2" fill="#d1fae5"/>
                <circle cx="60" cy="25" r="7" stroke="#10b981" strokeWidth="2.5" fill="#d1fae5"/>
                <path d="M17 32l8-8M35 22l6 14M50 38l5-10" stroke="#10b981" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round"/>
                <text x="6" y="58" fill="#10b981" fontSize="6" fontWeight="bold">HOP1</text>
                <text x="26" y="58" fill="#10b981" fontSize="6">HOP2</text>
                <text x="46" y="58" fill="#10b981" fontSize="6">HOP3</text>
              </svg>
            </div>
            <p className="text-xs font-semibold text-sky-600">Q3. 経路確認（tracert / traceroute）</p>
            <p className="text-[11px] text-slate-600 pr-16">経路確認コマンドの結果を貼り付けてください。OS によってコマンドが異なります。</p>
              <div className="rounded bg-slate-50 p-2 text-xs text-slate-700">
                <p><strong>Linux / Mac:</strong> <code className="bg-slate-200 px-1 rounded text-[11px]">traceroute 8.8.8.8</code></p>
                <p><strong>Windows:</strong> <code className="bg-slate-200 px-1 rounded text-[11px]">tracert 8.8.8.8</code></p>
              </div>
              <textarea
                value={state.practical.q4TraceResult}
                onChange={(e) => handlePracticalChange('q4TraceResult', e.target.value)}
                className="mt-1 h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                placeholder="経路確認コマンドの結果を貼り付けてください。"
              />
          </div>

          {/* Q4 */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-sky-600">Q4. WAN と LAN の境界線となる機器のIP</p>
            <p className="text-[11px] text-slate-600">
              自宅やオフィスのネットワークで、「ここから先がインターネット側」となる境界機器のIPアドレスを記入します。
            </p>
            <input
              type="text"
              value={state.practical.q5BoundaryIp}
              onChange={(e) => handlePracticalChange('q5BoundaryIp', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
              placeholder="境界となる機器のIPアドレス"
            />
          </div>

          {/* Q5-6 */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
              ⚠️ この課題は研修用サーバ（43.207.53.141）が起動している時間帯のみ実施できます。平日9:40〜19:00が目安です。
            </div>
            <p className="text-xs font-semibold text-sky-600">Q5-6. サーバ 43.207.53.141 への疎通・SSH接続</p>
            <p className="text-[11px] text-slate-600">
              研修用サーバ 43.207.53.141 に対して、Ping および SSH 接続を試み、実施できたらチェックを入れてください。
            </p>
            <div className="mt-2 space-y-2 text-xs text-slate-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={state.practical.q6PingServerOk}
                  onChange={(e) => handlePracticalChange('q6PingServerOk', e.target.checked)}
                  className="h-4 w-4 accent-sky-600"
                />
                <span>43.207.53.141 への Ping 疎通を確認した</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={state.practical.q7SshServerOk}
                  onChange={(e) => handlePracticalChange('q7SshServerOk', e.target.checked)}
                  className="h-4 w-4 accent-sky-600"
                />
                <span>43.207.53.141 への SSH 接続（neos-training 等）を確認した</span>
              </label>
            </div>
          </div>

          {/* Q7 */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-sky-600">Q7. 接続先サーバのIP情報</p>
            <p className="text-[11px] text-slate-600">
              SSH 接続したサーバ上で「ip addr」「ip route」などを実行し、サーバ側のIPアドレスやデフォルトゲートウェイを確認します。
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <label className="text-[11px] text-slate-600">
                IPアドレス
                <input
                  type="text"
                  value={state.practical.q8ServerIp}
                  onChange={(e) => handlePracticalChange('q8ServerIp', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                  placeholder="IPアドレス"
                />
              </label>
              <label className="text-[11px] text-slate-600">
                サブネットマスク
                <input
                  type="text"
                  value={state.practical.q8ServerMask}
                  onChange={(e) => handlePracticalChange('q8ServerMask', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                  placeholder="サブネットマスク"
                />
              </label>
              <label className="text-[11px] text-slate-600">
                デフォルトゲートウェイ
                <input
                  type="text"
                  value={state.practical.q8ServerDg}
                  onChange={(e) => handlePracticalChange('q8ServerDg', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                  placeholder="デフォルトゲートウェイ"
                />
              </label>
            </div>
          </div>

          {/* Q8 */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between">
            <p className="text-xs font-semibold text-sky-600">
              Q8. 論理積（AND 演算）によるネットワークアドレス計算（192.168.250.50 / 24）
            </p>
            <svg className="shrink-0" width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden>
              <rect x="8" y="8" width="64" height="64" rx="6" stroke="#3b82f6" strokeWidth="2.5" fill="#eff6ff"/>
              <text x="14" y="28" fill="#3b82f6" fontSize="8" fontFamily="monospace" fontWeight="bold">11000000</text>
              <text x="14" y="40" fill="#3b82f6" fontSize="8" fontFamily="monospace" fontWeight="bold">11111111</text>
              <path d="M14 44h52" stroke="#3b82f6" strokeWidth="1.5"/>
              <text x="14" y="56" fill="#1d4ed8" fontSize="8" fontFamily="monospace" fontWeight="bold">11000000</text>
              <text x="54" y="20" fill="#3b82f6" fontSize="10" fontWeight="bold">AND</text>
            </svg>
            </div>
            <p className="text-[11px] text-slate-600">
              192.168.250.50/24 とサブネットマスク 255.255.255.0 の論理積からネットワークアドレスを求め、その計算過程を記載してください。
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <label className="text-[11px] text-slate-600">
                ネットワークアドレス
                <input
                  type="text"
                  value={state.practical.q9NetworkAddress}
                  onChange={(e) => handlePracticalChange('q9NetworkAddress', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                  placeholder="ネットワークアドレス"
                />
              </label>
              <label className="text-[11px] text-slate-600">
                計算過程（2進数変換や AND 演算のメモ）
                <textarea
                  value={state.practical.q9Working}
                  onChange={(e) => handlePracticalChange('q9Working', e.target.value)}
                  className="mt-1 h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                  placeholder="2進数変換や AND 演算の途中式などを記載してください。"
                />
              </label>
            </div>
          </div>
        </section>

        {/* 2. 知識確認小テスト */}
        <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
          <div className="flex items-center justify-between gap-2 border-l-4 border-sky-500 bg-sky-50 p-4 rounded-r-lg">
            <div>
              <h2 className="text-lg font-bold text-sky-800">2. 知識確認小テスト（記述式）</h2>
              <p className="mt-1 text-[11px] text-slate-600">キーワードを意識しながら、自分の言葉で説明してください。</p>
            </div>
            <svg className="shrink-0" width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden>
              {/* ノート */}
              <rect x="12" y="6" width="46" height="58" rx="4" stroke="#f59e0b" strokeWidth="2.5" fill="#fffbeb"/>
              <path d="M22 20h26M22 28h20M22 36h24M22 44h16" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" opacity=".6"/>
              {/* 丸 */}
              <circle cx="58" cy="22" r="8" stroke="#10b981" strokeWidth="2.5" fill="#d1fae5"/>
              <path d="M54 22l3 3 5-6" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              {/* バツ */}
              <circle cx="58" cy="42" r="8" stroke="#ef4444" strokeWidth="2.5" fill="#fef2f2"/>
              <path d="M54 38l8 8M62 38l-8 8" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
              {/* 鉛筆 */}
              <path d="M64 56l-8 12-2 4 4-2 8-12z" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.5"/>
              <path d="M64 56l2-2 4 4-2 2z" fill="#d97706"/>
            </svg>
          </div>

          <div className="space-y-4">
            {KNOWLEDGE_QUESTIONS_21.map((q) => {
              const result = kResult[q.id]
              const answer = state.knowledgeAnswers[q.id]
              const hasChecked = result?.checked
              const isPass = result?.pass
              const feedback = result?.feedback
              return (
                <div
                  key={q.id}
                  className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-soft-card"
                >
                  <p className="text-xs font-semibold text-sky-600">{q.title}</p>
                  <textarea
                    value={answer}
                    onChange={(e) => handleKnowledgeChange(q.id, e.target.value)}
                    className="mt-1 h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                    placeholder="ここに自分の言葉で説明を書いてください。"
                  />

                  {hasChecked && (
                    <div
                      className={`mt-1 rounded-lg border px-3 py-2 text-[11px] ${isPass
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border-amber-300 bg-amber-50 text-amber-800'
                        }`}
                    >
                      <p className="font-medium">
                        {feedback ??
                          (isPass
                            ? '現場でも通用する方向性です。この調子で、自分の言葉で説明できるようにしておきましょう。'
                            : 'もう一歩です。どんな場面でその知識が役立つかをイメージしながら、文章をブラッシュアップしてみてください。')}
                      </p>
                    </div>
                  )}

                  {hasChecked && (
                    <details className="mt-2 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-[11px] text-slate-600">
                      <summary className="cursor-pointer text-sky-600">
                        プロの視点での解説（模範解答）
                      </summary>
                      <p className="mt-1 whitespace-pre-line">{q.modelAnswer}</p>
                    </details>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleKnowledgeCheck}
              className="rounded-xl bg-gradient-to-r bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700"
            >
              小テストを採点する
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:border-slate-500 hover:text-slate-800"
            >
              すべてリセットする
            </button>
          </div>
        </section>

        {/* 下部: 保存して中断 */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => { saveInfraBasic21State(state, storageKey); clearDirty(); navigate('/') }}
            className="rounded-lg border border-sky-500 px-6 py-2.5 text-sm font-medium text-sky-600 hover:bg-sky-50"
          >
            保存して中断
          </button>
        </div>
      </div>
    </div>
  )
}

