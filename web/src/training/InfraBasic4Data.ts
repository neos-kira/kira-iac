/**
 * インフラ基礎課題4: vi演習 + シェルスクリプト演習（2部構成）
 * - 4-1 vi操作マスター（10問）— EC2実機で操作し結果を貼り付け
 * - 4-2 シェルスクリプト演習（10問）— EC2実機で作成・実行し結果を貼り付け
 */

const INFRA_BASIC_4_STORAGE_PREFIX = 'kira-infra-basic-4'

export const INFRA_BASIC_4_CLEARED_KEY = `${INFRA_BASIC_4_STORAGE_PREFIX}-all-cleared`
export const INFRA_BASIC_4_VI_ALL_CLEARED_KEY = `${INFRA_BASIC_4_STORAGE_PREFIX}-vi-all-cleared`
export const INFRA_BASIC_4_SHELL_ALL_CLEARED_KEY = `${INFRA_BASIC_4_STORAGE_PREFIX}-shell-all-cleared`

export function getViStepKey(step: number): string {
  return `${INFRA_BASIC_4_STORAGE_PREFIX}-vi-step-${step}`
}

export function getShellQuestionKey(q: number): string {
  return `${INFRA_BASIC_4_STORAGE_PREFIX}-shell-q-${q}`
}

export type InfraBasic4Rag = 'green' | 'yellow' | 'red'

export type ViStepDef = {
  step: number
  label: string
  task: string
  verify: string
  expected: string
}

export type ShellQuestionDef = {
  q: number
  title: string
  task: string
  verify: string
  expected: string
}

export const VI_STEPS: ViStepDef[] = [
  {
    step: 1,
    label: 'viNeOS を新規作成して開く',
    task: 'vi viNeOS と入力してファイルを新規作成・開いてください。開いたら :q で閉じ、ls -la viNeOS の結果を貼り付けてください。',
    verify: 'ls -la viNeOS の出力を貼り付けてください。',
    expected: 'viNeOS というファイルが存在し、ls -la の出力にファイル名 viNeOS が含まれていること。',
  },
  {
    step: 2,
    label: '自己紹介文を書いて保存する',
    task: 'vi viNeOS でファイルを開き、i で挿入モードに入り、1行目に自己紹介文（名前と所属など）を書いてください。Esc → :wq で保存して終了し、cat viNeOS の結果を貼り付けてください。',
    verify: 'cat viNeOS の出力を貼り付けてください。',
    expected: '自己紹介文（名前や所属などの内容）が1行以上表示されていること。',
  },
  {
    step: 3,
    label: '行番号表示をONにする',
    task: 'vi viNeOS でファイルを開き、:set number と入力して行番号を表示させてください。その状態のスクリーンショット相当として、:set number? の結果、または行番号付きの表示状態を確認後、cat -n viNeOS の結果を貼り付けてください。',
    verify: 'cat -n viNeOS の出力を貼り付けてください。',
    expected: '行番号付きでファイル内容が表示されていること（1, 2, 3... のような番号が行頭にあること）。',
  },
  {
    step: 4,
    label: '検索機能を使う',
    task: 'viNeOS に3行以上の文章を追加してください（i モードで入力、Esc → :wq で保存）。次に vi viNeOS で開き、/任意の単語 で検索し n/N で移動を確認してください。完了後 :q で閉じ、cat viNeOS と wc -l viNeOS の結果を貼り付けてください。',
    verify: 'cat viNeOS と wc -l viNeOS の両方の出力を貼り付けてください。',
    expected: 'ファイルが3行以上あり、検索対象となりうる単語を含む文章が書かれていること。',
  },
  {
    step: 5,
    label: '行削除（dd / 3dd）を試す',
    task: 'viNeOS が5行以上ある状態にしてください。vi viNeOS で開き、dd で1行削除、3dd で3行削除を試してください。削除後 :wq で保存し、cat viNeOS と wc -l viNeOS の結果を貼り付けてください。',
    verify: '削除前の wc -l viNeOS と削除後の cat viNeOS / wc -l viNeOS の出力を貼り付けてください。',
    expected: '行数が減っていることが確認できること（削除操作を行った結果が反映されていること）。',
  },
  {
    step: 6,
    label: 'コピー＆貼り付け（yy / p）を試す',
    task: 'vi viNeOS で開き、任意の行で yy（1行コピー）→ p（貼り付け）を実行してください。同じ行が複製されることを確認し、:wq で保存後 cat viNeOS の結果を貼り付けてください。',
    verify: 'cat viNeOS の出力を貼り付けてください。',
    expected: '同じ内容の行が連続して存在し、yy/p によるコピー＆貼り付けが行われたことが確認できること。',
  },
  {
    step: 7,
    label: 'カーソル移動コマンドを試す',
    task: 'vi viNeOS で開き、0（行頭）、$（行末）、gg（ファイル先頭）、G（ファイル末尾）を試してください。移動を確認したら :q で閉じ、cat -n viNeOS の結果を貼り付けてください（移動先の確認用）。',
    verify: 'cat -n viNeOS の出力を貼り付けてください。',
    expected: 'ファイルが複数行あり、0/$/ gg/G の移動対象となる内容が存在すること。',
  },
  {
    step: 8,
    label: 'アンドゥ / リドゥ（u / Ctrl+r）を試す',
    task: 'vi viNeOS で開き、dd で行を削除した後 u で取り消し、Ctrl+r でやり直しを試してください。最終的に u で元に戻した状態で :wq 保存し、cat viNeOS の結果を貼り付けてください。',
    verify: 'cat viNeOS の出力を貼り付けてください。',
    expected: 'ファイル内容が表示されていること（u でアンドゥした結果、削除前の状態に戻っていること）。',
  },
  {
    step: 9,
    label: '全置換（:%s/old/new/g）を実行する',
    task: 'viNeOS 内に同じ単語が2箇所以上ある状態にしてください。vi viNeOS で開き、:%s/置換前の単語/置換後の単語/g を実行してください。:wq で保存後、cat viNeOS の結果を貼り付けてください。',
    verify: 'cat viNeOS の出力を貼り付けてください。置換前の単語と置換後の単語も記載してください。',
    expected: '置換後の単語がファイル内に存在し、置換前の単語が残っていないこと（全置換が正しく行われたこと）。',
  },
  {
    step: 10,
    label: '確認付き置換（:%s/old/new/gc）を実行する',
    task: 'viNeOS に同じ単語が3箇所以上ある状態にしてください。vi viNeOS で開き、:%s/置換前/置換後/gc を実行し、y/n で選択的に置換してください。:wq で保存後、cat viNeOS の結果を貼り付けてください。',
    verify: 'cat viNeOS の出力を貼り付けてください。どの箇所を y（置換）/ n（スキップ）したかも記載してください。',
    expected: '確認付き置換を行い、一部の箇所のみ置換された結果（y で置換した箇所と n でスキップした箇所の説明）が確認できること。',
  },
]

export const SHELL_QUESTIONS: ShellQuestionDef[] = [
  {
    q: 1,
    title: '引数チェック',
    task: '引数が無い場合に「Usage: script1.sh <name>」と表示して exit 1 で終了し、引数がある場合は「Hello, <name>!」と表示するスクリプト script1.sh を作成・実行してください。',
    verify: 'cat script1.sh の出力と、引数なし・引数ありの両方の実行結果を貼り付けてください。',
    expected: 'スクリプトが $# や $1 を使って引数チェックし、引数なしで Usage 表示＋ exit 1、引数ありで Hello メッセージを表示すること。',
  },
  {
    q: 2,
    title: '変数とダブルクォート',
    task: '変数 NAME に値を代入し、echo "$NAME" でダブルクォート付きで出力するスクリプト script2.sh を作成してください。スペースを含む値（例: "Taro Yamada"）でも正しく動くことを確認してください。',
    verify: 'cat script2.sh の出力と、実行結果を貼り付けてください。',
    expected: '変数展開が "$NAME" のようにダブルクォートで囲まれており、スペースを含む値でも1行で正しく出力されること。',
  },
  {
    q: 3,
    title: 'if と終了ステータス',
    task: '引数で指定されたコマンドを実行し、成功（exit 0）なら「OK」、失敗（exit 非0）なら「NG」と表示するスクリプト script3.sh を作成してください。例: ./script3.sh ls → OK、./script3.sh ls /nonexistent → NG',
    verify: 'cat script3.sh の出力と、成功ケース・失敗ケースの実行結果を貼り付けてください。',
    expected: 'if 文で $? または直接コマンドの終了ステータスを判定し、成功時に OK、失敗時に NG を表示すること。',
  },
  {
    q: 4,
    title: 'for ループ',
    task: 'for ループで 1 2 3 を順に表示するスクリプト script4.sh を作成してください。出力は各行に「Number: 1」「Number: 2」「Number: 3」と表示されること。',
    verify: 'cat script4.sh の出力と、実行結果を貼り付けてください。',
    expected: 'for ループ（for i in 1 2 3 など）を使い、Number: 1〜3 が各行に表示されること。',
  },
  {
    q: 5,
    title: 'while ループ',
    task: 'カウンタを 1 から始めて 5 になるまでカウントアップし、各値を表示するスクリプト script5.sh を作成してください。',
    verify: 'cat script5.sh の出力と、実行結果を貼り付けてください。',
    expected: 'while ループで条件判定しカウントアップし、1〜5 の値が順に表示されること。',
  },
  {
    q: 6,
    title: '関数化',
    task: 'メッセージを出力する関数 say_hello を定義し、引数を受け取って「Hello from function: <引数>」と表示するスクリプト script6.sh を作成してください。',
    verify: 'cat script6.sh の出力と、実行結果を貼り付けてください。',
    expected: 'シェル関数（say_hello() { ... }）が定義され、関数呼び出しで引数付きメッセージが表示されること。',
  },
  {
    q: 7,
    title: 'ファイル存在チェック',
    task: '引数で指定されたファイルが存在しなければ「Error: <ファイル名> not found」と表示して exit 1、存在すれば「Found: <ファイル名>」と表示するスクリプト script7.sh を作成してください。',
    verify: 'cat script7.sh の出力と、存在するファイル・存在しないファイルの両方の実行結果を貼り付けてください。',
    expected: '-f でファイル存在チェックし、存在しない場合にエラー＋ exit 1、存在する場合に Found メッセージを表示すること。',
  },
  {
    q: 8,
    title: 'ログ出力',
    task: '日時付き（date コマンド使用）でログメッセージを app.log に追記するスクリプト script8.sh を作成してください。実行するたびに1行追記されることを確認してください。',
    verify: 'cat script8.sh の出力と、2回実行した後の cat app.log の結果を貼り付けてください。',
    expected: 'date コマンドで日時を取得し、>> でログファイルに追記しており、2回分のログが時刻付きで記録されていること。',
  },
  {
    q: 9,
    title: '標準出力/標準エラー',
    task: '正常メッセージを標準出力（stdout）、エラーメッセージを標準エラー（stderr）に出力するスクリプト script9.sh を作成してください。./script9.sh 1>/dev/null でエラーのみ、./script9.sh 2>/dev/null で正常のみ表示されることを確認してください。',
    verify: 'cat script9.sh の出力と、通常実行・1>/dev/null・2>/dev/null の3パターンの結果を貼り付けてください。',
    expected: 'echo でstdout、echo >&2 でstderrに出力しており、リダイレクトで出力を分離できること。',
  },
  {
    q: 10,
    title: '堅牢化（set -euo pipefail）',
    task: '#!/bin/bash の直後に set -euo pipefail を記述し、未定義変数アクセスや失敗コマンドで即座に停止するスクリプト script10.sh を作成してください。意図的にエラーを発生させて停止することを確認してください。',
    verify: 'cat script10.sh の出力と、実行結果（エラーで停止する様子）を貼り付けてください。',
    expected: 'set -euo pipefail が記述され、未定義変数やコマンド失敗時にスクリプトが即座に停止すること。',
  },
]
