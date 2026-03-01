import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { OpenInNewTabButton } from '../components/OpenInNewTabButton'
import { getTaskProgressList } from './trainingWbsData'

function getTrainingUrl(path: string) {
  const base =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname || '/'}`.replace(/\/$/, '') || window.location.origin
      : ''
  return `${base}#${path}`
}

export function InfraBasic3TopPage() {
  const navigate = useNavigate()
  const taskProgress = getTaskProgressList().find((t) => t.id === 'infra-basic-3')

  useEffect(() => {
    document.title = 'インフラ基礎課題3'
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">TRAINING · INFRA</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-800">インフラ基礎課題3</h1>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            トップへ戻る
          </button>
        </div>

        <p className="text-sm text-slate-600">
          OS・仮想化・クラウドの基礎理論を整理し、実務で説明できるレベルまで落とし込む課題です。
        </p>
        {taskProgress && (
          <p className="text-[11px] text-slate-500">
            目安 {taskProgress.estimatedDays} 日目まで · 期限 {taskProgress.deadline}
            {taskProgress.isDelayed && (
              <span className="ml-2 text-rose-400">遅延</span>
            )}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <p className="text-[11px] text-slate-600">課題3-1 · 理論理解</p>
              <h2 className="mt-1 text-sm font-semibold text-slate-800">OS・仮想化・クラウドの解説</h2>
              <p className="mt-1 text-[11px] text-slate-600">
                OS の役割、仮想化アーキテクチャ、クラウドの責任共有モデルを現場目線で整理した解説セクションです。
              </p>
            </div>
            <div className="mt-3 flex justify-end">
              <OpenInNewTabButton
                url={getTrainingUrl('/training/infra-basic-3-1')}
                className="btn-wiggle bg-gradient-to-r bg-indigo-600 text-white hover:bg-indigo-700"
              />
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <p className="text-[11px] text-slate-600">課題3-2 · 実技＋理論</p>
              <h2 className="mt-1 text-sm font-semibold text-slate-800">OS・仮想化・クラウド理解度チェック</h2>
              <p className="mt-1 text-[11px] text-slate-600">
                OS・仮想化・クラウドの概念を、自分の言葉と実機ログで説明する記述式テストです（内容に基づき自動採点されます）。
              </p>
            </div>
            <div className="mt-3 flex justify-end">
              <OpenInNewTabButton
                url={getTrainingUrl('/training/infra-basic-3-2')}
                className="btn-wiggle bg-gradient-to-r bg-indigo-600 text-white hover:bg-indigo-700"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

