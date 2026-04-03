import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProgressKey } from './trainingWbsData'
import { TrainingQuizFrame } from './TrainingQuizFrame'
import { TCPIP_LEVEL2_QUESTIONS, L2_PROGRESS_KEY, L2_CLEARED_KEY } from './linuxLevel2Data'
import { getCurrentDisplayName } from '../auth'
import { postProgress, isProgressApiAvailable } from '../progressApi'
import { getCurrentProgressSnapshot } from '../traineeProgressStorage'

export function LinuxLevel2Page() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'インフラ基礎課題2-2 TCP/IP理解度チェック10問'
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
        // ① localStorage書き込み完了後にDynamoDB即時同期
        const username = getCurrentDisplayName().trim().toLowerCase()
        if (username && username !== 'admin' && isProgressApiAvailable()) {
          const snap = getCurrentProgressSnapshot()
          await postProgress(username, snap)
        }
        window.alert('インフラ研修2をクリアしました。')
      }}
      onInterrupt={() => {
        navigate('/')
      }}
    />
  )
}
