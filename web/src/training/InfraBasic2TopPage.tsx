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

export function InfraBasic2TopPage() {
  const taskProgress = getTaskProgressList().find((t) => t.id === 'infra-basic-2')
  const subTasks = taskProgress?.subTasks ?? []

  useEffect(() => {
    document.title = 'ネットワーク基礎'
  }, [])

  const totalCount = TASKS.length
  const completedCount = subTasks.filter((s) => s.status === 'cleared').length

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
