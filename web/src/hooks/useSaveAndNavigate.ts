import { useCallback } from 'react'
import { useSafeNavigate } from './useSafeNavigate'

/**
 * 保存処理 + 安全なナビゲートをセットで行うフック。
 * 「中断して保存」パターン向け。
 *
 * 使い方:
 *   const saveAndNavigate = useSaveAndNavigate()
 *   await saveAndNavigate(() => postProgress(...), '/training/infra-basic-top')
 */
export function useSaveAndNavigate() {
  const safeNavigate = useSafeNavigate()

  return useCallback(
    async (saveFn: () => Promise<void>, to: string) => {
      try {
        await saveFn()
      } finally {
        safeNavigate(to)
      }
    },
    [safeNavigate],
  )
}
