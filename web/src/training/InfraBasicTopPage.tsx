import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OpenInNewTabButton } from '../components/OpenInNewTabButton'
import { getTaskProgressList, getTrainingStartDate, clearTask1Cache } from './trainingWbsData'
import { getCurrentDisplayName } from '../auth'
import { fetchMyProgress } from '../progressApi'
import { restoreProgressToLocalStorage, type TraineeProgressSnapshot } from '../traineeProgressStorage'

function getTrainingUrl(path: string) {
  const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname || '/'}`.replace(/\/$/, '') || window.location.origin : ''
  return `${base}#${path}`
}

export function InfraBasicTopPage() {
  const navigate = useNavigate()
  const [serverSnapshot, setServerSnapshot] = useState<TraineeProgressSnapshot | null>(null)
  const taskProgress = getTaskProgressList().find((t) => t.id === 'infra-basic-1')

  useEffect(() => {
    document.title = 'インフラ基礎課題1'
  }, [])

  useEffect(() => {
    // バッジ表示用にサーバーデータを取得・復元する
    const load = async () => {
      const username = getCurrentDisplayName()
      if (!username || username.toLowerCase() === 'admin') return
      const snap = await fetchMyProgress(username)
      if (snap) {
        restoreProgressToLocalStorage(username, snap)
        setServerSnapshot(snap)
      }
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">TRAINING · INFRA</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-800">インフラ基礎課題1</h1>
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
          クライアントツールを用いた演習と、Linuxコマンド30問の2つで構成されています。
        </p>
        {taskProgress && (
          <p className="text-[11px] text-slate-600">
            目安 {taskProgress.estimatedDays} 日目まで · 期限 {taskProgress.deadline}
            {taskProgress.isDelayed && (
              <span className="ml-2 text-rose-400">遅延</span>
            )}
          </p>
        )}
        {getTrainingStartDate() && (
          <p className="text-[10px] text-slate-600">
            「インフラ研修を開始しますか？」を再表示したい場合:{' '}
            <button
              type="button"
              onClick={() => {
                clearTask1Cache()
                window.location.reload()
              }}
              className="underline hover:text-slate-400"
            >
              課題1のキャッシュを削除
            </button>
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {/* 課題1-1 カード */}
          <div className="relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {serverSnapshot !== null && (() => {
              if (serverSnapshot.infra1Cleared) {
                return <span className="absolute right-3 top-3 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">完了</span>
              }
              if (serverSnapshot.infra1Checkboxes?.some(Boolean)) {
                return <span className="absolute right-3 top-3 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">実施中</span>
              }
              return <span className="absolute right-3 top-3 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">未着手</span>
            })()}
            <div>
              <p className="text-[11px] text-slate-500">課題1-1 · 使用ツール</p>
              <h2 className="mt-1 text-sm font-semibold text-slate-800">インフラ基礎演習1</h2>
              <p className="mt-1 text-[11px] text-slate-600">
                TeraTerm / sakuraエディタ / WinMerge / WinSCP を使った接続・ファイル作成・差分・転送の演習です。
              </p>
            </div>
            <div className="mt-3 flex justify-end">
              <OpenInNewTabButton
                url={getTrainingUrl('/training/infra-basic-1')}
                className="btn-wiggle bg-indigo-600 text-white hover:bg-indigo-700"
              />
            </div>
          </div>

          {/* 課題1-2 カード */}
          <div className="relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {serverSnapshot !== null && (() => {
              if (serverSnapshot.l1Cleared) {
                return <span className="absolute right-3 top-3 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">完了</span>
              }
              const hasL1Progress = (serverSnapshot.l1CurrentPart ?? 0) > 0 || (serverSnapshot.l1CurrentQuestion ?? 0) > 0 || (serverSnapshot.l1WrongIds?.length ?? 0) > 0
              if (hasL1Progress) {
                const partNum = (serverSnapshot.l1CurrentPart ?? 0) + 1
                const qNum = (serverSnapshot.l1CurrentQuestion ?? 0) + 1
                return <span className="absolute right-3 top-3 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">実施中: 第{partNum}部 {qNum}/10問</span>
              }
              return <span className="absolute right-3 top-3 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">未着手</span>
            })()}
            <div>
              <p className="text-[11px] text-slate-500">課題1-2 · LINUXコマンド</p>
              <h2 className="mt-1 text-sm font-semibold text-slate-800">Linuxコマンド30問</h2>
              <p className="mt-1 text-[11px] text-slate-600">
                Linuxコマンドの基礎〜実務でよく使う操作を30問で確認します。満点クリアで次のレベルに進めます。
              </p>
            </div>
            <div className="mt-3 flex justify-end">
              <OpenInNewTabButton
                url={getTrainingUrl('/training/linux-level1')}
                className="btn-wiggle bg-indigo-600 text-white hover:bg-indigo-700"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
