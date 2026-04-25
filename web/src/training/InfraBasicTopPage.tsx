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
            const badge = getStatusBadge(serverSnapshot, index)

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
                  {badge && (
                    <span className="text-sublabel md:text-sublabel-pc inline-block mt-1 font-medium rounded-full px-2 py-0.5"
                      style={{ color: badge.color, background: badge.bg }}>
                      {badge.label}
                    </span>
                  )}
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
