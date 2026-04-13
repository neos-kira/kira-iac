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
    document.title = 'インフラ基礎課題2'
  }, [])

  const totalCount = TASKS.length
  const completedCount = subTasks.filter((s) => s.status === 'cleared').length

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-2xl space-y-6">

        <div>
          <h1 className="text-lg font-bold text-slate-800">インフラ基礎課題2</h1>
          <p className="mt-1 text-sm text-slate-600">
            ネットワーク実機を用いた調査・記述問題と、TCP/IP理解度チェック10問の2つで構成されています。
          </p>
          {taskProgress && (
            <p className="mt-1 text-[11px] text-slate-500">
              目安 {taskProgress.estimatedDays} 日目まで · 期限 {taskProgress.deadline}
              {taskProgress.isDelayed && (
                <span className="ml-2 text-rose-400">遅延</span>
              )}
            </p>
          )}
        </div>

        {/* 進捗サマリー */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          color: '#6b7280',
        }}>
          <span style={{ fontWeight: 600, color: '#0d9488' }}>
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
              background: '#0d9488',
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
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: isCompleted ? '#0d9488' : '#e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginRight: '16px',
                  fontSize: '14px',
                  color: isCompleted ? 'white' : '#9ca3af',
                  fontWeight: 600,
                }}>
                  {isCompleted ? '✓' : index + 1}
                </div>

                {/* 中: テキスト */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>
                    {task.category}
                  </div>
                  <div style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: isLocked ? '#9ca3af' : '#111827',
                    marginBottom: '2px',
                  }}>
                    {task.title}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>
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
                  <button
                    type="button"
                    onClick={isLocked ? undefined : () => { window.location.href = getTrainingUrl(task.path) }}
                    disabled={isLocked}
                    style={{
                      background: isLocked ? '#e5e7eb' : '#0d9488',
                      color: isLocked ? '#9ca3af' : 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      cursor: isLocked ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                    }}
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
