import { useEffect, useState } from 'react'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
import { getProgressKey } from './trainingWbsData'
import { INFRA_BASIC_3_1_DONE_KEY } from './infraBasic3Data'
import { getCurrentDisplayName } from '../auth'
import { fetchMyProgress, postProgress, isProgressApiAvailable } from '../progressApi'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'

export function InfraBasic31Page() {
  const navigate = useSafeNavigate()
  const key = getProgressKey(INFRA_BASIC_3_1_DONE_KEY)
  const [ack, setAck] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(key) === 'true'
  })
  const [serverSnapshot, setServerSnapshot] = useState<TraineeProgressSnapshot | null>(null)

  useEffect(() => {
    document.title = 'インフラ基礎課題3-1 OS・仮想化・クラウド解説'
  }, [])

  useEffect(() => {
    const username = getCurrentDisplayName().trim().toLowerCase()
    if (!username || false) return
    fetchMyProgress(username).then(snap => { if (snap) setServerSnapshot(snap) })
  }, [])

  const handleAckChange = async (checked: boolean) => {
    setAck(checked)
    if (typeof window !== 'undefined') {
      if (checked) window.localStorage.setItem(key, 'true')
      else window.localStorage.removeItem(key)
    }
    // ① localStorage書き込み完了後にDynamoDB即時同期
    const username = getCurrentDisplayName().trim().toLowerCase()
    if (username && isProgressApiAvailable()) {
      const base: TraineeProgressSnapshot = serverSnapshot ?? {
        introConfirmed: false, introAt: null, wbsPercent: 0, chapterProgress: [],
        currentDay: 0, delayedIds: [], updatedAt: '', pins: [],
      }
      await postProgress(username, {
        ...base,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-xs text-slate-500">課題3-1 · 理論理解</p>
          <h1 className="text-xl font-bold text-slate-800">OS・仮想化・クラウドの解説</h1>
        </div>

        {/* OS と計算資源 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft-card" style={{ marginBottom: 48 }}>
          <h2 className="text-heading md:text-heading-pc" style={{ fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>1. OS と計算資源の最適化</h2>
          <p className="text-body md:text-body-pc" style={{ lineHeight: 1.8, color: '#475569', marginBottom: 8, whiteSpace: 'pre-line' }}>
            {'パソコンが重くなったとき、タスクマネージャーを開いて\n「何が重いのか」を確認したことはありませんか？\nサーバーも同じです。重くなったとき、何が原因かを特定するのが\nインフラエンジニアの最初の仕事です。\nLinuxサーバーでは、以下の3つのコマンドで原因を切り分けます。'}
          </p>

          <div className="rounded-xl border border-slate-200 bg-slate-50" style={{ padding: 24, marginBottom: 16 }}>
            <p className="text-button md:text-button-pc" style={{ fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>【コマンドで確認する】サーバーが重いときの初動</p>

            <p className="text-body md:text-body-pc" style={{ fontWeight: 600, color: '#475569', marginBottom: 4 }}>① CPU の状態を見る</p>
            <pre className="text-body md:text-body-pc" style={{ background: '#1e293b', color: '#e2e8f0', borderRadius: 8, padding: 16, lineHeight: 1.7, overflowX: 'auto', marginBottom: 12 }}>
{`$ top
→ us（ユーザープロセス）が高い → アプリ側の問題
→ wa（I/O待ち）が高い         → ディスクがボトルネック
→ sy（システム）が高い         → カーネル・ドライバの問題`}
            </pre>

            <p className="text-body md:text-body-pc" style={{ fontWeight: 600, color: '#475569', marginBottom: 4 }}>② メモリの状態を見る</p>
            <pre className="text-body md:text-body-pc" style={{ background: '#1e293b', color: '#e2e8f0', borderRadius: 8, padding: 16, lineHeight: 1.7, overflowX: 'auto', marginBottom: 12 }}>
{`$ free -h
→ available が物理メモリの10%未満 → メモリ不足
→ swap used が増加中              → 危険信号、早急に原因調査`}
            </pre>

            <p className="text-body md:text-body-pc" style={{ fontWeight: 600, color: '#475569', marginBottom: 4 }}>③ ディスクの状態を見る</p>
            <pre className="text-body md:text-body-pc" style={{ background: '#1e293b', color: '#e2e8f0', borderRadius: 8, padding: 16, lineHeight: 1.7, overflowX: 'auto' }}>
{`$ df -h
→ Use% が90%超 → ディスクフル寸前、ログ・tmpを確認`}
            </pre>
          </div>

          {/* ボトルネック特定ゲージ図 */}
          <div style={{ marginBottom: 16 }}>
            <svg viewBox="0 0 600 200" style={{ width: '100%', height: 'auto' }} role="img" aria-label="ボトルネック特定ゲージ図">
              <text x="300" y="24" textAnchor="middle" fontSize="14" fontWeight="700" fill="#1e293b">ボトルネック特定ゲージ</text>
              {/* CPU 80% */}
              <text x="20" y="62" fontSize="12" fontWeight="600" fill="#1e293b">CPU</text>
              <rect x="70" y="48" width="260" height="20" rx="10" fill="#e2e8f0" />
              <rect x="70" y="48" width="208" height="20" rx="10" fill="#ef4444" />
              <text x="175" y="62" textAnchor="middle" fontSize="11" fontWeight="600" fill="#fff">80%</text>
              <text x="340" y="62" fontSize="11" fill="#ef4444" fontWeight="600">高負荷 → アプリ側の問題</text>
              {/* メモリ 60% */}
              <text x="20" y="108" fontSize="12" fontWeight="600" fill="#1e293b">メモリ</text>
              <rect x="70" y="94" width="260" height="20" rx="10" fill="#e2e8f0" />
              <rect x="70" y="94" width="156" height="20" rx="10" fill="#f59e0b" />
              <text x="148" y="108" textAnchor="middle" fontSize="11" fontWeight="600" fill="#fff">60%</text>
              <text x="340" y="108" fontSize="11" fill="#f59e0b" fontWeight="600">注意 → スワップ監視</text>
              {/* ディスク 30% */}
              <text x="20" y="154" fontSize="12" fontWeight="600" fill="#1e293b">ディスク</text>
              <rect x="70" y="140" width="260" height="20" rx="10" fill="#e2e8f0" />
              <rect x="70" y="140" width="78" height="20" rx="10" fill="#10b981" />
              <text x="109" y="154" textAnchor="middle" fontSize="11" fontWeight="600" fill="#fff">30%</text>
              <text x="340" y="154" fontSize="11" fill="#10b981" fontWeight="600">正常</text>
            </svg>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50" style={{ padding: 20 }}>
            <p className="text-button md:text-button-pc" style={{ fontWeight: 600, color: '#92400e', marginBottom: 6 }}>覚えること</p>
            <p className="text-button md:text-button-pc" style={{ lineHeight: 1.8, color: '#78350f' }}>
              CPU使用率100%でも「何が原因か」を特定できなければ意味がない。
              <code className="text-body md:text-body-pc" style={{ background: '#fef3c7', padding: '2px 6px', borderRadius: 4 }}>us</code> / <code className="text-body md:text-body-pc" style={{ background: '#fef3c7', padding: '2px 6px', borderRadius: 4 }}>sy</code> / <code className="text-body md:text-body-pc" style={{ background: '#fef3c7', padding: '2px 6px', borderRadius: 4 }}>wa</code> の3つで原因を切り分けるのが最初のステップ。
            </p>
          </div>
        </section>

        {/* 仮想化アーキテクチャ */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft-card" style={{ marginBottom: 48 }}>
          <h2 className="text-heading md:text-heading-pc" style={{ fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>2. 仮想化アーキテクチャ</h2>
          <p className="text-body md:text-body-pc" style={{ lineHeight: 1.8, color: '#475569', marginBottom: 8, whiteSpace: 'pre-line' }}>
            {'マンションを想像してください。\n1棟の建物（物理サーバー）の中に、複数の部屋（仮想サーバー）があります。\n各部屋は独立していますが、建物の電気・水道（CPUやメモリ）は共有しています。\nこれが仮想化の基本的な考え方です。\nAWSのEC2は、この「マンションの1部屋」にあたります。'}
          </p>

          <div className="rounded-xl border border-sky-200 bg-sky-50" style={{ padding: 20, marginBottom: 16 }}>
            <p className="text-button md:text-button-pc text-sky-800" style={{ fontWeight: 600, marginBottom: 8 }}>NICの研修環境</p>
            <p className="text-button md:text-button-pc text-sky-700" style={{ lineHeight: 1.8 }}>
              この研修ではAWSの<strong>EC2（仮想サーバー）</strong>を使う。
              EC2はESXiと同じ<strong>ベアメタル型ハイパーバイザー</strong>の上で動いている。
              つまり、物理サーバーの上にハイパーバイザーが直接載り、その上でEC2インスタンスが動作する構造。
            </p>
          </div>

          {/* 仮想化層構造図 */}
          <div style={{ marginBottom: 16 }}>
            <svg viewBox="0 0 360 300" style={{ width: '100%', height: 'auto' }} role="img" aria-label="仮想化層構造図">
              <text x="180" y="24" textAnchor="middle" fontSize="14" fontWeight="700" fill="#1e293b">仮想化層の構造</text>
              {/* EC2インスタンス */}
              <rect x="20" y="44" width="320" height="64" rx="10" fill="#f0fdfa" stroke="#0d9488" strokeWidth="2" />
              <text x="180" y="66" textAnchor="middle" fontSize="13" fontWeight="700" fill="#0d9488">EC2インスタンス（VM）</text>
              <text x="180" y="84" textAnchor="middle" fontSize="11" fill="#475569">アプリケーション・OS</text>
              <text x="180" y="100" textAnchor="middle" fontSize="10" fill="#94a3b8">あなたが操作するサーバー</text>
              {/* 矢印 */}
              <line x1="180" y1="108" x2="180" y2="124" stroke="#94a3b8" strokeWidth="2" />
              <polygon points="174,122 180,132 186,122" fill="#94a3b8" />
              {/* ハイパーバイザー */}
              <rect x="20" y="136" width="320" height="64" rx="10" fill="#eff6ff" stroke="#3b82f6" strokeWidth="2" />
              <text x="180" y="158" textAnchor="middle" fontSize="13" fontWeight="700" fill="#3b82f6">ハイパーバイザー（ESXi）</text>
              <text x="180" y="176" textAnchor="middle" fontSize="11" fill="#475569">仮想化レイヤー</text>
              <text x="180" y="192" textAnchor="middle" fontSize="10" fill="#94a3b8">仮想化を担当するソフト</text>
              {/* 矢印 */}
              <line x1="180" y1="200" x2="180" y2="216" stroke="#94a3b8" strokeWidth="2" />
              <polygon points="174,214 180,224 186,214" fill="#94a3b8" />
              {/* 物理サーバー */}
              <rect x="20" y="228" width="320" height="64" rx="10" fill="#f9fafb" stroke="#9ca3af" strokeWidth="2" />
              <text x="180" y="250" textAnchor="middle" fontSize="13" fontWeight="700" fill="#6b7280">物理サーバー</text>
              <text x="180" y="268" textAnchor="middle" fontSize="11" fill="#475569">CPU・メモリ・ディスク・NIC</text>
              <text x="180" y="284" textAnchor="middle" fontSize="10" fill="#94a3b8">AWSが管理するハードウェア</text>
            </svg>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50" style={{ padding: 24 }}>
              <p className="text-button md:text-button-pc" style={{ fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>【知っておくと役立つこと】</p>
              <div className="text-button md:text-button-pc" style={{ lineHeight: 1.8, color: '#475569' }}>
                <p style={{ marginBottom: 12 }}>
                  <strong style={{ color: '#1e293b' }}>VMは物理リソースを他のVMと共有している。</strong><br />
                  同じ物理サーバー上の別VMが暴走すると、自分のVMも遅くなる（ノイジーネイバー問題）。
                  物理サーバーなら他の影響を受けないが、VMではこの可能性を常に考慮する。
                </p>
                <p style={{ marginBottom: 12 }}>
                  <strong style={{ color: '#1e293b' }}>「サーバーが重い」の切り分け手順が変わる。</strong><br />
                  物理サーバー → 自分のプロセスだけ調べればよい。<br />
                  VM → 自分のプロセス＋ホスト側のリソース枯渇の両方を疑う。
                </p>
                <p>
                  <strong style={{ color: '#1e293b' }}>EC2 t3.micro は 2vCPU・1GBメモリ。</strong><br />
                  研修・検証用としては十分だが、本番環境には絶対に使わない。
                  メモリ1GBではWebサーバー1つ立てるだけで逼迫する。
                  本番では最低でもt3.small（2GB）以上、DBサーバーならr系インスタンスを選定する。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* クラウドコンピューティング */}
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-soft-card" style={{ marginBottom: 48 }}>
          <h2 className="text-heading md:text-heading-pc" style={{ fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>3. クラウドのサービスモデル</h2>
          <p className="text-body md:text-body-pc" style={{ lineHeight: 1.8, color: '#475569', marginBottom: 8, whiteSpace: 'pre-line' }}>
            {'レンタカーと自家用車の違いを考えてみてください。\n自家用車（物理サーバー）は全部自分で管理します。\nレンタカー（クラウド）は車の整備はお店がやってくれますが、\n運転は自分でします。\nクラウドも同じで「どこまでが自分の責任か」という\n境界線を理解することが重要です。'}
          </p>

          {/* この研修でAWSを使う理由 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50" style={{ padding: 20, marginBottom: 4 }}>
            <p className="text-button md:text-button-pc" style={{ fontWeight: 600, color: '#1e293b', marginBottom: 10 }}>【この研修でAWSを使う理由】</p>
            <div className="text-button md:text-button-pc" style={{ lineHeight: 1.8, color: '#475569' }}>
              <p style={{ marginBottom: 8 }}>
                <strong style={{ color: '#1e293b' }}>国内クラウド案件の約50%がAWS。</strong>
                現場に出たとき最も遭遇する確率が高い。
              </p>
              <p style={{ marginBottom: 8 }}>
                <strong style={{ color: '#1e293b' }}>EC2・S3・RDSの3つを知れば大半の現場に対応できる。</strong>
                仮想サーバー（EC2）、ファイル保存（S3）、データベース（RDS）はほぼ全てのWebサービスで使われている。
              </p>
              <p>
                <strong style={{ color: '#1e293b' }}>求人数・情報量ともに圧倒的。</strong>
                困ったときにGoogle検索で解決策が見つかりやすい。これは実務上、非常に大きな利点。
              </p>
            </div>
          </div>

          {/* クラウドシェア横棒グラフ */}
          <div style={{ marginBottom: 4 }}>
            <svg viewBox="0 0 600 180" style={{ width: '100%', height: 'auto' }} role="img" aria-label="国内クラウド市場シェア">
              <text x="300" y="24" textAnchor="middle" fontSize="14" fontWeight="700" fill="#1e293b">国内クラウド市場シェア（目安）</text>
              {/* AWS 50% */}
              <text x="20" y="62" fontSize="12" fontWeight="600" fill="#1e293b">AWS</text>
              <rect x="70" y="48" width="400" height="22" rx="6" fill="#e2e8f0" />
              <rect x="70" y="48" width="200" height="22" rx="6" fill="#f59e0b" />
              <text x="170" y="63" textAnchor="middle" fontSize="11" fontWeight="600" fill="#fff">50%</text>
              {/* Azure 25% */}
              <text x="20" y="100" fontSize="12" fontWeight="600" fill="#1e293b">Azure</text>
              <rect x="70" y="86" width="400" height="22" rx="6" fill="#e2e8f0" />
              <rect x="70" y="86" width="100" height="22" rx="6" fill="#3b82f6" />
              <text x="120" y="101" textAnchor="middle" fontSize="11" fontWeight="600" fill="#fff">25%</text>
              {/* GCP 12% */}
              <text x="20" y="138" fontSize="12" fontWeight="600" fill="#1e293b">GCP</text>
              <rect x="70" y="124" width="400" height="22" rx="6" fill="#e2e8f0" />
              <rect x="70" y="124" width="48" height="22" rx="6" fill="#10b981" />
              <text x="94" y="139" textAnchor="middle" fontSize="11" fontWeight="600" fill="#fff">12%</text>
              {/* その他 13% */}
              <text x="20" y="176" fontSize="12" fontWeight="600" fill="#1e293b">その他</text>
              <rect x="70" y="162" width="400" height="22" rx="6" fill="#e2e8f0" />
              <rect x="70" y="162" width="52" height="22" rx="6" fill="#9ca3af" />
              <text x="96" y="177" textAnchor="middle" fontSize="11" fontWeight="600" fill="#fff">13%</text>
            </svg>
          </div>

          {/* 責任共有モデルを現場で使う場面 */}
          <div className="rounded-xl border border-amber-200 bg-amber-50" style={{ padding: 20, marginBottom: 4 }}>
            <p className="text-button md:text-button-pc" style={{ fontWeight: 600, color: '#92400e', marginBottom: 10 }}>【具体的にどういう意味か】</p>
            <p className="text-button md:text-button-pc" style={{ lineHeight: 1.8, color: '#78350f', marginBottom: 12 }}>
              「このサーバーのOSパッチは誰が当てるの？」
            </p>
            <div className="text-button md:text-button-pc" style={{ lineHeight: 1.8, color: '#78350f' }}>
              <p style={{ marginBottom: 8 }}>
                <strong>EC2（IaaS）の場合:</strong> 自分たち（利用者）の責任。
                OSの選定・パッチ適用・セキュリティ設定すべて自分で行う。
              </p>
              <p style={{ marginBottom: 12 }}>
                <strong>RDS（PaaS）の場合:</strong> AWSの責任。
                OSには触れない。DBエンジンのバージョンアップもAWSが管理する。
              </p>
              <p style={{ fontWeight: 600 }}>
                この区別を間違えると「誰もパッチを当てていなかった」というセキュリティインシデントになる。
              </p>
            </div>
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
                className="h-4 w-4 accent-sky-600"
              />
              <span>解説を一通り読みました（要点を自分の言葉で説明できる状態です）</span>
            </label>
            <button
              type="button"
              disabled={!ack}
              onClick={() => navigate('/training/infra-basic-3-2')}
              className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              理論を理解し、確認テストへ進む
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

