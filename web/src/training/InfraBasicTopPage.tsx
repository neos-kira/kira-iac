import { useEffect, useState } from 'react'
import { getTaskProgressList, getTrainingStartDate, clearTask1Cache } from './trainingWbsData'
import { getCurrentDisplayName } from '../auth'
import { fetchMyProgress } from '../progressApi'
import { restoreProgressToLocalStorage, type TraineeProgressSnapshot } from '../traineeProgressStorage'

function getTrainingUrl(path: string) {
  const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname || '/'}`.replace(/\/$/, '') || window.location.origin : ''
  return `${base}#${path}`
}

const TASKS = [
  {
    category: '課題1-1 · 使用ツール',
    title: 'SSH接続確認',
    description: 'ターミナルからSSHで演習サーバーに接続する演習です。macOS / Windows 両対応。',
    path: '/training/infra-basic-1',
  },
  {
    category: 'Linuxコマンド30問',
    title: 'Linuxコマンド30問',
    description: 'Linuxコマンドの基礎〜実務でよく使う操作を30問で確認します。満点クリアで次のレベルに進めます。',
    path: '/training/linux-level1',
  },
]

function getStatusBadge(snap: TraineeProgressSnapshot | null, index: number): { label: string; color: string; bg: string } | null {
  if (!snap) return null
  if (index === 0) {
    if (snap.infra1Cleared) return { label: '完了', color: '#047857', bg: '#d1fae5' }
    if (snap.infra1Checkboxes?.some(Boolean)) return { label: '実施中', color: '#92400e', bg: '#fef3c7' }
    return { label: '未着手', color: '#64748b', bg: '#f1f5f9' }
  }
  if (index === 1) {
    if (snap.l1Cleared) return { label: '完了', color: '#047857', bg: '#d1fae5' }
    const hasProgress = (snap.l1CurrentPart ?? 0) > 0 || (snap.l1CurrentQuestion ?? 0) > 0 || (snap.l1WrongIds?.length ?? 0) > 0
    if (hasProgress) {
      const partNum = (snap.l1CurrentPart ?? 0) + 1
      const qNum = (snap.l1CurrentQuestion ?? 0) + 1
      return { label: `実施中: 第${partNum}部 ${qNum}/10問`, color: '#92400e', bg: '#fef3c7' }
    }
    return { label: '未着手', color: '#64748b', bg: '#f1f5f9' }
  }
  return null
}

export function InfraBasicTopPage() {
  const [serverSnapshot, setServerSnapshot] = useState<TraineeProgressSnapshot | null>(null)
  const taskProgress = getTaskProgressList().find((t) => t.id === 'infra-basic-1')
  const subTasks = taskProgress?.subTasks ?? []

  useEffect(() => {
    document.title = 'Linux基本操作'
  }, [])

  useEffect(() => {
    const load = async () => {
      const username = getCurrentDisplayName()
      if (!username) return
      const snap = await fetchMyProgress(username)
      if (snap) {
        restoreProgressToLocalStorage(username, snap)
        setServerSnapshot(snap)
      }
    }
    load()
  }, [])

  const totalCount = TASKS.length
  const completedCount = subTasks.filter((s) => s.status === 'cleared').length

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-2xl space-y-6">

        <div>
          <h1 className="text-lg font-bold text-slate-800">Linux基本操作</h1>
          <p className="mt-1 text-sm text-slate-600">
            クライアントツールを用いた演習と、Linuxコマンド30問の2つで構成されています。
          </p>
          {taskProgress && (
            <p className="mt-1 text-[11px] text-slate-500">
              目安 {taskProgress.estimatedDays} 日目まで · 期限 {taskProgress.deadline}
              {taskProgress.isDelayed && (
                <span className="ml-2 text-rose-400">遅延</span>
              )}
            </p>
          )}
          {getTrainingStartDate() && (
            <p className="mt-1 text-[10px] text-slate-500">
              「インフラ研修を開始しますか？」を再表示したい場合:{' '}
              <button
                type="button"
                onClick={() => { clearTask1Cache(); window.location.reload() }}
                className="underline hover:text-slate-400"
              >
                課題1のキャッシュを削除
              </button>
            </p>
          )}
        </div>

        {/* 進捗サマリー */}
        {/* 進捗サマリー — color-primary (brand) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#0369a1' }}>
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
            const badge = getStatusBadge(serverSnapshot, index)

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
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isCompleted ? '#10b981' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: '16px', fontSize: '14px', color: isCompleted ? 'white' : '#9ca3af', fontWeight: 600 }}>
                  {isCompleted ? '✓' : index + 1}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>
                    {task.category}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>
                    {task.title}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                    {task.description}
                  </div>
                  {badge && (
                    <span style={{ display: 'inline-block', marginTop: '4px', fontSize: '10px', fontWeight: 500, color: badge.color, background: badge.bg, borderRadius: '9999px', padding: '2px 8px' }}>
                      {badge.label}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, marginLeft: '16px' }}>
                  {/* 開くボタン — color-primary (light sky: 反復遷移系) */}
                  <button
                    type="button"
                    onClick={() => { window.location.href = getTrainingUrl(task.path) }}
                    className="rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-colors"
                    style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 500 }}
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
