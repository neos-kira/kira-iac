import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProgressKey } from './trainingWbsData'
import {
  AL2023_DAYS,
  INFRA_BASIC_4_CLEARED_KEY,
  getDayClearedKey,
  getDayDevLogKey,
  loadDayDevLog,
  saveDayDevLog,
  isDayCleared,
  setDayCleared,
  setAl2023AllClearedIfDone,
  getAl2023ClearedCount,
} from './InfraBasic4Data'

function getTrainingUrl(path: string): string {
  const base =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname || '/'}`.replace(/\/$/, '') || window.location.origin
      : ''
  return `${base}#${path}`
}

function useProgressKeys() {
  const resolveClearedKey = useCallback((day: number) => getProgressKey(getDayClearedKey(day)), [])
  const resolveDevLogKey = useCallback((day: number) => getProgressKey(getDayDevLogKey(day)), [])
  return { resolveClearedKey, resolveDevLogKey }
}

export function InfraBasic4Page() {
  const navigate = useNavigate()
  const { resolveClearedKey, resolveDevLogKey } = useProgressKeys()
  const [devLogs, setDevLogs] = useState<Record<number, string>>(() =>
    Object.fromEntries(AL2023_DAYS.map((d) => [d.day, loadDayDevLog(d.day, resolveDevLogKey(d.day))]))
  )
  const [cleared, setCleared] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(AL2023_DAYS.map((d) => [d.day, isDayCleared(d.day, resolveClearedKey(d.day))]))
  )
  const clearedCount = getAl2023ClearedCount(resolveClearedKey)

  const refreshCleared = useCallback(() => {
    setCleared(Object.fromEntries(AL2023_DAYS.map((d) => [d.day, isDayCleared(d.day, resolveClearedKey(d.day))])))
  }, [resolveClearedKey])

  useEffect(() => {
    document.title = 'インフラ基礎課題4 - AL2023 10日間プロジェクト'
  }, [])

  const handleDevLogChange = (day: number, value: string) => {
    setDevLogs((prev) => ({ ...prev, [day]: value }))
    saveDayDevLog(day, value, resolveDevLogKey(day))
  }

  const handleMarkDayComplete = (day: number, done: boolean) => {
    setDayCleared(day, done, resolveClearedKey(day))
    setAl2023AllClearedIfDone(getProgressKey(INFRA_BASIC_4_CLEARED_KEY), resolveClearedKey)
    refreshCleared()
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* ヘッダー */}
        <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 text-2xl" aria-hidden>🖥️</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">TRAINING · INFRA</p>
              <h1 className="mt-0.5 bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-2xl font-bold text-transparent">
                インフラ基礎課題4（Amazon Linux 2023 構築プロジェクト）
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2">
              <span className="text-xs text-slate-400">進捗</span>
              <p className="text-lg font-bold text-white">{clearedCount} / 10 日</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700"
            >
              トップへ戻る
            </button>
          </div>
        </header>

        <p className="text-sm text-slate-400 mb-8">
          Amazon Linux 2 から AL2023 への移行・新規構築をテーマとした10日間の工程です。各日の作業ログ（DevLog）と品質チェックで実務ワークフローを管理します。
        </p>

        {/* Day 1〜10 */}
        <div className="space-y-8">
          {AL2023_DAYS.map((dayDef) => {
            const isCleared = cleared[dayDef.day]
            const devLog = devLogs[dayDef.day] ?? ''

            return (
              <section
                key={dayDef.day}
                className="rounded-2xl border border-slate-700 bg-slate-800/60 shadow-xl overflow-hidden"
              >
                {/* Day ヘッダー */}
                <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-700 bg-slate-900/50">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-violet-600/80 to-purple-600/80 text-lg font-bold text-white">
                      Day {dayDef.day}
                    </span>
                    <div>
                      <h2 className="text-base font-bold text-white">{dayDef.title}</h2>
                      <p className="text-xs text-slate-400 mt-0.5">{dayDef.description}</p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isCleared}
                      onChange={(e) => handleMarkDayComplete(dayDef.day, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-violet-500 focus:ring-violet-500"
                    />
                    <span className="text-sm font-medium text-slate-300">この工程を完了にする</span>
                  </label>
                </div>

                <div className="p-5 space-y-5">
                  {/* 目的 */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">目的</p>
                    <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
                      {dayDef.objectives.map((obj, i) => (
                        <li key={i}>{obj}</li>
                      ))}
                    </ul>
                  </div>

                  {/* 作業日記（DevLog）ターミナル風 */}
                  <div>
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                      <span aria-hidden>⚙️</span> 作業ログ（DevLog）
                    </p>
                    <div className="rounded-xl border border-slate-600 bg-slate-950 overflow-hidden font-mono text-sm">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-800/80 text-slate-400 text-xs">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="ml-2">terminal — コマンドや気づきを記録</span>
                      </div>
                      <textarea
                        value={devLog}
                        onChange={(e) => handleDevLogChange(dayDef.day, e.target.value)}
                        placeholder={`# Day ${dayDef.day} の作業メモ\n$ command\n# 気づき・メモ`}
                        className="w-full min-h-[140px] p-4 bg-slate-950 text-slate-300 placeholder:text-slate-600 resize-y focus:outline-none focus:ring-0"
                        spellCheck={false}
                      />
                    </div>
                  </div>

                  {/* QA（品質保証）セクション */}
                  <div>
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                      <span aria-hidden>✅</span> 品質チェック項目
                    </p>
                    <div className="grid gap-3 sm:grid-cols-1">
                      {dayDef.qaChecklist.map((qa, i) => (
                        <div
                          key={i}
                          className="flex gap-3 rounded-xl border border-slate-600 bg-slate-900/50 p-4"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-base" aria-hidden>
                            {qa.icon}
                          </span>
                          <div>
                            <p className="font-medium text-slate-200">{qa.label}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{qa.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )
          })}
        </div>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => (window.location.href = getTrainingUrl('/'))}
            className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-violet-500 hover:to-purple-500"
          >
            トップに戻る
          </button>
        </div>
      </div>
    </div>
  )
}
