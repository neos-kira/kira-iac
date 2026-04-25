import { useEffect } from 'react'
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
    category: '課題3-1 · 理論理解',
    title: 'OS・仮想化・クラウドの解説',
    description: 'OS の役割、仮想化アーキテクチャ、クラウドの責任共有モデルを現場目線で整理した解説セクションです。',
    path: '/training/infra-basic-3-1',
  },
  {
    category: '課題3-2 · 実技＋理論',
    title: 'OS・仮想化・クラウド理解度チェック',
    description: 'OS・仮想化・クラウドの概念を、自分の言葉と実機ログで説明する記述式テストです（内容に基づき自動採点されます）。',
    path: '/training/infra-basic-3-2',
  },
]

export function InfraBasic3TopPage() {
  const taskProgress = getTaskProgressList().find((t) => t.id === 'infra-basic-3')
  const subTasks = taskProgress?.subTasks ?? []

  useEffect(() => {
    document.title = 'OS・仮想化・クラウド'
  }, [])

  const totalCount = TASKS.length
  const completedCount = subTasks.filter((s) => s.status === 'cleared').length

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-2xl space-y-6">

        <div>
          <h1 className="text-lg font-bold text-slate-800">OS・仮想化・クラウド</h1>
          <p className="mt-1 text-sm text-slate-600">
            OS・仮想化・クラウドの基礎理論を整理し、実務で説明できるレベルまで落とし込む課題です。
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

        {/* リスト型課題カード */}
        <div className="flex flex-col rounded-xl border border-slate-200 overflow-hidden bg-white">
          {TASKS.map((task, index) => {
            const sub = subTasks[index]
            const isCompleted = sub?.status === 'cleared'

            return (
              <div
                key={task.path}
                className={`flex items-center justify-between px-6 py-5 ${index < TASKS.length - 1 ? 'border-b border-slate-100' : ''} ${isCompleted ? 'bg-green-50' : 'bg-white'}`}
              >
                {/* 完了チェック円 */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mr-4 font-semibold ${isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                  {isCompleted ? '✓' : index + 1}
                </div>

                <div className="flex-1">
                  <div className="text-label md:text-label-pc text-slate-400 mb-0.5">{task.category}</div>
                  <div className="text-heading md:text-heading-pc font-semibold text-slate-800 mb-0.5">{task.title}</div>
                  <div className="text-label md:text-label-pc text-slate-400">{task.description}</div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <button
                    type="button"
                    onClick={() => { window.location.href = getTrainingUrl(task.path) }}
                    className="rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-colors px-4 py-2 font-medium"
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
