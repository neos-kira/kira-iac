/**
 * z-index レイヤートークン
 *
 * このファイルで定義した定数以外の z-index 数値を直接コードに書くことを禁止します。
 * CSS側の定義は index.css の :root { --z-* } と同期しています。
 *
 * layer-base           : auto  通常フロー
 * layer-sticky         :  100  スティッキーヘッダー等
 * layer-dropdown       : 1000  ユーザーメニュー・セレクト
 * layer-floating-panel : 1100  AI講師チャットパネル
 * layer-modal          : 1200  モーダル
 * layer-toast          : 1300  通知トースト
 * layer-tooltip        : 1400  ツールチップ
 */
export const Z = {
  sticky: 100,
  dropdown: 1000,
  floatingPanel: 1100,
  /** floating-panel の背面レイヤー（展開パネル本体・overlay など） */
  floatingPanelBehind: 1099,
  modal: 1200,
  toast: 1300,
  tooltip: 1400,
} as const

/**
 * ガントチャート等の単一コンポーネント内部専用レイヤー。
 * position:relative な親要素の中でのみ有効で、グローバルには影響しない。
 */
export const ZChart = {
  bar: 2,
  barProgress: 3,
  todayLineSub: 5,
  todayLine: 10,
} as const
