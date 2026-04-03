import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProgressKey } from './trainingWbsData'
import {
  INFRA_BASIC_3_2_CLEARED_KEY,
  INFRA_BASIC_3_2_DEFAULT_STATE,
  INFRA_BASIC_3_2_STATE_KEY,
  loadInfraBasic32State,
  saveInfraBasic32State,
} from './infraBasic3Data'
import type { InfraBasic32Answers, InfraBasic32Result } from './infraBasic3Data'
import type { MouseEvent } from 'react'
import { getCurrentDisplayName } from '../auth'
import { fetchMyProgress, postProgress, isProgressApiAvailable } from '../progressApi'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'

type QuestionId = keyof InfraBasic32Answers

type EvalResult = InfraBasic32Result

function trimNormalize(input: string): string {
  return input.replace(/\s+/g, ' ').trim()
}

function evaluateAnswer(id: QuestionId, raw: string): EvalResult {
  const answer = trimNormalize(raw)
  if (!answer) {
    return {
      checked: true,
      pass: false,
      feedback: 'まだほとんど書けていません。自分の言葉で 2〜3 行は説明してみましょう。',
    }
  }

  const len = answer.length
  const lower = answer.toLowerCase()

  const basePassFeedback =
    '概念としては良い方向です。現場では「なぜその仕組みが必要か」を一文添えると、より説得力のある説明になります。'

  switch (id) {
    case 'q1': {
      const hasHw = /ハードウェア|物理|cpu|メモリ|ディスク|resource|リソース/i.test(answer)
      const hasBridge = /仲介|橋渡し|インターフェース|抽象化|隠す|間に入る|抽象レイヤ/i.test(answer)
      const hasManage = /管理|制御|スケジューリング|割り当て|保護|アクセス制御/i.test(answer)
      const pass = len >= 30 && ((hasHw && hasBridge) || (hasHw && hasManage) || (hasBridge && hasManage))
      return {
        checked: true,
        pass,
        feedback: pass
          ? 'OS がハードウェア資源を抽象化し、アプリからの要求を仲介している点まで書けており、現場でも十分通用する説明です。'
          : '「ハードウェア資源」と「アプリケーションの要求を仲介している」という 2 点が伝わるように書き直すと、インフラエンジニアとしてより実務的な説明になります。',
      }
    }
    case 'q2': {
      const cpuMetrics = /cpu使用率|cpu 使用率|load average|ロードアベレージ|負荷平均|runnable|run queue|実行待ち/i.test(answer)
      const memMetrics = /メモリ使用率|メモリ 使用率|swap|スワップ|page ?fault|ページフォルト|OOM|アウトオブメモリ/i.test(
        answer,
      )
      const pass = len >= 30 && (cpuMetrics || memMetrics)
      return {
        checked: true,
        pass,
        feedback: pass
          ? '具体的な指標名まで書けており良いです。現場では CPU とメモリのグラフをセットで見て、「どちらが頭打ちか」を比較する癖を付けるとさらに精度が上がります。'
          : '「CPU使用率」「ロードアベレージ」「スワップ使用量」など、実際の監視画面に出てくる指標名で書くと、運用チームとの会話がスムーズになります。',
      }
    }
    case 'q3': {
      const hasBaremetal = /ベアメタル|直接|直結|native|ネイティブ/i.test(answer)
      const hasOverhead = /オーバーヘッド|層が少ない|レイヤが少ない|無駄が少ない/i.test(answer)
      const hasPerf = /性能|パフォーマンス|スループット|レイテンシ|遅延/i.test(answer)
      const pass = len >= 25 && ((hasBaremetal && hasPerf) || (hasPerf && hasOverhead))
      return {
        checked: true,
        pass,
        feedback: pass
          ? 'ベアメタル型で OS レイヤーが減り、オーバーヘッドが小さいという本質を押さえられています。サイジングの説明でも十分使える表現です。'
          : '「ホストOSを挟まないためオーバーヘッドが小さい」という観点を入れると、なぜベアメタル型が商用環境で選ばれるかが相手に伝わりやすくなります。',
      }
    }
    case 'q4': {
      const typeBare = /ベアメタル|bare metal|タイプ ?1|type ?1|ハイパーバイザー型|直接ハードウェア/i.test(answer)
      const product = /vmware|esxi/i.test(lower)
      const pass = typeBare || (product && len >= 8)
      return {
        checked: true,
        pass,
        feedback: pass
          ? '「ESXi はベアメタル型（Type1 ハイパーバイザー）」と分類できており問題ありません。設計書でもそのまま使える表現です。'
          : '「ESXi はベアメタル型（Type1 ハイパーバイザー）」と一言で分類できるように整理しておくと、製品比較の場面で迷いにくくなります。',
      }
    }
    case 'q5': {
      const hasExplain = /物理.*以上|超えて.*割り当て|実メモリ以上|オーバーコミット/i.test(answer)
      const hasRisk = /スワップ|速度低下|性能劣化|落ちる|OOM|不安定|メモリ不足/i.test(answer)
      const hasBenefit = /収容効率|集約|高密度|稼働率|コスト|無駄を減らす/i.test(answer)
      const pass = len >= 30 && hasExplain && (hasRisk || hasBenefit)
      return {
        checked: true,
        pass,
        feedback: pass
          ? 'メリットとリスクの両面に触れられており、「オーバーコミットを設計でどう許容するか」という現場の視点が出せています。'
          : '「物理メモリ以上を論理的に割り当てる」「収容効率は上がるがスワップや OOM のリスクがある」という 2 点をセットで書けると、運用チームにも伝わる説明になります。',
      }
    }
    case 'q6': {
      const mentionsCustomer = /利用者|お客様|ユーザー|われわれ|自社|アプリ側|アプリケーション側/i.test(answer)
      const mentionsResponsibility = /責任|パッチ|アップデート|更新|適用|運用/i.test(answer)
      const pass = len >= 20 && mentionsResponsibility && mentionsCustomer
      return {
        checked: true,
        pass,
        feedback: pass
          ? '「IaaS ではミドルウェアのパッチは利用者側の責任」というポイントを押さえられており、セキュリティレビューでも通用する説明です。'
          : 'AWS などの IaaS では、ハイパーバイザーや物理層はクラウド側、OS 以上のパッチは利用者側という線引きを意識して書き直してみましょう。',
      }
    }
    case 'q7': {
      const hasCommand =
        /cat\s+\/etc\/os-release|uname\s+-a|hostnamectl|systeminfo|wmic\s+os|get-ComputerInfo/i.test(answer)
      const hasVersion =
        /version|バージョン|release|NAME=|PRETTY_NAME=|Microsoft Windows|Rocky Linux|Amazon Linux|Ubuntu|Red Hat/i.test(
          answer,
        )
      const looksLikeLog = /:|=/i.test(answer) || /\[[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(answer)
      const pass = len >= 20 && hasCommand && hasVersion && looksLikeLog
      return {
        checked: true,
        pass,
        feedback: pass
          ? '実行コマンドとその結果ログまで残せており、監査証跡としてそのまま提出できるレベルです。ホスト名や日時まで入っているとなお良いです。'
          : '「実行したコマンド行」と「OS名＋バージョン行」の両方が分かるように、ターミナルのログをそのまま貼り付けるイメージで書き直してみてください。',
      }
    }
    case 'q8': {
      const mentionsAws = /aws|ec2/i.test(lower)
      const mentionsAzure = /azure|virtual machines|vm\b/i.test(lower)
      const mentionsGcp = /gcp|google cloud|compute engine/i.test(lower)
      const mentionsAd = /active directory|ad 連携|adとの親和性|ドメイン参加/i.test(lower)
      const mentionsData =
        /データ分析|bigquery|データ処理|dwh|機械学習|ml|ai プラットフォーム|分析基盤/i.test(answer)
      const mentionsContainer = /kubernetes|gke|コンテナ|マイクロサービス/i.test(answer)
      const mentionsBreadth = /サービスの網羅性|サービスが多い|ラインナップ|豊富|情報量が多い/i.test(answer)
      const mentionsService =
        /ec2\b|s3\b|simple storage service|rds\b|relational database service|virtual machines|compute engine|bigquery|gke|cloud storage/i.test(
          lower,
        )

      const hasAllClouds = mentionsAws && mentionsAzure && mentionsGcp
      const strengthHits =
        (mentionsAws && mentionsBreadth) || (mentionsAzure && mentionsAd) || (mentionsGcp && (mentionsData || mentionsContainer))

      const pass = answer.length >= 60 && hasAllClouds && strengthHits && mentionsService

      return {
        checked: true,
        pass,
        feedback: pass
          ? '3 社それぞれの強みと、向いているプロジェクト像まで書けており、クラウド選定の議論にも参加できるレベルです。'
          : 'AWS / Azure / GCP の「どんな案件に向いているか」を一社ずつ具体的に書き分けてみましょう（例: AWS=サービスが豊富で標準的、Azure=AD連携に強い、GCP=データ分析やコンテナ基盤に強い など）。',
      }
    }
    default:
      return {
        checked: true,
        pass: len >= 30,
        feedback: basePassFeedback,
      }
  }
}

export function InfraBasic32Page() {
  const navigate = useNavigate()
  const stateKey = getProgressKey(INFRA_BASIC_3_2_STATE_KEY)
  const clearedKey = getProgressKey(INFRA_BASIC_3_2_CLEARED_KEY)
  const [state, setState] = useState(() => loadInfraBasic32State(stateKey))
  const [serverSnapshot, setServerSnapshot] = useState<TraineeProgressSnapshot | null>(null)
  const [summary, setSummary] = useState<string>('')
  const [copyToast, setCopyToast] = useState<{
    visible: boolean
    x: number
    y: number
    text: string
  }>({
    visible: false,
    x: 0,
    y: 0,
    text: '',
  })

  useEffect(() => {
    document.title = 'インフラ基礎課題3-2 OS・仮想化・クラウド理解度チェック'
  }, [])

  useEffect(() => {
    const username = getCurrentDisplayName().trim().toLowerCase()
    if (!username || username === 'admin') return
    fetchMyProgress(username).then(snap => { if (snap) setServerSnapshot(snap) })
  }, [])

  const updateAnswer = (id: QuestionId, value: string) => {
    setState((prev) => {
      const next = {
        ...prev,
        answers: {
          ...prev.answers,
          [id]: value,
        },
      }
      saveInfraBasic32State(next, stateKey)
      return next
    })
  }

  const handleEvaluate = async () => {
    const nextResults: Record<QuestionId, InfraBasic32Result> = { ...INFRA_BASIC_3_2_DEFAULT_STATE.results }
      ; (Object.keys(state.answers) as QuestionId[]).forEach((id) => {
        nextResults[id] = evaluateAnswer(id, state.answers[id])
      })

    const nextState = {
      ...state,
      results: nextResults,
    }
    setState(nextState)
    saveInfraBasic32State(nextState, stateKey)

    const passCount = (Object.values(nextResults) as EvalResult[]).filter((r) => r.pass).length
    const total = Object.keys(nextResults).length
    const allPass = passCount === total

    if (typeof window !== 'undefined') {
      if (allPass) {
        window.localStorage.setItem(clearedKey, 'true')
      } else {
        window.localStorage.removeItem(clearedKey)
      }
    }

    // ① localStorage書き込み完了後にDynamoDB即時同期
    const username = getCurrentDisplayName().trim().toLowerCase()
    if (username && username !== 'admin' && isProgressApiAvailable()) {
      const base: TraineeProgressSnapshot = serverSnapshot ?? {
        introConfirmed: false, introAt: null, wbsPercent: 0, chapterProgress: [],
        currentDay: 0, delayedIds: [], updatedAt: '', pins: [],
      }
      await postProgress(username, {
        ...base,
        infra32Answers: nextState.answers,
        updatedAt: new Date().toISOString(),
      })
    }

    setSummary(
      allPass
        ? '全設問で、現場で通用するレベルの説明ができています。このまま実案件のレビュー資料にも載せられる内容です。'
        : `合格ラインに達している設問は ${passCount} / ${total} 件です。特にフィードバックが長めに出ている設問を優先的に見直してみましょう。`,
    )
  }

  const handleCopyReport = async (event?: MouseEvent<HTMLButtonElement>) => {
    const lines: string[] = []
    lines.push('【インフラ基礎課題3-2 OS・仮想化・クラウド理解度チェック】')
    lines.push('以下の通り、本課題の回答結果をご報告いたします。')
    lines.push('')
    lines.push('受講者: （氏名を記入）')
    lines.push('受講日: （記入日）')
    lines.push('')
    const qs: Record<QuestionId, string> = {
      q1: '1. OS の定義',
      q2: '2. リソース管理の指標',
      q3: '3. ベアメタル型の利点',
      q4: '4. VMware ESXi の分類',
      q5: '5. メモリオーバーコミットの概要',
      q6: '6. IaaS におけるパッチ適用の責任',
      q7: '7. ゲスト OS バージョンの実機エビデンス',
      q8: '8. AWS / Azure / GCP の強みと適したプロジェクト',
    }
    let passCount = 0
    const ids = Object.keys(qs) as QuestionId[]

    ids.forEach((id) => {
      const result = state.results[id]
      lines.push(`■ ${qs[id]}`)
      lines.push(`回答: ${state.answers[id] || '(未入力)'}`)
      lines.push(`判定: ${result.checked ? (result.pass ? '合格' : '要再考') : '未判定'}`)
      if (result.feedback) {
        lines.push(`コメント: ${result.feedback}`)
      }
      lines.push('')
      if (result.pass) {
        passCount += 1
      }
    })

    const total = ids.length
    const allPass = passCount === total
    lines.push(
      `今回の判定結果: ${allPass ? '全問クリア' : '要再学習'}（合格 ${passCount} / 全 ${total} 問）`,
    )
    lines.push('')
    lines.push('以上、インフラ基礎課題3-2 の結果報告となります。')

    const text = lines.join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setSummary('研修担当者へ提出用のテキストをクリップボードにコピーしました。メールやチャットに貼り付けてください。')
      const baseX = typeof window !== 'undefined' ? window.innerWidth - 260 : 20
      const baseY = typeof window !== 'undefined' ? window.innerHeight - 120 : 20
      const x = event ? event.clientX + 16 : baseX
      const y = event ? event.clientY + 16 : baseY
      setCopyToast({
        visible: true,
        x,
        y,
        text: '研修担当への報告用テキストをコピーしました。',
      })
      setTimeout(() => {
        setCopyToast((prev) => ({ ...prev, visible: false }))
      }, 3000)
    } catch {
      setSummary('クリップボードへのコピーに失敗しました。選択して Ctrl+C / Cmd+C でコピーしてください。')
      const baseX = typeof window !== 'undefined' ? window.innerWidth - 260 : 20
      const baseY = typeof window !== 'undefined' ? window.innerHeight - 120 : 20
      const x = event ? event.clientX + 16 : baseX
      const y = event ? event.clientY + 16 : baseY
      setCopyToast({
        visible: true,
        x,
        y,
        text: 'コピーに失敗しました。画面下のメッセージを確認してください。',
      })
      setTimeout(() => {
        setCopyToast((prev) => ({ ...prev, visible: false }))
      }, 3000)
    }
  }

  const resetAll = () => {
    setState(INFRA_BASIC_3_2_DEFAULT_STATE)
    setSummary('')
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(stateKey)
      window.localStorage.removeItem(clearedKey)
    }
  }

  const renderStatusBadge = (id: QuestionId) => {
    const r = state.results[id]
    if (!r.checked) return null
    const color =
      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ' +
      (r.pass
        ? 'border border-emerald-500/60 bg-emerald-600/20 text-emerald-200'
        : 'border border-amber-500/60 bg-amber-600/10 text-amber-100')
    return <span className={color}>{r.pass ? '現場レベルで合格' : '方向性は良いが要ブラッシュアップ'}</span>
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">TRAINING · INFRA BASIC</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-800">
              インフラ基礎課題3-2 OS・仮想化・クラウド 理解度チェック
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            トップへ戻る
          </button>
        </div>

        {/* Q1〜Q8 */}
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card text-[11px]">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-slate-800">
                1. OS の定義 — OS がハードウェアとソフトウェアの間で担っている役割
              </p>
              {renderStatusBadge('q1')}
            </div>
            <p className="text-slate-400">
              OS が「何と何の間に立ち」「どのように資源を管理しているか」を、一文で言い切るつもりで書いてみましょう。
            </p>
            <textarea
              value={state.answers.q1}
              onChange={(e) => updateAnswer('q1', e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-[11px] text-slate-800 outline-none ring-1 ring-slate-300 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/40"
              placeholder="OS の役割を、自分の言葉と技術的な根拠を交えて 30 文字以上で記述してください。"
            />
            {state.results.q1.feedback && (
              <p className="mt-1 text-[11px] text-slate-600">コメント: {state.results.q1.feedback}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-slate-800">
                2. リソース管理 — CPU とメモリのどちらがボトルネックか判断する指標を 1 つ
              </p>
              {renderStatusBadge('q2')}
            </div>
            <p className="text-slate-400">
              実際の監視画面に出てくる指標名（CPU 使用率、ロードアベレージ、スワップ使用量 など）と、なぜそれを見るのかをセットで書いてみましょう。
            </p>
            <textarea
              value={state.answers.q2}
              onChange={(e) => updateAnswer('q2', e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-[11px] text-slate-800 outline-none ring-1 ring-slate-300 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/40"
              placeholder="CPU / メモリのボトルネック判断に使う指標と、その指標から何が分かるかを 30 文字以上で記述してください。"
            />
            {state.results.q2.feedback && (
              <p className="mt-1 text-[11px] text-slate-600">コメント: {state.results.q2.feedback}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-slate-800">
                3. 仮想化方式 — ホスト型と比較したベアメタル型（ESXi 等）のパフォーマンス上の利点
              </p>
              {renderStatusBadge('q3')}
            </div>
            <p className="text-slate-400">
              「どのレイヤが減ることで、何のオーバーヘッドが小さくなるのか」を意識して書いてみてください。性能以外のメリット（安定性など）に触れても構いません。
            </p>
            <textarea
              value={state.answers.q3}
              onChange={(e) => updateAnswer('q3', e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-[11px] text-slate-800 outline-none ring-1 ring-slate-300 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/40"
              placeholder="ベアメタル型とホスト型のレイヤ構成の違いが性能にどう影響するかを、30 文字以上で説明してください。"
            />
            {state.results.q3.feedback && (
              <p className="mt-1 text-[11px] text-slate-600">コメント: {state.results.q3.feedback}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-slate-800">4. 製品分類 — VMware ESXi はどのハイパーバイザー型か</p>
              {renderStatusBadge('q4')}
            </div>
            <p className="text-slate-400">
              一言で分類したうえで、ホスト型との違いを 1 行添えると現場でも使いやすい表現になります。
            </p>
            <textarea
              value={state.answers.q4}
              onChange={(e) => updateAnswer('q4', e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-[11px] text-slate-800 outline-none ring-1 ring-slate-300 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/40"
              placeholder="VMware ESXi が属するハイパーバイザーの種類と特徴を、正しい用語を用いて 30 文字以上で記述してください。"
            />
            {state.results.q4.feedback && (
              <p className="mt-1 text-[11px] text-slate-600">コメント: {state.results.q4.feedback}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-slate-800">
                5. メモリ共有 — 物理メモリ以上を割り当てる「メモリオーバーコミット」の概要
              </p>
              {renderStatusBadge('q5')}
            </div>
            <p className="text-slate-400">
              メリット（収容効率）とリスク（スワップ・OOM）をセットで説明できると、設計レビューでも通用する文章になります。
            </p>
            <textarea
              value={state.answers.q5}
              onChange={(e) => updateAnswer('q5', e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-[11px] text-slate-800 outline-none ring-1 ring-slate-300 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/40"
              placeholder="メモリオーバーコミットの仕組みとメリット・リスクを、技術的な根拠を含めて 30 文字以上で記述してください。"
            />
            {state.results.q5.feedback && (
              <p className="mt-1 text-[11px] text-slate-600">コメント: {state.results.q5.feedback}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-slate-800">
                6. 責任共有モデル — IaaS でミドルウェアのパッチ適用を誰が行うべきか
              </p>
              {renderStatusBadge('q6')}
            </div>
            <p className="text-slate-400">
              「どこまでがクラウド事業者」「どこからが利用者」の線引きを意識して書いてください。セキュリティインシデントの責任範囲に直結する考え方です。
            </p>
            <textarea
              value={state.answers.q6}
              onChange={(e) => updateAnswer('q6', e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-[11px] text-slate-800 outline-none ring-1 ring-slate-300 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/40"
              placeholder="IaaS における責任共有モデルを踏まえ、ミドルウェアのパッチ適用を誰が担うべきかを 30 文字以上で記述してください。"
            />
            {state.results.q6.feedback && (
              <p className="mt-1 text-[11px] text-slate-600">コメント: {state.results.q6.feedback}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-slate-800">
                7. クラウド3社の強み — どのようなプロジェクトに適しているか
              </p>
              {renderStatusBadge('q8')}
            </div>
            <p className="text-slate-400">
              AWS / Azure / GCP それぞれについて、「どんな特徴があり、どのような案件に向いているか」を書いてください。サービス名（EC2 / Virtual Machines
              / Compute Engine など）を交えられるとベターです。
            </p>
            <textarea
              value={state.answers.q8}
              onChange={(e) => updateAnswer('q8', e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-[11px] text-slate-800 outline-none ring-1 ring-slate-300 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/40"
              placeholder="AWS / Azure / GCP の強みと適したプロジェクトを、具体的なクラウドサービス名も交えて 30 文字以上で記述してください。"
            />
            {state.results.q8.feedback && (
              <p className="mt-1 text-[11px] text-slate-600">コメント: {state.results.q8.feedback}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-slate-800">
                8. 実機エビデンス — ゲスト OS の正確なバージョンと確認コマンドの実行ログ
              </p>
              {renderStatusBadge('q7')}
            </div>
            <p className="text-slate-400">
              実際に VM 上でコマンドを実行し、その結果をそのまま貼り付けてください。監査やトラブルシュートで「本当にその OS バージョンだったのか」を証明するためのログです。
            </p>
            <textarea
              value={state.answers.q7}
              onChange={(e) => updateAnswer('q7', e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-[11px] text-slate-800 outline-none ring-1 ring-slate-300 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/40"
              placeholder={`実際に実行した OS バージョン確認コマンドと、その結果ログをそのまま貼り付けてください。`}
            />
            {state.results.q7.feedback && (
              <p className="mt-1 text-[11px] text-slate-600">コメント: {state.results.q7.feedback}</p>
            )}
          </div>
        </section>

        {/* アクション行 */}
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-[11px] text-slate-700 shadow-soft-card sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1" />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleEvaluate}
              className="rounded-xl bg-gradient-to-r bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-soft-card hover:bg-indigo-700"
            >
              採点する
            </button>
            <button
              type="button"
              onClick={(e) => handleCopyReport(e)}
              className="rounded-xl border border-emerald-500/60 bg-emerald-600/10 px-4 py-2 text-xs font-semibold text-emerald-100 hover:border-emerald-400 hover:bg-emerald-600/20"
            >
              研修担当へ報告用テキストを生成
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              入力内容をすべてリセット
            </button>
          </div>
        </section>

        {summary && <p className="text-[11px] text-slate-600">{summary}</p>}

        {copyToast.visible && (
          <div
            className="pointer-events-none fixed z-50 rounded-2xl border border-emerald-400/70 bg-white/95 px-3 py-2 text-[11px] text-emerald-50 shadow-xl"
            style={{
              left: copyToast.x,
              top: copyToast.y,
            }}
          >
            {copyToast.text}
          </div>
        )}
      </div>
    </div>
  )
}

