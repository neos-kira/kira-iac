/**
 * セマンティック カラートークン
 *
 * このファイルで定義した定数以外のカラー数値を直接 style= に書くことを禁止します。
 * CSS側の定義は index.css の :root { --color-* } と同期しています。
 *
 * primary       : #7dd3fc  ライトブランドカラー（ボーダー・薄背景・brand color）
 * primaryHover  : #38bdf8  ホバー時
 * action        : #0ea5e9  ソリッドボタン（白文字）
 * actionHover   : #0284c7  ソリッドボタンホバー
 * success       : #10b981  達成・完了・合格 (emerald-500)
 * successBg     : #ecfdf5  (emerald-50)
 * successText   : #047857  (emerald-700)
 * warning       : #f59e0b  遅延・注意 (amber-500)
 * danger        : #ef4444  エラー・不合格 (red-500)
 */
export const C = {
  primary: '#7dd3fc',
  primaryHover: '#38bdf8',
  action: '#0ea5e9',
  actionHover: '#0284c7',
  success: '#10b981',
  successBg: '#ecfdf5',
  successText: '#047857',
  warning: '#f59e0b',
  danger: '#ef4444',
} as const
