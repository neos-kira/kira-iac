/**
 * インフラ基礎課題4: vi演習 + シェルスクリプト演習（2部構成）
 * - 4-1 vi操作マスター（厳選10問）
 * - 4-2 シェルスクリプト演習（厳選10問）
 */

export const INFRA_BASIC_4_STORAGE_PREFIX = 'kira-infra-basic-4'

/** 課題4（全体）のクリアフラグ */
export const INFRA_BASIC_4_CLEARED_KEY = `${INFRA_BASIC_4_STORAGE_PREFIX}-all-cleared`

/** 4-1 vi 操作（全20ステップ）の完了フラグ（WBS用） */
export const INFRA_BASIC_4_VI_ALL_CLEARED_KEY = `${INFRA_BASIC_4_STORAGE_PREFIX}-vi-all-cleared`

/** 4-2 シェルスクリプト（全11問）の完了フラグ（WBS用） */
export const INFRA_BASIC_4_SHELL_ALL_CLEARED_KEY = `${INFRA_BASIC_4_STORAGE_PREFIX}-shell-all-cleared`

/** 課題4（全体）のRAGステータス（green / yellow / red） */
export const INFRA_BASIC_4_RAG_KEY = `${INFRA_BASIC_4_STORAGE_PREFIX}-rag`

export type InfraBasic4Rag = 'green' | 'yellow' | 'red'

export type ViStepDef = { step: number; label: string }
export type ShellQuestionDef = { q: number; title: string; detail: string }

export const VI_STEPS: ViStepDef[] = [
  { step: 1, label: 'viNeOS を新規作成して開く（vi viNeOS）' },
  { step: 2, label: '1行目に自己紹介文を書き、:wq で保存して終了する' },
  { step: 3, label: '行番号表示をONにする（:set number）' },
  { step: 4, label: '任意の単語を / 検索し、n / N で移動する' },
  { step: 5, label: '1行削除（dd）と複数行削除（3dd）を試す' },
  { step: 6, label: 'yy / p で1行コピー＆貼り付けを行う' },
  { step: 7, label: '0 / $ / gg / G で行頭・行末・先頭・末尾へ移動する' },
  { step: 8, label: 'u / Ctrl+r で取り消しとやり直しを試す' },
  { step: 9, label: ':%s/old/new/g で全置換を実行する' },
  { step: 10, label: ':%s/old/new/gc で確認付き置換を実行する' },
]

export const SHELL_QUESTIONS: ShellQuestionDef[] = [
  { q: 1, title: '引数チェック', detail: '引数が無い場合は使い方を表示して終了するスクリプト' },
  { q: 2, title: '変数とダブルクォート', detail: '変数展開を必ずダブルクォートで囲むスクリプト' },
  { q: 3, title: 'if と終了ステータス', detail: 'コマンド成功/失敗でメッセージを切り替えるスクリプト' },
  { q: 4, title: 'for ループ', detail: '1〜3 をループして表示するスクリプト' },
  { q: 5, title: 'while ループ', detail: '条件を満たすまでカウントアップするスクリプト' },
  { q: 6, title: '関数化', detail: 'メッセージ出力処理を関数に切り出したスクリプト' },
  { q: 7, title: 'ファイル存在チェック', detail: '指定ファイルが無ければエラー終了するスクリプト' },
  { q: 8, title: 'ログ出力', detail: '日時付きでログファイルに追記するスクリプト' },
  { q: 9, title: '標準出力/標準エラー', detail: '正常系と異常系で出力先を分けるスクリプト' },
  { q: 10, title: '堅牢化', detail: 'set -euo pipefail の考え方を取り入れたスクリプト' },
]

export function getViStepKey(step: number): string {
  return `${INFRA_BASIC_4_STORAGE_PREFIX}-vi-step-${step}`
}

export function getShellQuestionKey(q: number): string {
  return `${INFRA_BASIC_4_STORAGE_PREFIX}-shell-q-${q}`
}
