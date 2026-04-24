import { useEffect, useState } from 'react'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
import { fetchMyProgress } from '../progressApi'
import { getCurrentDisplayName } from '../auth'
import { restoreProgressToLocalStorage } from '../traineeProgressStorage'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'

type StageStatus = 'done' | 'active' | 'todo'

type Stage = {
  num: number
  title: string
  desc: string
  path: string
  status: StageStatus
  pct: number
}

function getStages(snap: TraineeProgressSnapshot | null): Stage[] {
  const s = snap ?? ({} as TraineeProgressSnapshot)
  const ch = Array.isArray(s.chapterProgress) ? s.chapterProgress : []
  const introOk = Number(s.introStep ?? 0) >= 5 && !!s.introConfirmed
  const introActive = Number(s.introStep ?? 0) >= 1
  const linuxOk = !!s.infra1Cleared && !!s.l1Cleared
  const linuxActive = (s.infra1Checkboxes ?? []).some(Boolean) || (s.l1CurrentPart ?? 0) > 0
  const netOk = !!ch[1]?.cleared
  const netActive = (s.l2CurrentQuestion ?? 0) > 0
  const viOk = !!ch[2]?.cleared
  const viActive = (s.infra4ViDoneSteps ?? []).length > 0 || (s.infra4ShellDoneQuestions ?? []).length > 0
  const srvOk = !!ch[3]?.cleared
  const srvActive = (s.infra5PhaseDone ?? []).length > 0

  return [
    { num: 1, title: 'はじめに', desc: '行動基準・AI利用規約・セキュリティ基礎', path: '/training/intro', status: introOk ? 'done' : introActive ? 'active' : 'todo', pct: introOk ? 100 : Math.min(Math.round((Number(s.introStep ?? 0) / 5) * 100), 99) },
    { num: 2, title: 'IT業界の歩き方', desc: 'エンジニア職種・プロジェクト・SES', path: '/training/it-basics', status: ch[0]?.cleared ? 'done' : ch[0] ? 'active' : 'todo', pct: ch[0]?.cleared ? 100 : 0 },
    { num: 3, title: 'Linuxコマンド30問', desc: 'Linuxコマンドの基礎〜実務操作', path: '/training/infra-basic-top', status: linuxOk ? 'done' : linuxActive ? 'active' : 'todo', pct: linuxOk ? 100 : linuxActive ? 30 : 0 },
    { num: 4, title: 'ネットワーク基礎', desc: 'TCP/IP・ルーティング・実機調査', path: '/training/infra-basic-2-top', status: netOk ? 'done' : netActive ? 'active' : 'todo', pct: netOk ? 100 : netActive ? 40 : 0 },
    { num: 5, title: 'vi & シェルスクリプト', desc: 'viエディタ・シェルスクリプト実践', path: '/training/infra-basic-4', status: viOk ? 'done' : viActive ? 'active' : 'todo', pct: viOk ? 100 : viActive ? 30 : 0 },
    { num: 6, title: 'Rocky Linux サーバー構築', desc: 'httpd・PostgreSQL・AIDE・証明書', path: '/training/infra-basic-5', status: srvOk ? 'done' : srvActive ? 'active' : 'todo', pct: srvOk ? 100 : srvActive ? 30 : 0 },
  ]
}

function getTrainingUrl(path: string) {
  const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname || '/'}`.replace(/\/$/, '') || window.location.origin : ''
  return `${base}#${path}`
}

export function RoadmapPage() {
  const navigate = useSafeNavigate()
  const [snap, setSnap] = useState<TraineeProgressSnapshot | null>(null)

  useEffect(() => {
    document.title = '学習ロードマップ'
  }, [])

  useEffect(() => {
    const load = async () => {
      const username = getCurrentDisplayName()
      if (!username) return
      const s = await fetchMyProgress(username)
      if (s) { restoreProgressToLocalStorage(username, s); setSnap(s) }
    }
    load()
  }, [])

  const stages = getStages(snap)
  const doneCount = stages.filter((s) => s.status === 'done').length

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <button type="button" onClick={() => navigate('/')} className="mb-3 inline-flex items-center gap-1 text-label md:text-label-pc text-sky-600 hover:text-sky-700">
            ← ダッシュボードに戻る
          </button>
          <h1 className="text-display md:text-display-pc font-bold text-slate-800 tracking-tight">学習ロードマップ</h1>
          <p className="mt-2 text-body md:text-body-pc text-slate-600">
            6つのステージを順番に進めることで、未経験からインフラ現場で必要なスキルを身につけられます。
          </p>
          <p className="mt-1 text-label md:text-label-pc text-slate-500">{doneCount} / {stages.length} ステージ完了</p>
        </div>

        <div className="space-y-3">
          {stages.map((stage) => (
            <div
              key={stage.num}
              className={`rounded-xl border p-4 md:p-5 ${
                stage.status === 'done'
                  ? 'bg-green-50 border-green-200'
                  : stage.status === 'active'
                  ? 'bg-sky-50 border-sky-500 border-2'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                  stage.status === 'done'
                    ? 'bg-green-500 text-white'
                    : stage.status === 'active'
                    ? 'bg-sky-500 text-white'
                    : 'bg-slate-200 text-slate-400'
                }`}>
                  {stage.status === 'done' ? '✓' : stage.num}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                      stage.status === 'done' ? 'text-green-600' : stage.status === 'active' ? 'text-sky-600' : 'text-slate-400'
                    }`}>
                      STAGE {stage.num}
                      {stage.status === 'done' && ' · 完了'}
                      {stage.status === 'active' && ` · 進行中 ${stage.pct}%`}
                    </span>
                  </div>
                  <p className={`text-heading md:text-heading-pc font-bold tracking-tight ${
                    stage.status === 'todo' ? 'text-slate-400' : 'text-slate-800'
                  }`}>{stage.title}</p>
                  <p className={`mt-0.5 text-label md:text-label-pc ${stage.status === 'todo' ? 'text-slate-400' : 'text-slate-600'}`}>
                    {stage.desc}
                  </p>
                  {stage.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => { window.open(getTrainingUrl(stage.path), '_blank') }}
                      className="mt-3 rounded-lg bg-sky-500 text-white px-4 py-2 text-button md:text-button-pc font-medium hover:bg-sky-600 transition-colors"
                    >
                      続ける →
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
