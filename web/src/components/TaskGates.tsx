import { useEffect } from 'react'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
import { isTask1Cleared, isTask2Cleared } from '../training/trainingWbsData'
import { getCurrentUsername } from '../auth'

type Props = { children: React.ReactNode }

function isBypassUser(): boolean {
  try {
    const name = getCurrentUsername()
    return name === 'kira-test'
  } catch {
    return false
  }
}

// TODO: 仕様確定後にガードを再適用すること。
// 現在 main.tsx では Task1Gate / Task2Gate は使用されていない（ネットワーク基礎・ファイル操作・viのガードを解除済み）。

/**
 * インフラ基礎課題1が未完了の場合、課題2・3・4へのアクセスをブロックし課題1へリダイレクトする。
 * IntroGate の内側で使用すること（はじめに完了が前提）。
 */
export function Task1Gate({ children }: Props) {
  const navigate = useSafeNavigate()

  useEffect(() => {
    if (!isBypassUser() && !isTask1Cleared()) {
      navigate('/training/infra-basic-top', { replace: true })
    }
  }, [navigate])

  if (!isBypassUser() && !isTask1Cleared()) {
    return null
  }
  return <>{children}</>
}

/**
 * インフラ基礎課題2が未完了の場合、課題3・4へのアクセスをブロックし課題2へリダイレクトする。
 * IntroGate + Task1Gate の内側で使用すること。
 */
export function Task2Gate({ children }: Props) {
  const navigate = useSafeNavigate()

  useEffect(() => {
    if (!isBypassUser() && !isTask2Cleared()) {
      navigate('/training/infra-basic-2-top', { replace: true })
    }
  }, [navigate])

  if (!isBypassUser() && !isTask2Cleared()) {
    return null
  }
  return <>{children}</>
}
