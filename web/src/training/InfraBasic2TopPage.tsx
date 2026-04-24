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
    title: 'TCP/IP 理解度チェック10問',
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
            ネットワーク実機を用いた調査・記述問題と、TCP/IP理解度チェック10問の2つで構成されています。
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
        <div className="text-body md:text-body-pc" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#6b7280',
        }}>
          {/* 進捗サマリー — color-primary (brand) */}
          <span style={{ fontWeight: 600, color: '#0369a1' }}>
            {completedCount} / {totalCount} 完了
          </span>
          <div style={{
            flex: 1,
            height: '6px',
            background: '#e5e7eb',
            borderRadius: '3px',
            overflow: 'hidden',
            maxWidth: '120px',
          }}>
            <div style={{
              width: `${(completedCount / totalCount) * 100}%`,
              height: '100%',
              background: '#7dd3fc',
              borderRadius: '3px',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        {/* リスト型課題カード */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          overflow: 'hidden',
          background: 'white',
        }}>
          {TASKS.map((task, index) => {
            const sub = subTasks[index]
            const isCompleted = sub?.status === 'cleared'
            const isPrevDone = index === 0 || subTasks[index - 1]?.status !== 'not_started'
            const isLocked = !isPrevDone

            return (
              <div
                key={task.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '20px 24px',
                  borderBottom: index < TASKS.length - 1 ? '1px solid #f3f4f6' : 'none',
                  background: isCompleted ? '#f0fdf9' : isLocked ? '#fafafa' : 'white',
                  opacity: isLocked ? 0.6 : 1,
                }}
              >
                {/* 左: 完了チェック or 番号 */}
                {/* 完了チェック円 — 達成時は color-success (emerald) */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: isCompleted ? '#10b981' : '#e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginRight: '16px',
                  color: isCompleted ? 'white' : '#9ca3af',
                  fontWeight: 600,
                }}>
                  {isCompleted ? '✓' : index + 1}
                </div>

                {/* 中: テキスト */}
                <div style={{ flex: 1 }}>
                  <div className="text-label md:text-label-pc" style={{ color: '#9ca3af', marginBottom: '2px' }}>
                    {task.category}
                  </div>
                  <div className="text-heading md:text-heading-pc" style={{
                    color: isLocked ? '#9ca3af' : '#111827',
                    marginBottom: '2px',
                  }}>
                    {task.title}
                  </div>
                  <div className="text-label md:text-label-pc" style={{ color: '#9ca3af' }}>
                    {isLocked
                      ? `課題${index}を先に完了してください`
                      : task.description
                    }
                  </div>
                </div>

                {/* 右: ボタン */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexShrink: 0,
                  marginLeft: '16px',
                }}>
                  {/* 開くボタン — color-primary (light sky: 反復遷移系) */}
                  <button
                    type="button"
                    onClick={isLocked ? undefined : () => { window.location.href = getTrainingUrl(task.path) }}
                    disabled={isLocked}
                    className={`rounded-lg transition-colors ${
                      isLocked
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 cursor-pointer'
                    }`}
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
