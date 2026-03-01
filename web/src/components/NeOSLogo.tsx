/**
 * NeOS IT College 正式ロゴ（指定画像を使用）
 * 全ページでこのコンポーネントに統一すること。ロゴを勝手に変えないこと。
 */

type Props = {
  className?: string
  height?: number
  /** true のとき画像の上部分のみ表示（ログイン画面で「NICプラットフォーム」を隠す） */
  clipTop?: boolean
}

const LOGO_SRC = '/logo-neos-it-college.png'

export function NeOSLogo({ className = '', height = 48, clipTop = false }: Props) {
  if (clipTop) {
    return (
      <div className={`flex justify-center overflow-hidden ${className}`} style={{ height: 56 }}>
        <img
          src={LOGO_SRC}
          alt="NeOS IT College"
          height={128}
          width={128 * (200 / 60)}
          className="block"
        />
      </div>
    )
  }
  return (
    <div className={`inline-flex items-center ${className}`}>
      <img
        src={LOGO_SRC}
        alt="NeOS IT College"
        height={height}
        width={height * (200 / 60)}
        className="h-auto w-auto object-contain"
        style={{ maxHeight: height }}
      />
    </div>
  )
}
