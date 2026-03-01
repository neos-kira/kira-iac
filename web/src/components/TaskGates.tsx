import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isTask1Cleared, isTask2Cleared } from '../training/trainingWbsData'

type Props = { children: React.ReactNode }

/**
 * インフラ基礎課題1が未完了の場合、課題2・3・4へのアクセスをブロックし課題1へリダイレクトする。
 * IntroGate の内側で使用すること（はじめに完了が前提）。
 */
export function Task1Gate({ children }: Props) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isTask1Cleared()) {
      navigate('/training/infra-basic-top', { replace: true })
    }
  }, [navigate])

  if (!isTask1Cleared()) {
    return null
  }
  return <>{children}</>
}

/**
 * インフラ基礎課題2が未完了の場合、課題3・4へのアクセスをブロックし課題2へリダイレクトする。
 * IntroGate + Task1Gate の内側で使用すること。
 */
export function Task2Gate({ children }: Props) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isTask2Cleared()) {
      navigate('/training/infra-basic-2-top', { replace: true })
    }
  }, [navigate])

  if (!isTask2Cleared()) {
    return null
  }
  return <>{children}</>
}
