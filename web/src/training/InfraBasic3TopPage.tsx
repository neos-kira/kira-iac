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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* 進捗サマリー — color-primary (brand) */}
          <span className="text-body md:text-body-pc" style={{ fontWeight: 600, color: '#0369a1' }}>
            {completedCount} / {totalCount} 完了
          </span>
          <div style={{ flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden', maxWidth: '120px' }}>
            <div style={{ width: `${(completedCount / totalCount) * 100}%`, height: '100%', background: '#7dd3fc', borderRadius: '3px', transition: 'width 0.3s ease' }} />
          </div>
        </div>

        {/* リスト型課題カード */}
        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', background: 'white' }}>
          {TASKS.map((task, index) => {
            const sub = subTasks[index]
            const isCompleted = sub?.status === 'cleared'

            return (
              <div
                key={task.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '20px 24px',
                  borderBottom: index < TASKS.length - 1 ? '1px solid #f3f4f6' : 'none',
                  background: isCompleted ? '#f0fdf9' : 'white',
                }}
              >
                {/* 完了チェック円 — 達成時は color-success (emerald) */}
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isCompleted ? '#10b981' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: '16px', color: isCompleted ? 'white' : '#9ca3af', fontWeight: 600 }}>
                  {isCompleted ? '✓' : index + 1}
                </div>

                <div style={{ flex: 1 }}>
                  <div className="text-label md:text-label-pc" style={{ color: '#9ca3af', marginBottom: '2px' }}>
                    {task.category}
                  </div>
                  <div className="text-heading md:text-heading-pc" style={{ fontWeight: 600, color: '#111827', marginBottom: '2px' }}>
                    {task.title}
                  </div>
                  <div className="text-label md:text-label-pc" style={{ color: '#9ca3af' }}>
                    {task.description}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, marginLeft: '16px' }}>
                  {/* 開くボタン — color-primary (light sky: 反復遷移系) */}
                  <button
                    type="button"
                    onClick={() => { window.location.href = getTrainingUrl(task.path) }}
                    className="rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-colors"
                    style={{ padding: '8px 16px', fontWeight: 500 }}
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
