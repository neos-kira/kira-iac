import { useEffect, useState } from 'react'
import { IT_BASICS_CATEGORIES } from '../itBasicsData'
import { getCurrentDisplayName } from '../../auth'
import { fetchMyProgress } from '../../progressApi'
import type { TraineeProgressSnapshot } from '../../traineeProgressStorage'

function getTrainingUrl(path: string) {
  const base =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname || '/'}`.replace(/\/$/, '') || window.location.origin
      : ''
  return `${base}#${path}`
}

export function ITBasicsTopPage() {
  const [serverSnapshot, setServerSnapshot] = useState<TraineeProgressSnapshot | null>(null)

  useEffect(() => {
    document.title = 'IT業界の歩き方'
  }, [])

  useEffect(() => {
    const load = async () => {
      const username = getCurrentDisplayName().trim().toLowerCase()
      if (!username || username === 'admin') return
      const snap = await fetchMyProgress(username)
      if (snap) setServerSnapshot(snap)
    }
    void load()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6">
      <div className="mx-auto max-w-2xl space-y-6">

        <div>
          <h1 className="text-lg font-bold text-slate-800">IT業界の歩き方</h1>
          <p className="mt-1 text-sm text-slate-600">
            ITエンジニアとして働くための基礎知識を6カテゴリで学びます。各カテゴリの座学を読んでからテストに挑戦してください。
          </p>
          <p className="mt-2 text-xs text-slate-500">各テストは30問の中からランダムで10問出題されます。</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {IT_BASICS_CATEGORIES.map((cat) => {
            const isPassed = serverSnapshot?.itBasicsPassed?.[cat.id] === true
            return (
              <div
                key={cat.id}
                className={`flex flex-col justify-between rounded-2xl border p-5 shadow-sm ${isPassed ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{cat.subtitle}</p>
                    {isPassed && (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        合格
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1 text-sm font-semibold text-slate-800">{cat.title}</h2>
                  <p className="mt-2 text-[12px] text-slate-600 leading-relaxed">{cat.description}</p>
                  <p className="mt-2 text-[11px] text-slate-400">合格ライン: {cat.passingScore}/10問</p>
                </div>
                <div className="mt-4 flex gap-2">
                  <a
                    href={getTrainingUrl(`/it-basics/${cat.id}/study`)}
                    className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-center text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    座学
                  </a>
                  <a
                    href={getTrainingUrl(`/it-basics/${cat.id}/test`)}
                    className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-medium ${isPassed ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' : 'bg-teal-600 text-white hover:bg-teal-700'}`}
                  >
                    {isPassed ? '再テスト' : 'テスト'}
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
