import { useEffect, useState } from 'react'
import { getTaskProgressList } from './trainingWbsData'

function getTrainingUrl(path: string) {
  const base =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname || '/'}`.replace(/\/$/, '') || window.location.origin
      : ''
  return `${base}#${path}`
}

const TASKS = [
  {
    category: '課題2-1 · ネットワーク実践',
    title: 'ネットワーク実機調査',
    description: '自端末やLAN内の機器・サーバを実際に調査し、IP情報や疎通確認結果をフォームに記録します。',
    path: '/training/infra-basic-2-1',
  },
  {
    category: '課題2-2 · TCP/IP',
    title: 'TCP/IP 理解度確認10問',
    description: 'TCP/IPの基礎知識を10問のクイズで確認します。',
    path: '/training/linux-level2',
  },
]

const SECTIONS = [
  {
    id: 'ip',
    icon: '🌐',
    title: 'IPアドレスとは',
    content: (
      <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
        <p>
          <strong>IPアドレス（Internet Protocol Address）</strong>は、ネットワーク上の機器を識別するための番号です。
          現実世界の「住所」に相当し、データを届ける先を指定するために使われます。
        </p>
        <p>
          現在広く使われている <strong>IPv4</strong> では <code className="bg-slate-100 px-1 rounded text-xs">192.168.1.10</code> のように
          0〜255の数字を4つドットで区切った形式（32ビット）で表します。
          世界中のIPv4アドレスは約43億個しかなく、枯渇したため次世代の <strong>IPv6</strong>（128ビット）への移行が進んでいます。
        </p>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <p className="font-semibold text-slate-600 text-xs mb-1">代表的なIPアドレスの種類</p>
          <ul className="space-y-1 text-xs">
            <li><span className="font-medium">プライベートIP</span>：社内・家庭内LAN用（例: 192.168.x.x / 10.x.x.x）</li>
            <li><span className="font-medium">グローバルIP</span>：インターネット上で一意に識別される外部向けアドレス</li>
            <li><span className="font-medium">ループバック</span>：自分自身を指す特殊なアドレス（127.0.0.1）</li>
          </ul>
        </div>
        <p className="text-xs text-slate-500">
          コマンド: <code className="bg-slate-100 px-1 rounded">ip a</code>（Linux）/ <code className="bg-slate-100 px-1 rounded">ipconfig</code>（Windows）で自端末のIPアドレスを確認できます。
        </p>
      </div>
    ),
  },
  {
    id: 'mac',
    icon: '🔌',
    title: 'MACアドレスとは',
    content: (
      <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
        <p>
          <strong>MACアドレス（Media Access Control Address）</strong>は、ネットワーク機器のハードウェアに割り当てられた
          物理的な識別番号です。NIC（ネットワークインターフェースカード）ごとに製造時に設定され、
          原則として世界中で一意です。
        </p>
        <p>
          <code className="bg-slate-100 px-1 rounded text-xs">00:1A:2B:3C:4D:5E</code> のように
          16進数を2桁ずつコロン区切りで6組（48ビット）表記します。
          前半3組はメーカー識別コード（OUI）、後半3組はメーカーが付ける固有番号です。
        </p>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <p className="font-semibold text-slate-600 text-xs mb-1">IPアドレスとの違い</p>
          <ul className="space-y-1 text-xs">
            <li><span className="font-medium">MACアドレス</span>：ハードウェア固有・同一LAN内での通信に使用（L2層）</li>
            <li><span className="font-medium">IPアドレス</span>：ネットワーク設定で変更可能・異なるネットワーク間の通信に使用（L3層）</li>
          </ul>
        </div>
        <p className="text-xs text-slate-500">
          コマンド: <code className="bg-slate-100 px-1 rounded">ip link</code>（Linux）で確認できます。ARPプロトコルがIPとMACを対応付けます。
        </p>
      </div>
    ),
  },
  {
    id: 'lan-wan',
    icon: '🏠',
    title: 'LANとWANとは',
    content: (
      <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
        <p>
          <strong>LAN（Local Area Network）</strong>は、建物内や敷地内など限られた範囲のネットワークです。
          家庭のWi-Fiや会社のオフィスネットワークが代表例で、高速・低遅延・自前管理が特徴です。
        </p>
        <p>
          <strong>WAN（Wide Area Network）</strong>は、複数のLANをつなぐ広域ネットワークです。
          インターネット自体が世界規模のWANです。ISP（インターネットサービスプロバイダ）を通じて接続し、
          速度はLANより遅く、遅延も大きくなります。
        </p>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <p className="font-semibold text-slate-600 text-xs mb-1">ネットワーク構成のイメージ</p>
          <p className="text-xs text-slate-600">
            自端末 → （LAN）→ ルーター → （WAN / インターネット）→ 外部サーバー
          </p>
          <p className="mt-1 text-xs text-slate-500">
            ルーターがLANとWANの境界となり、プライベートIPとグローバルIPの変換（NAT）を担います。
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'ping',
    icon: '📡',
    title: 'pingとは',
    content: (
      <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
        <p>
          <strong>ping</strong> は、指定した相手ホストに <strong>ICMPエコー要求</strong>パケットを送り、
          返ってくる <strong>ICMPエコー応答</strong>を確認することで「相手に届くか・どれくらい時間がかかるか」を確かめるコマンドです。
          ネットワーク疎通確認の基本ツールです。
        </p>
        <div className="bg-slate-100 rounded-lg p-3 font-mono text-xs text-slate-700">
          <p className="text-slate-500 mb-1"># 基本的な使い方</p>
          <p>ping 192.168.1.1</p>
          <p>ping google.com</p>
          <p className="mt-2 text-slate-500"># 回数を指定（Linux）</p>
          <p>ping -c 4 192.168.1.1</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <p className="font-semibold text-slate-600 text-xs mb-1">結果の読み方</p>
          <ul className="space-y-1 text-xs">
            <li><span className="font-medium">time=</span>：往復時間（RTT）。数値が小さいほど応答が速い</li>
            <li><span className="font-medium">TTL=</span>：パケットが通過できるルーター数の上限（生存時間）</li>
            <li><span className="font-medium">Request timeout</span>：パケットが届かない・または応答が返らない</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'traceroute',
    icon: '🗺️',
    title: 'tracerouteとは',
    content: (
      <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
        <p>
          <strong>traceroute</strong>（Windowsでは <code className="bg-slate-100 px-1 rounded text-xs">tracert</code>）は、
          パケットが目的地に届くまでに経由する <strong>ルーターの一覧と遅延</strong>を表示するコマンドです。
          pingで「届かない」とわかった時に、どの経路で詰まっているかを特定するために使います。
        </p>
        <div className="bg-slate-100 rounded-lg p-3 font-mono text-xs text-slate-700">
          <p className="text-slate-500 mb-1"># Linux</p>
          <p>traceroute google.com</p>
          <p className="mt-2 text-slate-500"># Windows</p>
          <p>tracert google.com</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <p className="font-semibold text-slate-600 text-xs mb-1">仕組み</p>
          <p className="text-xs text-slate-600">
            TTL（生存時間）を1から順番に増やしながらパケットを送ります。
            TTLが0になったルーターは「時間超過」エラーを返すため、
            そのルーターのIPアドレスと遅延が一覧に表示されます。
            <code className="ml-1 bg-slate-100 px-1 rounded">* * *</code> はICMPを拒否しているルーターです。
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'ssh',
    icon: '🔐',
    title: 'SSHとは',
    content: (
      <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
        <p>
          <strong>SSH（Secure Shell）</strong>は、ネットワーク越しに別のコンピューターへ<strong>暗号化された安全な経路</strong>で
          ログインし、コマンドを実行するためのプロトコルです。
          かつて使われていたTelnetは通信が平文でしたが、SSHはすべて暗号化されます。
        </p>
        <div className="bg-slate-100 rounded-lg p-3 font-mono text-xs text-slate-700">
          <p className="text-slate-500 mb-1"># パスワード認証</p>
          <p>ssh user@192.168.1.10</p>
          <p className="mt-2 text-slate-500"># 鍵認証（PEMファイル指定）</p>
          <p>ssh -i ~/.ssh/key.pem user@192.168.1.10</p>
          <p className="mt-2 text-slate-500"># ポート指定</p>
          <p>ssh -p 2222 user@192.168.1.10</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <p className="font-semibold text-slate-600 text-xs mb-1">公開鍵認証の仕組み</p>
          <ul className="space-y-1 text-xs text-slate-600">
            <li>① 秘密鍵（手元に保管）と公開鍵（サーバーに登録）のペアを生成</li>
            <li>② 接続時にサーバーが公開鍵で暗号化したデータを送信</li>
            <li>③ 秘密鍵でのみ復号できるため、鍵を持つ本人だけが認証成功</li>
          </ul>
          <p className="mt-1 text-xs text-slate-500">
            本研修のサーバーはPEM形式の秘密鍵を使った公開鍵認証で接続します。
          </p>
        </div>
      </div>
    ),
  },
]

export function InfraBasic2TopPage() {
  const taskProgress = getTaskProgressList().find((t) => t.id === 'infra-basic-2')
  const subTasks = taskProgress?.subTasks ?? []

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    Object.fromEntries(SECTIONS.map((s) => [s.id, true]))
  )

  useEffect(() => {
    document.title = 'ネットワーク基礎'
  }, [])

  const totalCount = TASKS.length
  const completedCount = subTasks.filter((s) => s.status === 'cleared').length

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-2xl space-y-6">

        <div>
          <h1 className="text-lg font-bold text-slate-800">ネットワーク基礎</h1>
          <p className="mt-1 text-sm text-slate-600">
            ネットワーク実機を用いた調査・記述問題と、TCP/IP理解度確認10問の2つで構成されています。
          </p>
          {taskProgress && (
            <p className="mt-1 text-[11px] text-slate-600">
              目安 {taskProgress.estimatedDays} 日目まで · 期限 {taskProgress.deadline}
              {taskProgress.isDelayed && (
                <span className="ml-2 text-rose-400">遅延</span>
              )}
            </p>
          )}
        </div>

        {/* 進捗サマリー */}
        <div className="flex items-center gap-3">
          <span className="text-body md:text-body-pc font-semibold text-sky-700">
            {completedCount} / {totalCount} 完了
          </span>
          <div className="h-1.5 flex-1 max-w-[120px] bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-sky-300 rounded-full transition-all duration-300" style={{ width: `${(completedCount / totalCount) * 100}%` }} />
          </div>
        </div>

        {/* 座学セクション */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">座学</p>
          {SECTIONS.map((section) => (
            <div
              key={section.id}
              className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden"
            >
              <button
                type="button"
                className="w-full flex items-center justify-between px-5 py-4 text-left"
                onClick={() => toggleSection(section.id)}
              >
                <span className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                  <span>{section.icon}</span>
                  <span>{section.title}</span>
                </span>
                <span className={`text-slate-400 transition-transform duration-200 ${openSections[section.id] ? 'rotate-180' : ''}`}>
                  ▾
                </span>
              </button>
              {openSections[section.id] && (
                <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                  {section.content}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 実習課題 区切り */}
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide shrink-0">実習課題</p>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {/* リスト型課題カード */}
        <div className="flex flex-col rounded-xl border border-slate-200 overflow-hidden bg-white">
          {TASKS.map((task, index) => {
            const sub = subTasks[index]
            const isCompleted = sub?.status === 'cleared'
            const isPrevDone = index === 0 || subTasks[index - 1]?.status !== 'not_started'
            const isLocked = !isPrevDone

            return (
              <div
                key={task.path}
                className={`flex items-center justify-between px-6 py-5 ${index < TASKS.length - 1 ? 'border-b border-slate-100' : ''} ${isCompleted ? 'bg-green-50' : isLocked ? 'bg-slate-50' : 'bg-white'} ${isLocked ? 'opacity-60' : ''}`}
              >
                {/* 完了チェック円 */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mr-4 font-semibold ${isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                  {isCompleted ? '✓' : index + 1}
                </div>

                <div className="flex-1">
                  <div className="text-label md:text-label-pc text-slate-400 mb-0.5">{task.category}</div>
                  <div className={`text-heading md:text-heading-pc font-semibold mb-0.5 ${isLocked ? 'text-slate-400' : 'text-slate-800'}`}>
                    {task.title}
                  </div>
                  <div className="text-label md:text-label-pc text-slate-400">
                    {isLocked ? `課題${index}を先に完了してください` : task.description}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <button
                    type="button"
                    onClick={isLocked ? undefined : () => { window.location.href = getTrainingUrl(task.path) }}
                    disabled={isLocked}
                    className={`rounded-lg transition-colors px-4 py-2 font-medium ${
                      isLocked ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 cursor-pointer'
                    }`}
                  >
                    開く
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
