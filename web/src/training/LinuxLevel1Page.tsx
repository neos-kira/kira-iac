import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrainingCommandQuizFrame } from './TrainingCommandQuizFrame'
import { LINUX_LEVEL1_QUESTIONS, L1_CLEARED_KEY, L1_PROGRESS_KEY } from './linuxLevel1Data'

export function LinuxLevel1Page() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'インフラ研修1'
  }, [])

  return (
    <TrainingCommandQuizFrame
      title="インフラ研修1 — Linuxコマンド30問"
      subtitle="TRAINING · LINUX · LEVEL 1"
      questions={LINUX_LEVEL1_QUESTIONS}
      totalRequired={30}
      storageKey={L1_PROGRESS_KEY}
      onClear={() => {
        window.localStorage.setItem(L1_CLEARED_KEY, 'true')
        window.alert('インフラ研修1をクリアしました。インフラ研修2にチャレンジできます。')
      }}
      onInterrupt={() => {
        navigate('/')
      }}
    />
  )
}
