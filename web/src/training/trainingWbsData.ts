import { INFRA_BASIC_1_CLEARED_KEY, INFRA_BASIC_1_STORAGE_KEY } from './infraBasic1Data'
import { L1_CLEARED_KEY, L1_PROGRESS_KEY } from './linuxLevel1Data'
import { L2_CLEARED_KEY } from './linuxLevel2Data'
import { INFRA_BASIC_3_1_DONE_KEY, INFRA_BASIC_3_2_CLEARED_KEY } from './infraBasic3Data'
import { INFRA_BASIC_21_STORAGE_KEY } from './infraBasic21Data'
import {
  INFRA_BASIC_4_CLEARED_KEY,
  AL2023_DAYS,
  getDayClearedKey,
} from './InfraBasic4Data'

export const TRAINING_START_DATE_KEY = 'kira-training-start-date'

/** 土日祝日を除く営業日か */
function isBusinessDay(date: Date): boolean {
  const day = date.getDay()
  if (day === 0 || day === 6) return false
  const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
  return !JAPANESE_HOLIDAYS.has(key)
}

/** 日本の祝日（2025〜2027 主要日。YYYY-MM-DD） */
const JAPANESE_HOLIDAYS = new Set([
  '2025-01-01', '2025-01-13', '2025-02-11', '2025-02-24', '2025-03-20', '2025-04-29', '2025-05-03', '2025-05-04', '2025-05-05', '2025-05-06',
  '2025-07-21', '2025-08-11', '2025-09-15', '2025-09-23', '2025-10-13', '2025-11-03', '2025-11-23', '2025-11-24',
  '2026-01-01', '2026-01-12', '2026-02-11', '2026-02-23', '2026-03-20', '2026-04-29', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06',
  '2026-07-20', '2026-08-11', '2026-09-21', '2026-09-22', '2026-09-23', '2026-10-12', '2026-11-03', '2026-11-23',
  '2027-01-01', '2027-01-11', '2027-02-11', '2027-02-23', '2027-03-21', '2027-03-22', '2027-04-29', '2027-05-03', '2027-05-04', '2027-05-05',
  '2027-07-19', '2027-08-11', '2027-09-20', '2027-09-23', '2027-10-11', '2027-11-03', '2027-11-23',
])

/** 開始日から N 営業日後の日付（YYYY-MM-DD） */
function addBusinessDays(startDateStr: string, businessDays: number): string {
  const d = new Date(startDateStr + 'T12:00:00')
  let count = 0
  while (count < businessDays) {
    if (isBusinessDay(d)) count++
    if (count < businessDays) d.setDate(d.getDate() + 1)
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export type TrainingTaskId = 'infra-basic-1' | 'infra-basic-2' | 'infra-basic-3' | 'infra-basic-4'

export type SubTaskDef = {
  label: string
  /** クリア判定用 localStorage キー。null の場合はストレージの有無で実施中判定 */
  clearedKey: string | null
  /** clearedKey が null のとき、実施中かどうかはこのキーのデータ有無で判定 */
  storageKeyForProgress?: string
}

export type TrainingTaskDef = {
  id: TrainingTaskId
  label: string
  labelShort: string
  path: string
  estimatedDays: number
  /** 課題全体のクリア判定。複数指定時はすべて 'true' でクリア */
  clearedKey: string
  clearedKeys?: string[]
  subTasks: SubTaskDef[]
}

/** 課題一覧（サブ項目付き） */
export const TRAINING_TASKS: TrainingTaskDef[] = [
  {
    id: 'infra-basic-1',
    label: 'インフラ基礎課題1',
    labelShort: '課題1',
    path: '/training/infra-basic-top',
    estimatedDays: 1,
    clearedKey: INFRA_BASIC_1_CLEARED_KEY,
    clearedKeys: [INFRA_BASIC_1_CLEARED_KEY, L1_CLEARED_KEY],
    subTasks: [
      { label: '1-1 使用ツール（TeraTerm / WinSCP 等）', clearedKey: INFRA_BASIC_1_CLEARED_KEY },
      { label: '1-2 Linuxコマンド30問', clearedKey: L1_CLEARED_KEY },
    ],
  },
  {
    id: 'infra-basic-2',
    label: 'インフラ基礎課題2',
    labelShort: '課題2',
    path: '/training/infra-basic-2-top',
    estimatedDays: 3,
    clearedKey: L2_CLEARED_KEY,
    subTasks: [
      { label: '2-1 ネットワーク実践編（調査・記述）', clearedKey: null, storageKeyForProgress: INFRA_BASIC_21_STORAGE_KEY },
      { label: '2-2 TCP/IP理解度チェック10問', clearedKey: L2_CLEARED_KEY },
    ],
  },
  {
    id: 'infra-basic-3',
    label: 'インフラ基礎課題3',
    labelShort: '課題3',
    path: '/training/infra-basic-3-top',
    estimatedDays: 5,
    clearedKey: INFRA_BASIC_3_2_CLEARED_KEY,
    subTasks: [
      { label: '3-1 OS・仮想化・クラウドの解説', clearedKey: INFRA_BASIC_3_1_DONE_KEY },
      { label: '3-2 理解度チェック（記述式）', clearedKey: INFRA_BASIC_3_2_CLEARED_KEY },
    ],
  },
  {
    id: 'infra-basic-4',
    label: 'インフラ基礎課題4（Amazon Linux 2023 構築プロジェクト）',
    labelShort: '課題4',
    path: '/training/infra-basic-4',
    estimatedDays: 10,
    clearedKey: INFRA_BASIC_4_CLEARED_KEY,
    subTasks: AL2023_DAYS.map((d) => ({
      label: `Day ${d.day} ${d.title}`,
      clearedKey: getDayClearedKey(d.day),
    })),
  },
]

/** 研修開始日を取得。未設定の場合は空文字（課題1開始後に設定される） */
export function getTrainingStartDate(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(TRAINING_START_DATE_KEY) ?? ''
}

/**
 * インフラ基礎課題1を開始したタイミングで開始日を設定する。
 * 未設定の場合のみ今日の日付を保存し true を返す（開始メッセージ表示用）。
 */
export function setTrainingStartDateFromTask1Start(): boolean {
  if (typeof window === 'undefined') return false
  const stored = window.localStorage.getItem(TRAINING_START_DATE_KEY)
  if (stored) return false
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  window.localStorage.setItem(TRAINING_START_DATE_KEY, `${y}-${m}-${d}`)
  return true
}

/** 開始日を削除する（テスト用・確認ダイアログを再表示したいとき） */
export function clearTrainingStartDate(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(TRAINING_START_DATE_KEY)
}

/** 課題1関連のキャッシュをすべて削除（開始日・1-1演習・1-2 Linux30問の進捗） */
export function clearTask1Cache(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(TRAINING_START_DATE_KEY)
  window.localStorage.removeItem(INFRA_BASIC_1_STORAGE_KEY)
  window.localStorage.removeItem(INFRA_BASIC_1_CLEARED_KEY)
  window.localStorage.removeItem(L1_PROGRESS_KEY)
  window.localStorage.removeItem(L1_CLEARED_KEY)
}

/** 課題の期限日（YYYY-MM-DD）。土日祝を除く営業日で累積日数分先 */
function getDeadlineForTask(startDate: string, cumulativeBusinessDays: number): string {
  return addBusinessDays(startDate, cumulativeBusinessDays)
}

const PROJECT_DAYS_TOTAL = 10

/** 開始日から今日までの営業日数（1〜PROJECT_DAYS_TOTAL）。未開始は 0 */
function getBusinessDaysFromStart(startDate: string, todayStr: string): number {
  if (!startDate) return 0
  const start = new Date(startDate + 'T12:00:00')
  const end = new Date(todayStr + 'T12:00:00')
  if (end < start) return 0
  let count = 0
  const d = new Date(start)
  while (d <= end) {
    if (isBusinessDay(d)) count++
    d.setDate(d.getDate() + 1)
  }
  return Math.min(count, PROJECT_DAYS_TOTAL)
}

export type SubTaskStatus = 'cleared' | 'in_progress' | 'not_started'

export type SubTaskProgress = {
  label: string
  status: SubTaskStatus
}

export type TaskProgress = {
  id: TrainingTaskId
  cleared: boolean
  deadline: string
  isDelayed: boolean
  label: string
  labelShort: string
  path: string
  estimatedDays: number
  subTasks: SubTaskProgress[]
}

function getSubTaskStatus(sub: SubTaskDef): SubTaskStatus {
  if (typeof window === 'undefined') return 'not_started'
  if (sub.clearedKey) {
    return window.localStorage.getItem(sub.clearedKey) === 'true' ? 'cleared' : 'not_started'
  }
  if (sub.storageKeyForProgress) {
    try {
      const raw = window.localStorage.getItem(sub.storageKeyForProgress)
      if (!raw) return 'not_started'
      const parsed = JSON.parse(raw)
      const hasData = parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0
      return hasData ? 'in_progress' : 'not_started'
    } catch {
      return 'not_started'
    }
  }
  return 'not_started'
}

export function getTaskProgressList(): TaskProgress[] {
  const start = getTrainingStartDate()
  const today = new Date()
  const todayStr =
    today.getFullYear() +
    '-' +
    String(today.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(today.getDate()).padStart(2, '0')
  return TRAINING_TASKS.map((task) => {
    const deadline = start ? getDeadlineForTask(start, task.estimatedDays) : '—'
    let cleared = false
    if (typeof window !== 'undefined') {
      if (task.clearedKeys && task.clearedKeys.length > 0) {
        cleared = task.clearedKeys.every((k) => window.localStorage.getItem(k) === 'true')
      } else {
        cleared = window.localStorage.getItem(task.clearedKey) === 'true'
      }
    }
    const isDelayed = !!start && !cleared && todayStr > deadline
    const subTasks: SubTaskProgress[] = task.subTasks.map((sub) => ({
      label: sub.label,
      status: getSubTaskStatus(sub),
    }))
    return {
      id: task.id,
      cleared,
      deadline,
      isDelayed,
      label: task.label,
      labelShort: task.labelShort,
      path: task.path,
      estimatedDays: task.estimatedDays,
      subTasks,
    }
  })
}

export function getTotalCleared(): number {
  if (typeof window === 'undefined') return 0
  return TRAINING_TASKS.filter((t) => {
    if (t.clearedKeys && t.clearedKeys.length > 0) {
      return t.clearedKeys.every((k) => window.localStorage.getItem(k) === 'true')
    }
    return window.localStorage.getItem(t.clearedKey) === 'true'
  }).length
}

export const TOTAL_TASKS = TRAINING_TASKS.length

/** 次の未完了課題のラベル。全てクリアなら null */
export function getNextTaskLabel(): string | null {
  const list = getTaskProgressList()
  const next = list.find((t) => !t.cleared)
  return next ? next.labelShort : null
}

/** 遅延している課題の id 一覧 */
export function getDelayedTaskIds(): TrainingTaskId[] {
  return getTaskProgressList()
    .filter((t) => t.isDelayed)
    .map((t) => t.id)
}

/** WBS進捗率（0〜100）。完了課題数 / 全課題数 */
export function getWbsProgressPercent(): number {
  if (typeof window === 'undefined' || TOTAL_TASKS === 0) return 0
  const cleared = getTotalCleared()
  return Math.round((cleared / TOTAL_TASKS) * 100)
}

/**
 * 技術監査・模範解答リファレンス（Admin画面等で表示）
 * - AI利用: IPアドレス（192.168.1.1 → 192.168.X.X）の抽象化、顧客名の仮名化
 * - バックアップ: cp -p によるタイムスタンプ維持、.org での事前保存、diff による差分確認
 */
export const AUDIT_REFERENCE = {
  aiGovernance: {
    title: 'AI利用の監査点',
    points: [
      'IPアドレスは特定できない形式に置換する（例: 192.168.1.1 → 192.168.X.X）',
      '顧客名・組織名は仮名化する（例: 株式会社A → クライアントX）',
      '認証情報・本番環境の実データはAIに入力しない',
    ],
  },
  backupAndDiff: {
    title: '技術監査の必須作法',
    points: [
      '設定変更前には cp -p でタイムスタンプを維持したバックアップを作成する（例: config.conf → config.conf.org）',
      '変更後は diff コマンドで差分確認する（例: diff config.conf.org config.conf）',
      'ロールバック手順をメモし、.org から復元できる状態を維持する',
    ],
  },
} as const

/** Chapter 1〜4 の進捗（Admin用）。Chapter 4 は10日間プロジェクトの全体 */
export type ChapterProgress = {
  chapter: number
  label: string
  percent: number
  cleared: boolean
  isDelayed: boolean
  deadline: string
}

export function getChapterProgressList(): ChapterProgress[] {
  const list = getTaskProgressList()
  const todayStr =
    typeof window !== 'undefined'
      ? new Date().toISOString().slice(0, 10)
      : ''

  const ch1 = list[0]
  const ch2 = list[1]
  const ch3 = list[2]

  const result: ChapterProgress[] = [
    {
      chapter: 1,
      label: 'Chapter 1 インフラ基礎課題1',
      percent: ch1 ? (ch1.cleared ? 100 : (ch1.subTasks.filter((s) => s.status !== 'not_started').length / ch1.subTasks.length) * 100) : 0,
      cleared: ch1?.cleared ?? false,
      isDelayed: ch1?.isDelayed ?? false,
      deadline: ch1?.deadline ?? '—',
    },
    {
      chapter: 2,
      label: 'Chapter 2 インフラ基礎課題2',
      percent: ch2 ? (ch2.cleared ? 100 : (ch2.subTasks.filter((s) => s.status !== 'not_started').length / ch2.subTasks.length) * 100) : 0,
      cleared: ch2?.cleared ?? false,
      isDelayed: ch2?.isDelayed ?? false,
      deadline: ch2?.deadline ?? '—',
    },
    {
      chapter: 3,
      label: 'Chapter 3 インフラ基礎課題3',
      percent: ch3 ? (ch3.cleared ? 100 : (ch3.subTasks.filter((s) => s.status !== 'not_started').length / ch3.subTasks.length) * 100) : 0,
      cleared: ch3?.cleared ?? false,
      isDelayed: ch3?.isDelayed ?? false,
      deadline: ch3?.deadline ?? '—',
    },
  ]

  const ch4 = list[3]
  if (ch4) {
    result.push({
      chapter: 4,
      label: 'Chapter 4 10日間プロジェクト（AL2023 構築）',
      percent: ch4.cleared ? 100 : (ch4.subTasks.filter((s) => s.status !== 'not_started').length / Math.max(1, ch4.subTasks.length)) * 100,
      cleared: ch4.cleared,
      isDelayed: ch4.isDelayed,
      deadline: ch4.deadline,
    })
  } else {
    const start = getTrainingStartDate()
    const currentDay = getBusinessDaysFromStart(start, todayStr)
    const ch4Percent = start ? Math.min(100, Math.round((currentDay / PROJECT_DAYS_TOTAL) * 100)) : 0
    const allCleared = list.every((t) => t.cleared)
    result.push({
      chapter: 4,
      label: 'Chapter 4 10日間プロジェクト',
      percent: allCleared ? 100 : ch4Percent,
      cleared: allCleared,
      isDelayed: list.some((t) => t.isDelayed),
      deadline: start ? addBusinessDays(start, PROJECT_DAYS_TOTAL) : '—',
    })
  }

  return result
}

/** 10日間プロジェクトの現在の Day X（1〜10）。未開始は 0 */
export function getCurrentProjectDay(): number {
  if (typeof window === 'undefined') return 0
  const start = getTrainingStartDate()
  if (!start) return 0
  const today = new Date()
  const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')
  return getBusinessDaysFromStart(start, todayStr)
}

/**
 * 講師用リファレンス（設計書サンプル・AL2023構築スクリプト等）
 * サイドパネルで即座に正解を確認できるよう格納
 */
export const INSTRUCTOR_REFERENCE = {
  chapter1: {
    title: 'Chapter 1 設計書サンプル',
    content: `# ツール演習チェックリスト
- TeraTerm: 接続・ログ取得
- WinSCP: ファイル転送
- 設定変更前のバックアップ: cp -p で .org を作成`,
  },
  chapter2: {
    title: 'Chapter 2 ネットワーク設計の要点',
    content: `# ネットワーク実践
- サブネット設計
- 障害報告は 5W1H（いつ・どこで・誰が・何が・なぜ・どのように）`,
  },
  chapter3: {
    title: 'Chapter 3 OS・クラウド概要',
    content: `# 仮想化・クラウド
- ハイパーバイザー種別
- クラウドの責任分担モデル`,
  },
  al2023Script: {
    title: 'AL2023 用構築スクリプト（.org バックアップ付き）',
    content: `#!/bin/bash
# 設定変更前は必ず cp -p でバックアップ
cp -p /etc/nginx/nginx.conf /etc/nginx/nginx.conf.org
cp -p /etc/ssh/sshd_config /etc/ssh/sshd_config.org

# 変更後は diff で確認
# diff /etc/nginx/nginx.conf.org /etc/nginx/nginx.conf

# Amazon Linux 2023 でのパッケージ例
# dnf install -y nginx
# systemctl enable --now nginx`,
  },
  /** Chapter 4 構築品質：技術監査で必須のチェック項目 */
  chapter4Quality: {
    title: 'Chapter 4 構築品質（技術監査ポイント）',
    points: [
      'cp -p による属性保持：タイムスタンプ・パーミッションを維持したバックアップを作成する',
      '.org 形式の事前バックアップ：設定変更前に必ず config.conf → config.conf.org のように保存する',
      'diff による差分確認：変更後に diff config.conf.org config.conf で意図した変更のみであることを確認する',
    ],
  },
} as const
