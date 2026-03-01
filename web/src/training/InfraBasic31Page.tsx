import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProgressKey } from './trainingWbsData'
import { INFRA_BASIC_3_1_DONE_KEY } from './infraBasic3Data'

export function InfraBasic31Page() {
  const navigate = useNavigate()
  const key = getProgressKey(INFRA_BASIC_3_1_DONE_KEY)
  const [ack, setAck] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(key) === 'true'
  })

  useEffect(() => {
    document.title = 'インフラ基礎課題3-1 OS・仮想化・クラウド解説'
  }, [])

  const handleAckChange = (checked: boolean) => {
    setAck(checked)
    if (typeof window !== 'undefined') {
      if (checked) window.localStorage.setItem(key, 'true')
      else window.localStorage.removeItem(key)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-8000">TRAINING · INFRA BASIC</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-800">インフラ基礎課題3-1 OS・仮想化・クラウドの理解</h1>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            トップへ戻る
          </button>
        </div>

        {/* OS と計算資源 */}
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
          <h2 className="text-sm font-semibold text-slate-800">1. OS と計算資源の最適化</h2>
          <p className="text-xs text-slate-600">
            OS はアプリケーションとハードウェアの間に立ち、CPU / メモリ / ストレージといった計算資源を抽象化・管理するレイヤーです。
            現場では「どの資源がボトルネックか」を素早く見抜けるかどうかが、トラブルシュートの速度を大きく左右します。
          </p>
          <div className="grid gap-3 md:grid-cols-3 text-[11px] text-slate-700">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-800">CPU</p>
              <p className="mt-1 text-slate-600">
                スレッドのスケジューリングを行い、誰にどれだけ CPU 時間を割り当てるかを決めます。CPU 使用率が常時 100% 付近で張り付いている場合は、
                演算待ちがボトルネックになっているサインです。
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-800">メモリ</p>
              <p className="mt-1 text-slate-600">
                プロセスごとのメモリ空間を管理し、不足するとスワップ（ディスク退避）が発生します。メモリ不足は CPU 使用率よりも
                「スワップイン/アウト量」や「ページフォルト数」に表れやすいのが現場の感覚です。
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-800">ストレージ</p>
              <p className="mt-1 text-slate-600">
                ファイルシステムとディスク I/O を仲介します。I/O 待ちが増えると、CPU は暇そうに見えても処理が進まない「I/O
                ボトルネック」状態になります。監視では IOPS / レイテンシ / ディスクキュー長などを確認します。
              </p>
            </div>
          </div>
        </section>

        {/* 仮想化アーキテクチャ */}
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
          <h2 className="text-sm font-semibold text-slate-800">2. 仮想化アーキテクチャ（VMware vSphere / ESXi）</h2>
          <p className="text-xs text-slate-600">
            仮想化は、物理リソースを論理的に分割・カプセル化し、複数のゲストOSに安全に配分する技術です。設計時には「どのレイヤーで仮想化しているか」が性能や運用性に直結します。
          </p>
          <div className="grid gap-3 md:grid-cols-2 text-[11px] text-slate-700">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-800">ホスト型ハイパーバイザー</p>
              <p className="mt-1 text-slate-600">
                既存の OS （Windows / Linux 等）の上で動作するタイプです。開発者 PC の仮想環境（例: VMware Workstation、
                VirtualBox）に向いており、導入が手軽な一方で、ホストOS分のオーバーヘッドがあり性能面では劣ります。
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-800">ベアメタル型（ハイパーバイザー型）</p>
              <p className="mt-1 text-slate-600">
                ESXi のように、ハードウェアの上に直接ハイパーバイザーが載るタイプです。余計な OS
                レイヤーがないためオーバーヘッドが少なく、商用環境での標準構成となっています。vSphere
                などで一括管理する前提の設計です。
              </p>
            </div>
          </div>
        </section>

        {/* クラウドコンピューティング */}
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
          <h2 className="text-sm font-semibold text-slate-800">3. クラウドコンピューティングのサービスモデル</h2>
          <p className="text-xs text-slate-600">
            クラウドでは「どこまでをクラウド事業者が持ち、どこからが利用者の責任か」を明確にした責任共有モデルが前提になります。IaaS / PaaS / SaaS
            の違いを、運用範囲の違いとして押さえておくことが重要です。
          </p>

          {/* 主要クラウドプラットフォームの特性比較 */}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[11px] text-slate-700">
            <p className="text-[11px] font-semibold text-slate-800">主要クラウドプラットフォームの特性比較</p>
            <p className="text-slate-600">
              どのクラウドを選ぶかは「好き嫌い」ではなく、技術的な強みとプロジェクト特性のマッチングです。代表的な IaaS
              サービスとあわせて、それぞれのクラウドが評価されている理由を押さえておきましょう。
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {/* AWS */}
              <div className="flex flex-col justify-between rounded-2xl border bg-slate-50 p-3 shadow-sm" style={{ borderColor: '#FF9900' }}>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-[9px] font-semibold"
                      style={{ border: '1px solid #FF9900', color: '#FF9900' }}
                    >
                      AWS
                    </div>
                    <p className="text-xs font-semibold text-slate-800">Amazon Web Services</p>
                  </div>
                  <p className="text-[10px] font-semibold text-slate-400">代表的な IaaS</p>
                  <p className="text-slate-700">EC2 (Elastic Compute Cloud)</p>
                  <p className="mt-2 text-[10px] font-semibold text-slate-400">主要な技術的特徴と強み</p>
                  <ul className="space-y-1 text-[11px] text-slate-700">
                    <li>・サービスラインナップの網羅性が高く、「IaaS のデファクト」として情報量が圧倒的。</li>
                    <li>・周辺サービス（S3, RDS など）との組み合わせパターンが豊富で、設計の自由度が高い。</li>
                  </ul>
                  <p className="mt-2 text-[10px] font-semibold text-slate-400">代表的なユースケース</p>
                  <p className="text-slate-700">
                    新規プロダクトのインフラ基盤、スタートアップや Web 系サービスの標準環境、オンプレからの段階的な移行案件など。
                  </p>
                </div>
              </div>

              {/* Azure */}
              <div className="flex flex-col justify-between rounded-2xl border bg-slate-50 p-3 shadow-sm" style={{ borderColor: '#0089D6' }}>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-[9px] font-semibold"
                      style={{ border: '1px solid #0089D6', color: '#0089D6' }}
                    >
                      AZ
                    </div>
                    <p className="text-xs font-semibold text-slate-800">Microsoft Azure</p>
                  </div>
                  <p className="text-[10px] font-semibold text-slate-400">代表的な IaaS</p>
                  <p className="text-slate-700">Virtual Machines</p>
                  <p className="mt-2 text-[10px] font-semibold text-slate-400">主要な技術的特徴と強み</p>
                  <ul className="space-y-1 text-[11px] text-slate-700">
                    <li>・Active Directory や Windows Server など、既存の Microsoft 資産との親和性が高い。</li>
                    <li>・オンプレミスの企業ネットワークと一体で設計しやすく、「社内システムのクラウド化」に強い。</li>
                  </ul>
                  <p className="mt-2 text-[10px] font-semibold text-slate-400">代表的なユースケース</p>
                  <p className="text-slate-700">
                    既存の Windows ベース業務システムのリフト＆シフト、AD 連携が前提となる社内ポータルや基幹システムのクラウド移行など。
                  </p>
                </div>
              </div>

              {/* GCP */}
              <div className="flex flex-col justify-between rounded-2xl border bg-slate-50 p-3 shadow-sm" style={{ borderColor: '#4285F4' }}>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-[9px] font-semibold"
                      style={{ border: '1px solid #4285F4', color: '#4285F4' }}
                    >
                      GCP
                    </div>
                    <p className="text-xs font-semibold text-slate-800">Google Cloud</p>
                  </div>
                  <p className="text-[10px] font-semibold text-slate-400">代表的な IaaS</p>
                  <p className="text-slate-700">Compute Engine</p>
                  <p className="mt-2 text-[10px] font-semibold text-slate-400">主要な技術的特徴と強み</p>
                  <ul className="space-y-1 text-[11px] text-slate-700">
                    <li>・BigQuery や Cloud Storage など、データ処理・分析基盤が強力。</li>
                    <li>・GKE をはじめとしたコンテナ / Kubernetes 周りのサービスが成熟している。</li>
                  </ul>
                  <p className="mt-2 text-[10px] font-semibold text-slate-400">代表的なユースケース</p>
                  <p className="text-slate-700">
                    データ分析プラットフォーム、機械学習基盤、コンテナ中心のマイクロサービスアーキテクチャなど。
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-600">
              いずれも「物理サーバ1台分を仮想的に提供する IaaS」としての性質は共通しており、EC2 / Azure Virtual Machines / Compute
              Engine がそれぞれのクラウドにおける標準的な仮想サーバサービスです。
            </p>
          </div>

          {/* 責任共有モデルのスタック図 */}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[11px] text-slate-700">
            <p className="font-semibold text-slate-800">責任共有モデルのスタック図</p>
            <p className="text-slate-600">
              どこからが自分たちの仕事で、どこまでをクラウド事業者に任せられるのかを、レイヤ構造でイメージしておきましょう。
            </p>
            <div className="mx-auto mt-2 w-full max-w-xs text-[11px]">
              {/* 利用者の責任 */}
              <div className="rounded-t-xl bg-gradient-to-r from-amber-600 to-amber-500 px-3 py-1.5 text-xs font-semibold text-amber-50">
                利用者の責任
              </div>
              <div className="space-y-1 rounded-b-xl border border-amber-500/60 bg-amber-950/40 p-2 text-[10px] text-amber-50">
                <div className="rounded-md bg-amber-900/60 px-2 py-1">アプリケーション / ビジネスロジック</div>
                <div className="rounded-md bg-amber-900/60 px-2 py-1">データ（ログ・個人情報・業務データ）</div>
                <div className="rounded-md bg-amber-900/60 px-2 py-1">ミドルウェア（Web サーバ・DB 等）の設定とパッチ</div>
                <div className="rounded-md bg-amber-900/60 px-2 py-1">OS の設定・セキュリティ更新</div>
              </div>

              {/* 事業者の責任 */}
              <div className="mt-3 rounded-t-xl bg-gradient-to-r from-sky-700 to-sky-500 px-3 py-1.5 text-xs font-semibold text-sky-50">
                クラウド事業者の責任
              </div>
              <div className="space-y-1 rounded-b-xl border border-sky-500/60 bg-sky-950/40 p-2 text-[10px] text-sky-50">
                <div className="rounded-md bg-sky-900/70 px-2 py-1">ハイパーバイザー / 仮想化基盤</div>
                <div className="rounded-md bg-sky-900/70 px-2 py-1">物理サーバ・ストレージ・ネットワーク機器</div>
                <div className="rounded-md bg-sky-900/70 px-2 py-1">データセンター設備・電源・空調・物理セキュリティ</div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> 利用者が設計・運用する範囲
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-sky-400" /> 事業者が担保するインフラ基盤
              </span>
            </div>
          </div>
        </section>

        {/* 完了ボタン */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-[11px] text-slate-600">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => handleAckChange(e.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
              <span>解説を一通り読みました（要点を自分の言葉で説明できる状態です）</span>
            </label>
            <button
              type="button"
              disabled={!ack}
              onClick={() => (window.location.hash = '#/training/infra-basic-3-2')}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              理論を理解し、確認テストへ進む
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

