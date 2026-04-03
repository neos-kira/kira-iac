import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProgressKey } from './trainingWbsData'
import { TrainingQuizFrame } from './TrainingQuizFrame'
import { TCPIP_LEVEL2_QUESTIONS, L2_PROGRESS_KEY, L2_CLEARED_KEY } from './linuxLevel2Data'
import { getCurrentDisplayName } from '../auth'
import { fetchMyProgress, postProgress, isProgressApiAvailable } from '../progressApi'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'

export function LinuxLevel2Page() {
  const navigate = useNavigate()
  const [serverSnapshot, setServerSnapshot] = useState<TraineeProgressSnapshot | null>(null)

  useEffect(() => {
    document.title = 'インフラ基礎課題2-2 TCP/IP理解度チェック10問'
  }, [])

  useEffect(() => {
    const username = getCurrentDisplayName().trim().toLowerCase()
    if (!username || username === 'admin') return
    fetchMyProgress(username).then(snap => { if (snap) setServerSnapshot(snap) })
  }, [])

  return (
    <TrainingQuizFrame
      title="インフラ基礎課題2-2 — TCP/IP 理解度チェック10問"
      subtitle="TRAINING · INFRA · 2-2 TCP/IP"
      questions={TCPIP_LEVEL2_QUESTIONS}
      totalRequired={10}
      storageKey={getProgressKey(L2_PROGRESS_KEY)}
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
        if (username && username !== 'admin' && isProgressApiAvailable()) {
          const base: TraineeProgressSnapshot = serverSnapshot ?? {
            introConfirmed: false, introAt: null, wbsPercent: 0, chapterProgress: [],
            currentDay: 0, delayedIds: [], updatedAt: '', pins: [],
          }
          await postProgress(username, {
            ...base,
            l2CurrentQuestion: 0,
            l2WrongIds: [],
            updatedAt: new Date().toISOString(),
          })
        }
        window.alert('インフラ研修2をクリアしました。')
      }}
      onInterrupt={() => {
        navigate('/')
      }}
    />
  )
}
