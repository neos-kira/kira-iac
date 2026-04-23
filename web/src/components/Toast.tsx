import { useEffect, useState } from 'react'

type Props = {
  message: string
  type: 'success' | 'warning'
  onClose: () => void
}

export function Toast({ message, type, onClose }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 16)    // フェードイン
    const t2 = setTimeout(() => setVisible(false), 1700) // フェードアウト開始
    const t3 = setTimeout(onClose, 2000)                 // 消滅
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onClose])

  return (
    <div
      style={{ zIndex: 1300 }}
      className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-md text-sm text-white transition-opacity duration-300
        ${visible ? 'opacity-100' : 'opacity-0'}
        ${type === 'success' ? 'bg-green-500' : 'bg-amber-500'}`}
    >
      {message}
    </div>
  )
}
