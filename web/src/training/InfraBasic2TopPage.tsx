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

export function InfraBasic2TopPage() {
  const navigate = useNavigate()
  const taskProgress = getTaskProgressList().find((t) => t.id === 'infra-basic-2')

  useEffect(() => {
    document.title = 'インフラ基礎課題2'
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-8000">TRAINING · INFRA</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-800">インフラ基礎課題2</h1>
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
          ネットワーク実機を用いた調査・記述問題と、TCP/IP理解度チェック10問の2つで構成されています。
        </p>
        {taskProgress && (
          <p className="text-[11px] text-slate-8000">
            目安 {taskProgress.estimatedDays} 日目まで · 期限 {taskProgress.deadline}
            {taskProgress.isDelayed && (
              <span className="ml-2 text-rose-400">遅延</span>
            )}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <p className="text-[11px] text-slate-600">課題2-1 · ネットワーク実践</p>
              <h2 className="mt-1 text-sm font-semibold text-slate-800">ネットワーク実機調査</h2>
              <p className="mt-1 text-[11px] text-slate-600">
                自端末やLAN内の機器・サーバを実際に調査し、IP情報や疎通確認結果をフォームに記録します。
              </p>
            </div>
            <div className="mt-3 flex justify-end">
              <OpenInNewTabButton
                url={getTrainingUrl('/training/infra-basic-2-1')}
                className="btn-wiggle bg-indigo-600 text-white hover:bg-indigo-700"
              />
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <p className="text-[11px] text-slate-600">課題2-2 · TCP/IP</p>
              <h2 className="mt-1 text-sm font-semibold text-slate-800">TCP/IP 理解度チェック10問</h2>
              <p className="mt-1 text-[11px] text-slate-600">
                既存の TCP/IP 理解度チェック10問（インフラ研修2）を、この課題2-2として位置付けます。
              </p>
            </div>
            <div className="mt-3 flex justify-end">
              <OpenInNewTabButton
                url={getTrainingUrl('/training/linux-level2')}
                className="btn-wiggle bg-indigo-600 text-white hover:bg-indigo-700"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

