/**
 * セマンティック カラートークン
 *
 * このファイルで定義した定数以外のカラー数値を直接 style= に書くことを禁止します。
 * CSS側の定義は index.css の :root { --color-* } と同期しています。
 *
 * ─── アクション3階層 ───────────────────────────────────────
 * primaryStrong      : #0ea5e9  1画面に1つの最重要CTA（ログイン・最終送信等）
 *                                Tailwind: bg-sky-500 text-white hover:bg-sky-600
 * primary (light)    :          反復遷移系（開く・つづきから・詳細へ等）
 *                                Tailwind: bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100
 *                                inline style: use C.primaryLightBg / primaryLightText / primaryLightBorder
 * primaryGhost       :          三次アクション（キャンセル・後で・スキップ等）
 *                                Tailwind: bg-transparent text-sky-700 hover:bg-sky-50
 *
 * ─── ブランド ─────────────────────────────────────────────
 * brand              : #7dd3fc  ライトブランドカラー（ボーダー・薄背景・プログレスバー）
 * brandHover         : #38bdf8
 *
 * ─── セマンティック ───────────────────────────────────────
 * success            : #10b981  達成・完了・合格・EC2実行中 (emerald-500)
 * successBg          : #ecfdf5  (emerald-50)
 * successText        : #047857  (emerald-700)
 * warning            : #f59e0b  遅延・注意 (amber-500)
 * danger             : #ef4444  エラー・不合格 (red-500)
 */
export const C = {
  // アクション3階層 (inline style用)
  primaryStrong: '#0ea5e9',       // sky-500 — 1画面に1つのCTA
  primaryStrongHover: '#0284c7',  // sky-600
  primaryLightBg: '#f0f9ff',      // sky-50  — 反復遷移ボタン背景
  primaryLightText: '#0369a1',    // sky-700
  primaryLightBorder: '#bae6fd',  // sky-200
  primaryLightHover: '#e0f2fe',   // sky-100

  // ブランド
  brand: '#7dd3fc',               // sky-300 — プログレスバー・アクセント
  brandHover: '#38bdf8',          // sky-400

  // 後方互換エイリアス (既存コードが参照中)
  primary: '#7dd3fc',
  primaryHover: '#38bdf8',
  action: '#0ea5e9',
  actionHover: '#0284c7',

  // セマンティック
  success: '#10b981',             // emerald-500 — 達成・完了・合格・EC2実行中
  successBg: '#ecfdf5',           // emerald-50
  successText: '#047857',         // emerald-700
  warning: '#f59e0b',             // amber-500
  danger: '#ef4444',              // red-500
} as const
