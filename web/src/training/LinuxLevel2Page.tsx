import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrainingQuizFrame } from './TrainingQuizFrame'
import { TCPIP_LEVEL2_QUESTIONS, L2_PROGRESS_KEY, L2_CLEARED_KEY } from './linuxLevel2Data'

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
      storageKey={L2_PROGRESS_KEY}
      onClear={() => {
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(L2_CLEARED_KEY, 'true')
          } catch {
            // ignore
          }
        }
        window.alert('インフラ研修2をクリアしました。')
      }}
      onInterrupt={() => {
        navigate('/')
      }}
    />
  )
}
