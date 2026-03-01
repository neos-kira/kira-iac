/**
 * インフラ基礎課題4: Amazon Linux 2023 構築プロジェクト（10日間）
 * AL2 → AL2023 移行・新規構築の実務ワークフロー
 */

export const INFRA_BASIC_4_STORAGE_PREFIX = 'kira-al2023'
export const INFRA_BASIC_4_CLEARED_KEY = 'kira-infra-basic-4-all-cleared'

/** Day N の完了フラグ用 localStorage キー */
export function getDayClearedKey(day: number): string {
  return `${INFRA_BASIC_4_STORAGE_PREFIX}-day-${day}-cleared`
}

/** Day N の作業ログ（DevLog）用 localStorage キー */
export function getDayDevLogKey(day: number): string {
  return `${INFRA_BASIC_4_STORAGE_PREFIX}-day-${day}-devlog`
}

/** 全10日分の完了キー（trainingWbsData の subTasks 用） */
export const AL2023_DAY_CLEARED_KEYS: string[] = Array.from({ length: 10 }, (_, i) => getDayClearedKey(i + 1))

export type DayQAItem = {
  icon: string
  label: string
  description: string
}

export type DayDef = {
  day: number
  title: string
  description: string
  objectives: string[]
  qaChecklist: DayQAItem[]
}

/** 品質チェックの共通項目（cp -p, diff 等） */
const COMMON_QA: DayQAItem[] = [
  { icon: '💾', label: 'cp -p による属性保持バックアップ（.org）', description: '設定変更前に cp -p でタイムスタンプを維持したバックアップ（例: config.conf.org）を作成しているか' },
  { icon: '⚙️', label: 'diff による設定変更の妥当性確認', description: '変更後に diff コマンドで差分を確認し、意図した変更のみが入っているか検証しているか' },
]

export const AL2023_DAYS: DayDef[] = [
  {
    day: 1,
    title: '環境調査・要件整理',
    description: '既存 AL2 環境の調査と AL2023 移行要件の整理。ネットワーク情報（例: 192.168.X.X の範囲）は特定を避け抽象化して記録する。',
    objectives: ['AL2 のパッケージ・設定一覧の取得', '移行対象サービスの洗い出し', '作業ログの記録開始'],
    qaChecklist: [
      ...COMMON_QA,
      { icon: '🖥️', label: 'サーバ情報の抽象化', description: 'IPアドレス等は 192.168.X.X のように特定できない形式で記録しているか' },
    ],
  },
  {
    day: 2,
    title: 'AL2023 インスタンス準備',
    description: 'Amazon Linux 2023 の EC2 インスタンス起動と初期接続。セキュリティグループ・キーペアの設定を記録する。',
    objectives: ['AL2023 AMI の選択と起動', 'SSH 接続確認', 'ホスト名・タイムゾーン設定'],
    qaChecklist: [
      ...COMMON_QA,
      { icon: '🛡️', label: 'Security 設定の記録', description: 'セキュリティグループ・ファイアウォール方針をドキュメントに残しているか' },
    ],
  },
  {
    day: 3,
    title: 'パッケージ管理（dnf）と基本構築',
    description: 'dnf によるパッケージ導入。変更前には必ず cp -p で設定のバックアップを取得する。',
    objectives: ['dnf update と必須パッケージのインストール', '/etc 配下の設定バックアップ（.org）', 'diff による変更確認の習慣化'],
    qaChecklist: COMMON_QA,
  },
  {
    day: 4,
    title: 'Web サーバ（Nginx）の導入',
    description: 'Nginx のインストールと基本設定。nginx.conf を編集する前に cp -p で nginx.conf.org を作成する。',
    objectives: ['Nginx のインストールと有効化', 'nginx.conf のバックアップと編集', 'diff nginx.conf.org nginx.conf で確認'],
    qaChecklist: COMMON_QA,
  },
  {
    day: 5,
    title: 'SSH 設定の hardening',
    description: 'sshd_config のバックアップ（cp -p）のうえで、PermitRootLogin 等の設定を変更し、diff で確認する。',
    objectives: ['sshd_config の .org バックアップ', '必要に応じた設定変更', '変更後の diff 確認と再起動'],
    qaChecklist: COMMON_QA,
  },
  {
    day: 6,
    title: 'ログ・監視の整備',
    description: 'ログローテーションや監視のための設定。設定ファイルはすべて .org を取ってから編集する。',
    objectives: ['logrotate 等の設定', 'ログ出力先の統一', 'バックアップと diff の実施'],
    qaChecklist: COMMON_QA,
  },
  {
    day: 7,
    title: 'アプリケーション層の移行準備',
    description: 'AL2 で動作していたアプリの依存関係を AL2023 用に整理。機密情報は 192.168.X.X やクライアントX に置換して記録する。',
    objectives: ['依存パッケージのリスト化', '環境変数・設定の抽象化', '移行手順書のドラフト'],
    qaChecklist: [
      ...COMMON_QA,
      { icon: '🤖', label: '機密情報の抽象化', description: 'IP・顧客名等を特定できない形式（192.168.X.X、クライアントX）に置換しているか' },
    ],
  },
  {
    day: 8,
    title: '結合テスト・ロールバック手順の確認',
    description: '.org から復元する手順を実践し、ロールバックが可能なことを確認する。',
    objectives: ['主要設定の .org からの復元テスト', 'ロールバック手順の文書化', 'diff による復元確認'],
    qaChecklist: COMMON_QA,
  },
  {
    day: 9,
    title: '本番切り替えリハーサル',
    description: '切り替え手順の最終確認。バックアップ一覧と diff 確認チェックリストを揃える。',
    objectives: ['切り替え手順の実行練習', 'バックアップ一覧の最終確認', '品質チェック項目の実施'],
    qaChecklist: COMMON_QA,
  },
  {
    day: 10,
    title: '完了報告・振り返り',
    description: '10日間の作業ログと品質チェック結果をまとめ、振り返りを記録する。',
    objectives: ['全工程の DevLog と QA の整理', '所感・改善点の記録', 'プロジェクト完了のマーク'],
    qaChecklist: [
      ...COMMON_QA,
      { icon: '✅', label: '全工程の品質チェック完了', description: 'Day 1〜9 の cp -p / diff 等の監査項目が実施済みか' },
    ],
  },
]

export function loadDayDevLog(day: number): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(getDayDevLogKey(day)) ?? ''
}

export function saveDayDevLog(day: number, content: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(getDayDevLogKey(day), content)
}

export function isDayCleared(day: number): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(getDayClearedKey(day)) === 'true'
}

export function setDayCleared(day: number, cleared: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(getDayClearedKey(day), cleared ? 'true' : 'false')
}

export function getAl2023ClearedCount(): number {
  if (typeof window === 'undefined') return 0
  return AL2023_DAYS.filter((d) => isDayCleared(d.day)).length
}

export function isAl2023AllCleared(): boolean {
  return getAl2023ClearedCount() === 10
}

export function setAl2023AllClearedIfDone(): void {
  if (typeof window === 'undefined') return
  if (isAl2023AllCleared()) {
    window.localStorage.setItem(INFRA_BASIC_4_CLEARED_KEY, 'true')
  }
}
