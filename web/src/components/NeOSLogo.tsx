/**
 * NeOS IT College 正式ロゴ（指定画像を使用）
 * 全ページでこのコンポーネントに統一すること。ロゴを勝手に変えないこと。
 */

type Props = {
  className?: string
  height?: number
}

const LOGO_SRC = '/logo-neos-it-college.png'

export function NeOSLogo({ className = '', height = 48 }: Props) {
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
