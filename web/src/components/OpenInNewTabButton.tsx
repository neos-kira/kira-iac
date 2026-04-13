import { useState, useCallback } from 'react'

type Props = {
  url: string
  disabled?: boolean
  label?: string
  openedLabel?: string
  className?: string
}

export function OpenInNewTabButton({
  url,
  disabled = false,
  label = '開く',
  openedLabel = '開きました',
  className = '',
}: Props) {
  const [justOpened, setJustOpened] = useState(false)

  const handleClick = useCallback(() => {
    if (disabled) return
    window.open(url, '_blank')
    setJustOpened(true)
    window.setTimeout(() => setJustOpened(false), 2200)
  }, [url, disabled])

  if (justOpened) {
    return (
      <span
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-500/60 bg-emerald-600/20 px-3 py-1.5 text-[11px] font-medium text-emerald-300 ${className}`}
        role="status"
        aria-live="polite"
      >
        <span className="inline-block h-3.5 w-3.5 rounded-full bg-emerald-400/80" aria-hidden />
        {openedLabel}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium shadow-soft-card transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {label}
    </button>
  )
}
