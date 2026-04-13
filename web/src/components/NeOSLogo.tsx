/**
 * NeOS IT College 正式ロゴ（指定画像を使用）
 * 全ページでこのコンポーネントに統一すること。ロゴを勝手に変えないこと。
 */

type Props = {
  className?: string
  height?: number
  /** true のとき画像の上部分のみ表示（ログイン画面で「NICプラットフォーム」を隠す） */
  clipTop?: boolean
  noLink?: boolean
}

const LOGO_SRC = '/logo-neos-it-college.png'

export function NeOSLogo({ className = '', height = 48, clipTop = false, noLink = false }: Props) {
  if (clipTop) {
    return (
      <div className={`flex justify-center overflow-hidden ${className}`} style={{ height: 36 }}>
        <img
          src={LOGO_SRC}
          alt="NeOS IT College"
          height={128}
          width={128 * (200 / 60)}
          className="block"
          style={{ mixBlendMode: 'multiply' }}
        />
      </div>
    )
  }
  return (
    <div
      className={`inline-flex items-center ${noLink ? '' : 'cursor-pointer'} ${className}`}
      onClick={noLink ? undefined : () => { window.location.hash = '#/' }}
      title={noLink ? undefined : 'トップに戻る'}
      style={{ backgroundColor: 'transparent' }}
    >
      <img
        src={LOGO_SRC}
        alt="NeOS IT College"
        height={height}
        width={height * (200 / 60)}
        className="h-auto w-auto object-contain"
        style={{ maxHeight: height, mixBlendMode: 'multiply', backgroundColor: 'transparent' }}
      />
    </div>
  )
}
