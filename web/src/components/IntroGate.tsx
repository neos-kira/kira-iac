import { useEffect, useState } from 'react'
import { useSafeNavigate } from '../hooks/useSafeNavigate'
import { fetchMyProgress } from '../progressApi'
import { getCurrentDisplayName } from '../auth'

type Props = { children: React.ReactNode }

/**
 * はじめに（プロフェッショナル確認テスト）未完了の場合、
 * インフラ基礎課題へのアクセスをブロックし /training/intro へリダイレクトする。
 * serverSnapshotベースで判定する（localStorage非依存）。
 */
export function IntroGate({ children }: Props) {
  const navigate = useSafeNavigate()
  const [status, setStatus] = useState<'loading' | 'allowed' | 'blocked'>('loading')

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      const username = getCurrentDisplayName().trim().toLowerCase()
      if (!username || username === 'kira-test') {
        if (!cancelled) setStatus('allowed')
        return
      }
      const snap = await fetchMyProgress(username)
      if (cancelled) return
      const completed = !!snap && Number(snap.introStep ?? 0) >= 6 && snap.introConfirmed === true
      setStatus(completed ? 'allowed' : 'blocked')
    }
    void check()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (status === 'blocked') {
      navigate('/training/intro', { replace: true })
    }
  }, [status, navigate])

  if (status !== 'allowed') return null
  return <>{children}</>
}
