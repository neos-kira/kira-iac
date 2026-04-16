import { useCallback, useEffect, useRef } from 'react'
import { useNavigate, type NavigateOptions } from 'react-router-dom'

/**
 * navigate() を queueMicrotask でレンダーサイクル外に遅延させる安全版フック。
 * アンマウント後の navigate も防ぐ。
 * React error #300 ("Cannot update a component while rendering a different component") を防止する。
 */
export function useSafeNavigate() {
  const navigate = useNavigate()
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  return useCallback(
    (to: string, options?: NavigateOptions) => {
      queueMicrotask(() => {
        if (isMountedRef.current) {
          navigate(to, options)
        }
      })
    },
    [navigate],
  )
}
