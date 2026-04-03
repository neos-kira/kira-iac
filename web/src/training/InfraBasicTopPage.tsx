import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OpenInNewTabButton } from '../components/OpenInNewTabButton'
import { getTaskProgressList, getTrainingStartDate, setTrainingStartDateFromTask1Start, clearTask1Cache } from './trainingWbsData'
import { getCurrentDisplayName } from '../auth'
import { fetchMyProgress, postProgress } from '../progressApi'
import { restoreProgressToLocalStorage, getCurrentProgressSnapshot } from '../traineeProgressStorage'

function getTrainingUrl(path: string) {
  const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname || '/'}`.replace(/\/$/, '') || window.location.origin : ''
  return `${base}#${path}`
}

export function InfraBasicTopPage() {
  const navigate = useNavigate()
  const [showStartConfirm, setShowStartConfirm] = useState(false)
  const [showStartMessage, setShowStartMessage] = useState(false)
  const taskProgress = getTaskProgressList().find((t) => t.id === 'infra-basic-1')

  useEffect(() => {
    document.title = 'インフラ基礎課題1'
  }, [])

  useEffect(() => {
    // localStorage に開始日がなければサーバーから復元を試みてから判定する。
    // App.tsx の非同期フェッチより先にこのページが表示された場合のレースコンディション対策。
    const checkAfterRestore = async () => {
      if (!getTrainingStartDate()) {
        const username = getCurrentDisplayName()
        if (username && username.toLowerCase() !== 'admin') {
          const snap = await fetchMyProgress(username)
          if (snap) restoreProgressToLocalStorage(username, snap)
        }
      }
      if (!getTrainingStartDate()) {
        setShowStartConfirm(true)
      }
    }
    checkAfterRestore()
  }, [])

  const handleConfirmStart = () => {
    setTrainingStartDateFromTask1Start()
    setShowStartConfirm(false)
    setShowStartMessage(true)
    // localStorage に保存後、即座にサーバーへ同期する。
    // App.tsx のインターバルはこのルートでは動いていないため、ここで明示的に POST する。
    const username = getCurrentDisplayName()
    if (username && username.toLowerCase() !== 'admin') {
      const snap = getCurrentProgressSnapshot()
      postProgress(username, snap)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        {showStartConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <h2 className="text-base font-semibold text-slate-800">インフラ研修を開始しますか？</h2>
              <p className="mt-3 text-[13px] text-slate-600">
                開始すると、開始日から土日祝日を除いた営業日で課題1〜3の期限が設定され、WBSで進捗を確認できます。
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={handleConfirmStart}
                  className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  開始する
                </button>
                <button
                  type="button"
                  onClick={() => setShowStartConfirm(false)}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}
        {showStartMessage && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700">
            <p className="font-medium text-indigo-700">研修を開始します。</p>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
              土日祝日を除いた日程で期限設定しますので、期限を守りながら研修を進めていきましょう。
            </p>
            <button
              type="button"
              onClick={() => setShowStartMessage(false)}
              className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
            >
              閉じる
            </button>
          </div>
        )}
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
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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

          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
