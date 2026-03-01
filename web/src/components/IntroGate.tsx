import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getIntroConfirmed } from '../training/introGate'

type Props = { children: React.ReactNode }

/**
 * はじめに（プロフェッショナル確認テスト）未完了の場合、
 * インフラ基礎課題へのアクセスをブロックし /training/intro へリダイレクトする。
 */
export function IntroGate({ children }: Props) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!getIntroConfirmed()) {
      navigate('/training/intro', { replace: true })
    }
  }, [navigate])

  if (!getIntroConfirmed()) {
    return null
  }
  return <>{children}</>
}
