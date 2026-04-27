import { useEffect, useState } from 'react'
import { getProgressKey } from './trainingWbsData'
import { TrainingQuizFrame } from './TrainingQuizFrame'
import { TCPIP_LEVEL2_QUESTIONS, L2_PROGRESS_KEY, L2_CLEARED_KEY } from './linuxLevel2Data'
import { getCurrentDisplayName } from '../auth'
import { fetchMyProgress, postProgress, isProgressApiAvailable } from '../progressApi'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'

const EMPTY_SNAPSHOT: TraineeProgressSnapshot = {
  introConfirmed: false, introAt: null, wbsPercent: 0,
  chapterProgress: [], currentDay: 0, delayedIds: [], updatedAt: '', pins: [],
}

export function LinuxLevel2Page() {
  const [serverSnapshot, setServerSnapshot] = useState<TraineeProgressSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    document.title = 'インフラ基礎課題2-2 TCP/IP理解度確認10問'
  }, [])

  useEffect(() => {
    const load = async () => {
      const username = getCurrentDisplayName().trim().toLowerCase()
      if (!username || false) {
        setIsLoading(false)
        return
      }
      const snap = await fetchMyProgress(username)
      if (snap) setServerSnapshot(snap)
      setIsLoading(false)
    }
    void load()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">読み込み中...</p>
      </div>
    )
  }

  return (
    <TrainingQuizFrame
      title="インフラ基礎課題2-2 — TCP/IP 理解度確認10問"
      subtitle="TRAINING · INFRA · 2-2 TCP/IP"
      questions={TCPIP_LEVEL2_QUESTIONS}
      totalRequired={10}
      storageKey={getProgressKey(L2_PROGRESS_KEY)}
      serverInitialIndex={serverSnapshot?.l2CurrentQuestion ?? 0}
      onClear={async () => {
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(getProgressKey(L2_CLEARED_KEY), 'true')
          } catch {
            // ignore
          }
        }
        // DynamoDB即時同期：serverSnapshotをベースに変化した値だけ上書き
        const username = getCurrentDisplayName().trim().toLowerCase()
        if (username && isProgressApiAvailable()) {
          const base: TraineeProgressSnapshot = serverSnapshot ?? EMPTY_SNAPSHOT
          await postProgress(username, {
            ...base,
            l2CurrentQuestion: 0,
            l2WrongIds: [],
            updatedAt: new Date().toISOString(),
          })
        }
        window.alert('インフラ研修2をクリアしました。')
      }}
      onInterrupt={async (currentIndex, answers) => {
        const username = getCurrentDisplayName().trim().toLowerCase()
        if (!username || false || !isProgressApiAvailable()) return true
        const base: TraineeProgressSnapshot = serverSnapshot ?? EMPTY_SNAPSHOT
        // 回答済み問題の中で不正解だったIDを算出
        const wrongIds = answers
          .map((ai, qi) => ai !== TCPIP_LEVEL2_QUESTIONS[qi]?.correctIndex ? TCPIP_LEVEL2_QUESTIONS[qi]?.id ?? null : null)
          .filter((id): id is string => id !== null)
        return postProgress(username, {
          ...base,
          l2CurrentQuestion: currentIndex,
          l2WrongIds: wrongIds,
          lastActive: {
            moduleId: 'linux-level2',
            label: `課題2-2 · TCP/IP ${currentIndex}/${TCPIP_LEVEL2_QUESTIONS.length}問`,
            path: '/training/linux-level2',
            savedAt: new Date().toISOString(),
          },
          updatedAt: new Date().toISOString(),
        })
      }}
    />
  )
}
