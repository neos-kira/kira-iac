import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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

function copyToClipboard(text: string): Promise<boolean> {
  const doFallback = (): boolean => {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, text.length)
    let ok = false
    try {
      ok = document.execCommand('copy')
    } finally {
      document.body.removeChild(ta)
    }
    return ok
  }
  if (typeof navigator?.clipboard?.writeText === 'function') {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => doFallback())
  }
  return Promise.resolve(doFallback())
}

export function InfraBasic21Page() {
  const navigate = useNavigate()
  const storageKey = getProgressKey(INFRA_BASIC_21_STORAGE_KEY)
  const [state, setState] = useState<InfraBasic21StoredState>(() => loadInfraBasic21State(storageKey))
  const [copiedReport, setCopiedReport] = useState(false)
  const [hintOpen, setHintOpen] = useState<Record<string, boolean>>({})
  const [pingCheck, setPingCheck] = useState<{ checked: boolean; pass: boolean; message: string }>({
    checked: false,
    pass: false,
    message: '',
  })

  useEffect(() => {
    document.title = 'インフラ基礎課題2-1 ネットワーク実践編'
  }, [])

  const updateState = useCallback((updater: (prev: InfraBasic21StoredState) => InfraBasic21StoredState) => {
    setState((prev) => {
      const next = updater(prev)
      saveInfraBasic21State(next, storageKey)
      return next
    })
  }, [storageKey])

  const handlePracticalChange = useCallback(
    (field: keyof InfraBasic21StoredState['practical'], value: string | boolean) => {
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
    setCopiedReport(false)
  }, [updateState])

  const handleCopyReport = useCallback(() => {
    const lines: string[] = []
    const { practical, knowledgeAnswers } = state

    lines.push('【インフラ基礎課題2-1 ネットワーク実践編 提出内容】')
    lines.push('')
    lines.push('■ 1. ネットワーク実機調査')
    lines.push('▼ Q1. 自端末の調査')
    lines.push(`IPアドレス: ${practical.q1Ip}`)
    lines.push(`サブネットマスク: ${practical.q1Mask}`)
    lines.push(`デフォルトゲートウェイ: ${practical.q1Dg}`)
    lines.push(`MACアドレス: ${practical.q1Mac}`)
    lines.push('')
    lines.push('▼ Q2. LAN内機器の調査')
    lines.push(practical.q2Devices || '(未入力)')
    lines.push('')
    lines.push('▼ Q3. 疎通確認 (Ping)')
    lines.push(practical.q3PingResult || '(未入力)')
    lines.push('')
    lines.push('▼ Q4. 経路確認 (tracert / traceroute 等)')
    lines.push(practical.q4TraceResult || '(未入力)')
    lines.push('')
    lines.push('▼ Q5. 境界線となる機器のIPアドレス')
    lines.push(practical.q5BoundaryIp || '(未入力)')
    lines.push('')
    lines.push('▼ Q6-7. サーバ接続確認')
    lines.push(`43.207.53.141 へのPing疎通: ${practical.q6PingServerOk ? '実施済み' : '未チェック'}`)
    lines.push(`43.207.53.141 へのSSH接続: ${practical.q7SshServerOk ? '実施済み' : '未チェック'}`)
    lines.push('')
    lines.push('▼ Q8. 接続先サーバのIP情報')
    lines.push(`IPアドレス: ${practical.q8ServerIp}`)
    lines.push(`サブネットマスク: ${practical.q8ServerMask}`)
    lines.push(`デフォルトゲートウェイ: ${practical.q8ServerDg}`)
    lines.push('')
    lines.push('▼ Q9. 論理積によるネットワークアドレス計算')
    lines.push(`ネットワークアドレス: ${practical.q9NetworkAddress}`)
    lines.push('計算過程:')
    lines.push(practical.q9Working || '(未入力)')

    lines.push('')
    lines.push('■ 2. 知識確認小テスト（記述式）')
    for (const q of KNOWLEDGE_QUESTIONS_21) {
      lines.push(`▼ ${q.title}`)
      lines.push(knowledgeAnswers[q.id] || '(未入力)')
      lines.push('')
    }

    const payload = lines.join('\n')
    copyToClipboard(payload).then((ok) => {
      if (ok) {
        setCopiedReport(true)
        window.setTimeout(() => setCopiedReport(false), 2500)
      }
    })
  }, [state])

  const kResult = state.knowledgeResult

  const toggleHint = (id: string) => {
    setHintOpen((prev) => ({ ...prev, [id]: !prev[id] }))
  }

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
    const lower = text.toLowerCase()

    if (!text) {
      return {
        pass: false,
        message: '実行コマンドを含めたログ全体を貼り付けてください。',
      }
    }

    // 1. コマンドの妥当性: ping xxx が含まれているか
    const hasPingCommand = /(^|\n)\s*ping\s+\S+/i.test(text)
    if (!hasPingCommand) {
      return {
        pass: false,
        message: '実行コマンドを含めたログ全体を貼り付けてください。',
      }
    }

    // 2. 明らかな失敗パターン
    const failurePatterns = [
      'request timed out',
      '100% packet loss',
      '100% loss',
      'destination host unreachable',
      'could not find host',
      'unknown host',
      'general failure',
    ]
    if (failurePatterns.some((p) => lower.includes(p))) {
      return {
        pass: false,
        message: '宛先への疎通が確認できません。正常に応答があったログを提出してください。',
      }
    }

    // 3. 成功判定: Windows と Linux/Mac の代表的な成功文言
    const windowsSuccess = /損失[^0-9]*0[^0-9]*\(\s*0%\s*の損失\)/.test(text) || /loss = 0%\b/i.test(text)
    const unixSuccess = /0% packet loss/.test(lower)
    const hasSuccess = windowsSuccess || unixSuccess
    if (!hasSuccess) {
      return {
        pass: false,
        message: '宛先への疎通が確認できません。正常に応答があったログを提出してください。',
      }
    }

    // 4. エビデンスの真正性: ping 固有の応答行があるか（バイト数・時間・TTL 等）
    const evidencePatterns = [
      /bytes=\d+.*time[=<]?\d+/i, // Windows: bytes=32 time<1ms TTL=64
      /ttl=\d+/i,
      /\bicmp_seq=\d+.*time=\d+\.?\d* ?ms/i, // Linux: icmp_seq=1 ttl=...
    ]
    const hasEvidence = evidencePatterns.some((re) => re.test(text))
    if (!hasEvidence) {
      return {
        pass: false,
        message: 'これはpingコマンドの実行結果ではありません。コマンドプロンプトの結果をそのままコピーしてください。',
      }
    }

    return {
      pass: true,
      message: '◎ 正常な疎通ログを確認しました。宛先への到達が証明されています。',
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              TRAINING · INFRA BASIC
            </p>
            <h1 className="mt-1 text-xl font-semibold text-slate-800">インフラ基礎課題2-1 ネットワーク実践編</h1>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-500 hover:text-slate-800"
          >
            トップへ戻る
          </button>
        </div>

        {/* 説明 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
          <p className="text-sm text-slate-600">
            実際の端末・サーバ・ネットワーク機器を調査しながら、
            <span className="font-semibold text-slate-800">IP情報・疎通結果・経路・概念の理解</span>
            を記録する課題です。入力内容はブラウザに保存されるため、ページを閉じても途中から再開できます。
          </p>
        </section>

        {/* 1. ネットワーク実機調査 */}
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">1. ネットワーク実機調査</h2>
            <p className="text-[11px] text-slate-600">実際にコマンドを打った結果をここに整理します。</p>
          </div>

          {/* Q1 */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-200">Q1. 自端末の調査</p>
            <p className="text-[11px] text-slate-600">
              自分が操作している端末の IP アドレスやサブネットマスクなどの基本情報を調べて記録します。
            </p>
            <button
              type="button"
              onClick={() => toggleHint('q1')}
              className="mt-1 rounded-lg border border-slate-300 px-2 py-1 text-[10px] font-medium text-slate-600 hover:border-slate-500 hover:text-slate-800"
            >
              💡ヒントを表示
            </button>
            {hintOpen.q1 && (
              <p className="text-[10px] text-slate-600">
                Windows なら「ipconfig /all」、Linux なら「ip addr」「ip route」などのコマンドを使うと詳細な情報を確認できます。
              </p>
            )}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="text-[11px] text-slate-600">
                IPアドレス
                <input
                  type="text"
                  value={state.practical.q1Ip}
                  onChange={(e) => handlePracticalChange('q1Ip', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  placeholder="IPアドレス"
                />
              </label>
              <label className="text-[11px] text-slate-600">
                サブネットマスク
                <input
                  type="text"
                  value={state.practical.q1Mask}
                  onChange={(e) => handlePracticalChange('q1Mask', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  placeholder="サブネットマスク"
                />
              </label>
              <label className="text-[11px] text-slate-600">
                デフォルトゲートウェイ
                <input
                  type="text"
                  value={state.practical.q1Dg}
                  onChange={(e) => handlePracticalChange('q1Dg', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  placeholder="デフォルトゲートウェイ"
                />
              </label>
              <label className="text-[11px] text-slate-600">
                MACアドレス
                <input
                  type="text"
                  value={state.practical.q1Mac}
                  onChange={(e) => handlePracticalChange('q1Mac', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  placeholder="MACアドレス"
                />
              </label>
            </div>
          </div>

          {/* Q2 */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-200">Q2. LAN内機器の調査</p>
            <p className="text-[11px] text-slate-600">
              ルーター、スイッチ、NAS など LAN 内で確認できた機器について、IPアドレスとMACアドレスを整理します。
            </p>
            <button
              type="button"
              onClick={() => toggleHint('q2')}
              className="mt-1 rounded-lg border border-slate-300 px-2 py-1 text-[10px] font-medium text-slate-600 hover:border-slate-500 hover:text-slate-800"
            >
              💡ヒントを表示
            </button>
            {hintOpen.q2 && (
              <p className="text-[10px] text-slate-600">
                ルーターの管理画面やスイッチの ARP テーブルなどを参考に、IP と MAC の対応関係をメモしてみましょう。
              </p>
            )}
            <textarea
              value={state.practical.q2Devices}
              onChange={(e) => handlePracticalChange('q2Devices', e.target.value)}
              className="mt-1 h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              placeholder="LAN 内の機器と IP / MAC を列挙してください。"
            />
          </div>

          {/* Q3-4 */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-200">Q3. 疎通確認（Ping）</p>
              <p className="text-[11px] text-slate-600">疎通確認の結果をそのまま貼り付けてください。</p>
              <button
                type="button"
                onClick={() => toggleHint('q3')}
                className="rounded-lg border border-slate-300 px-2 py-1 text-[10px] font-medium text-slate-600 hover:border-slate-500 hover:text-slate-800"
              >
                💡ヒントを表示
              </button>
              {hintOpen.q3 && (
                <p className="text-[10px] text-slate-600">
                  Windows なら「ping 送信先IP」、Linux なら「ping -c 4 送信先IP」などで結果を取得し、その出力を貼り付けてください。
                </p>
              )}
              <textarea
                value={state.practical.q3PingResult}
                onChange={(e) => handlePracticalChange('q3PingResult', e.target.value)}
                className="mt-1 h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                placeholder="例：ping 8.8.8.8 を実行した結果（ログ全体）をここに貼り付け"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePingCheck}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:border-indigo-500 hover:text-slate-800"
                >
                  Pingログを判定する
                </button>
                {pingCheck.checked && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] ${pingCheck.pass
                      ? 'border border-emerald-500/70 bg-emerald-600/20 text-emerald-200'
                      : 'border border-amber-500/70 bg-amber-950/40 text-amber-100'
                      }`}
                  >
                    {pingCheck.message}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-200">Q4. 経路確認（tracert / traceroute 等）</p>
              <p className="text-[11px] text-slate-600">経路確認の結果を貼り付けてください。</p>
              <button
                type="button"
                onClick={() => toggleHint('q4')}
                className="rounded-lg border border-slate-300 px-2 py-1 text-[10px] font-medium text-slate-600 hover:border-slate-500 hover:text-slate-800"
              >
                💡ヒントを表示
              </button>
              {hintOpen.q4 && (
                <p className="text-[10px] text-slate-600">
                  Windows なら「tracert 送信先IP」、Linux なら「traceroute 送信先IP」などでホップごとの経路を確認できます。
                </p>
              )}
              <textarea
                value={state.practical.q4TraceResult}
                onChange={(e) => handlePracticalChange('q4TraceResult', e.target.value)}
                className="mt-1 h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                placeholder="経路確認コマンドの結果を貼り付けてください。"
              />
            </div>
          </div>

          {/* Q5 */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-200">Q5. WAN と LAN の境界線となる機器のIP</p>
            <p className="text-[11px] text-slate-600">
              自宅やオフィスのネットワークで、「ここから先がインターネット側」となる境界機器のIPアドレスを記入します。
            </p>
            <input
              type="text"
              value={state.practical.q5BoundaryIp}
              onChange={(e) => handlePracticalChange('q5BoundaryIp', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              placeholder="境界となる機器のIPアドレス"
            />
          </div>

          {/* Q6-7 */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-200">Q6-7. サーバ 43.207.53.141 への疎通・SSH接続</p>
            <p className="text-[11px] text-slate-600">
              研修用サーバ 43.207.53.141 に対して、Ping および SSH 接続を試み、実施できたらチェックを入れてください。
            </p>
            <div className="mt-2 space-y-2 text-xs text-slate-200">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={state.practical.q6PingServerOk}
                  onChange={(e) => handlePracticalChange('q6PingServerOk', e.target.checked)}
                  className="h-4 w-4 accent-indigo-600"
                />
                <span>43.207.53.141 への Ping 疎通を確認した</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={state.practical.q7SshServerOk}
                  onChange={(e) => handlePracticalChange('q7SshServerOk', e.target.checked)}
                  className="h-4 w-4 accent-indigo-600"
                />
                <span>43.207.53.141 への SSH 接続（neos-training 等）を確認した</span>
              </label>
            </div>
          </div>

          {/* Q8 */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-200">Q8. 接続先サーバのIP情報</p>
            <p className="text-[11px] text-slate-600">
              SSH 接続したサーバ上で「ip addr」「ip route」などを実行し、サーバ側のIPアドレスやデフォルトゲートウェイを確認します。
            </p>
            <button
              type="button"
              onClick={() => toggleHint('q8')}
              className="mt-1 rounded-lg border border-slate-300 px-2 py-1 text-[10px] font-medium text-slate-600 hover:border-slate-500 hover:text-slate-800"
            >
              💡ヒントを表示
            </button>
            {hintOpen.q8 && (
              <p className="text-[10px] text-slate-600">
                Linux サーバでは「ip addr」「ip route」「ip -4 addr show」などで IP とルーティングを確認できます。
              </p>
            )}
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <label className="text-[11px] text-slate-600">
                IPアドレス
                <input
                  type="text"
                  value={state.practical.q8ServerIp}
                  onChange={(e) => handlePracticalChange('q8ServerIp', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  placeholder="IPアドレス"
                />
              </label>
              <label className="text-[11px] text-slate-600">
                サブネットマスク
                <input
                  type="text"
                  value={state.practical.q8ServerMask}
                  onChange={(e) => handlePracticalChange('q8ServerMask', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  placeholder="サブネットマスク"
                />
              </label>
              <label className="text-[11px] text-slate-600">
                デフォルトゲートウェイ
                <input
                  type="text"
                  value={state.practical.q8ServerDg}
                  onChange={(e) => handlePracticalChange('q8ServerDg', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  placeholder="デフォルトゲートウェイ"
                />
              </label>
            </div>
          </div>

          {/* Q9 */}
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-200">
              Q9. 論理積（AND 演算）によるネットワークアドレス計算（192.168.250.50 / 24）
            </p>
            <p className="text-[11px] text-slate-600">
              192.168.250.50/24 とサブネットマスク 255.255.255.0 の論理積からネットワークアドレスを求め、その計算過程を記載してください。
            </p>
            <button
              type="button"
              onClick={() => toggleHint('q9')}
              className="mt-1 rounded-lg border border-slate-300 px-2 py-1 text-[10px] font-medium text-slate-600 hover:border-slate-500 hover:text-slate-800"
            >
              💡ヒントを表示
            </button>
            {hintOpen.q9 && (
              <p className="text-[10px] text-slate-600">
                各オクテットを 2 進数に変換し、IP アドレスとサブネットマスクを AND 演算した結果を 10 進数に戻す流れで整理すると分かりやすくなります。
              </p>
            )}
            <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <label className="text-[11px] text-slate-600">
                ネットワークアドレス
                <input
                  type="text"
                  value={state.practical.q9NetworkAddress}
                  onChange={(e) => handlePracticalChange('q9NetworkAddress', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  placeholder="ネットワークアドレス"
                />
              </label>
              <label className="text-[11px] text-slate-600">
                計算過程（2進数変換や AND 演算のメモ）
                <textarea
                  value={state.practical.q9Working}
                  onChange={(e) => handlePracticalChange('q9Working', e.target.value)}
                  className="mt-1 h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  placeholder="2進数変換や AND 演算の途中式などを記載してください。"
                />
              </label>
            </div>
          </div>
        </section>

        {/* 2. 知識確認小テスト */}
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">2. 知識確認小テスト（記述式）</h2>
            <p className="text-[11px] text-slate-600">キーワードを意識しながら、自分の言葉で説明してください。</p>
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
                  <p className="text-xs font-semibold text-slate-200">{q.title}</p>
                  <textarea
                    value={answer}
                    onChange={(e) => handleKnowledgeChange(q.id, e.target.value)}
                    className="mt-1 h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    placeholder="ここに自分の言葉で説明を書いてください。"
                  />

                  {hasChecked && (
                    <div
                      className={`mt-1 rounded-lg border px-3 py-2 text-[11px] ${isPass
                        ? 'border-emerald-500/60 bg-emerald-600/20 text-emerald-100'
                        : 'border-amber-500/60 bg-amber-950/40 text-amber-100'
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
                      <summary className="cursor-pointer text-slate-200">
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
              className="rounded-xl bg-gradient-to-r bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
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

        {/* 提出用テキスト生成 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-200">研修担当へ報告用テキストを生成</p>
              <p className="mt-1 text-[11px] text-slate-600">
                これまで入力した内容を一つのテキストにまとめてコピーします。Slackやメールに貼り付けて報告してください。
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyReport}
              className="rounded-xl bg-gradient-to-r bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              研修担当へ報告用テキストを生成
            </button>
          </div>
          {copiedReport && (
            <p className="mt-2 text-[11px] text-emerald-300">クリップボードにコピーしました。研修担当へ共有してください。</p>
          )}
        </section>
      </div>
    </div>
  )
}

