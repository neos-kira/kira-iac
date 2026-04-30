import { getCurrentUsername } from '../auth'
import { isJTerada } from '../specialUsers'
import { INFRA_BASIC_1_CLEARED_KEY, INFRA_BASIC_1_STORAGE_KEY } from './infraBasic1Data'
import { L1_CLEARED_KEY, L1_PROGRESS_KEY } from './linuxLevel1Data'
import { L2_CLEARED_KEY, L2_PROGRESS_KEY } from './linuxLevel2Data'
import { INFRA_BASIC_3_1_DONE_KEY, INFRA_BASIC_3_2_CLEARED_KEY, INFRA_BASIC_3_2_STATE_KEY } from './infraBasic3Data'
import { INFRA_BASIC_21_STORAGE_KEY } from './infraBasic21Data'
import {
  INFRA_BASIC_4_CLEARED_KEY,
  INFRA_BASIC_4_VI_ALL_CLEARED_KEY,
  INFRA_BASIC_4_SHELL_ALL_CLEARED_KEY,
  getViStepKey,
  getShellQuestionKey,
  VI_STEPS,
  SHELL_QUESTIONS,
} from './InfraBasic4Data'
import {
  INFRA5_CLEARED_KEY,
  INFRA5_PHASE1_CLEARED_KEY,
  INFRA5_PHASE2_CLEARED_KEY,
  INFRA5_PHASE3_CLEARED_KEY,
  INFRA5_PHASE4_CLEARED_KEY,
  INFRA5_PHASE5_CLEARED_KEY,
} from './InfraBasic5Data'
import type { TraineeProgressSnapshot } from '../traineeProgressStorage'

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
export function addBusinessDays(startDateStr: string, businessDays: number): string {
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

export type TrainingTaskId = 'infra-basic-1' | 'infra-basic-2' | 'infra-basic-3' | 'infra-basic-4' | 'infra-basic-5'

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
    label: 'Linux基本操作・コマンド',
    labelShort: '課題1',
    path: '/training/infra-basic-top',
    estimatedDays: 1,
    clearedKey: INFRA_BASIC_1_CLEARED_KEY,
    clearedKeys: [INFRA_BASIC_1_CLEARED_KEY, L1_CLEARED_KEY],
    subTasks: [
      { label: '1-1 SSHターミナル接続', clearedKey: INFRA_BASIC_1_CLEARED_KEY },
      { label: '1-2 Linuxコマンド30問', clearedKey: L1_CLEARED_KEY },
    ],
  },
  {
    id: 'infra-basic-2',
    label: 'ネットワーク基礎',
    labelShort: '課題2',
    path: '/training/infra-basic-2-top',
    estimatedDays: 3,
    clearedKey: L2_CLEARED_KEY,
    subTasks: [
      { label: '2-1 ネットワーク実践編（調査・記述）', clearedKey: null, storageKeyForProgress: INFRA_BASIC_21_STORAGE_KEY },
      { label: '2-2 TCP/IP理解度確認10問', clearedKey: L2_CLEARED_KEY },
    ],
  },
  {
    id: 'infra-basic-3',
    label: 'ファイル操作・viエディタ',
    labelShort: '課題3',
    path: '/training/infra-basic-3-top',
    estimatedDays: 5,
    clearedKey: INFRA_BASIC_3_2_CLEARED_KEY,
    subTasks: [
      { label: '3-1 OS・仮想化・クラウドの解説', clearedKey: INFRA_BASIC_3_1_DONE_KEY },
      { label: '3-2 理解度確認（記述式）', clearedKey: INFRA_BASIC_3_2_CLEARED_KEY },
    ],
  },
  {
    id: 'infra-basic-4',
    label: 'シェルスクリプト',
    labelShort: '課題4',
    path: '/training/infra-basic-4',
    estimatedDays: 10,
    clearedKey: INFRA_BASIC_4_CLEARED_KEY,
    clearedKeys: [INFRA_BASIC_4_VI_ALL_CLEARED_KEY, INFRA_BASIC_4_SHELL_ALL_CLEARED_KEY],
    subTasks: [
      { label: '4-1 vi操作演習', clearedKey: INFRA_BASIC_4_VI_ALL_CLEARED_KEY },
      { label: '4-2 シェルスクリプト演習', clearedKey: INFRA_BASIC_4_SHELL_ALL_CLEARED_KEY },
    ],
  },
  {
    id: 'infra-basic-5',
    label: 'サーバー構築（Ubuntu）',
    labelShort: '課題5',
    path: '/training/infra-basic-5',
    estimatedDays: 15,
    clearedKey: INFRA5_CLEARED_KEY,
    clearedKeys: [INFRA5_PHASE1_CLEARED_KEY, INFRA5_PHASE2_CLEARED_KEY, INFRA5_PHASE3_CLEARED_KEY, INFRA5_PHASE4_CLEARED_KEY, INFRA5_PHASE5_CLEARED_KEY],
    subTasks: [
      { label: '5-1 パラメーターシート作成', clearedKey: INFRA5_PHASE1_CLEARED_KEY },
      { label: '5-2 手順書作成', clearedKey: INFRA5_PHASE2_CLEARED_KEY },
      { label: '5-3 サーバー構築実践', clearedKey: INFRA5_PHASE3_CLEARED_KEY },
      { label: '5-4 トラブルシューティング', clearedKey: INFRA5_PHASE4_CLEARED_KEY },
      { label: '5-5 セキュリティチェック', clearedKey: INFRA5_PHASE5_CLEARED_KEY },
    ],
  },
]

/** j-terada はインフラ基礎課題1のみ。以降は別カリキュラムのため WBS/進捗は課題1のみ対象。 */
function getTrainingTasksForUser(username?: string): TrainingTaskDef[] {
  const user = username !== undefined ? username : getCurrentUsername()
  if (user && isJTerada(user)) return [TRAINING_TASKS[0]]
  return TRAINING_TASKS
}

/**
 * 進捗用 localStorage キーをユーザー別に解決する。
 * username を渡した場合はそのユーザー用キー、省略時は現在ログイン中ユーザー。
 * 大文字小文字は小文字に統一（kira-test）し、admin と受講生で同じキーを参照する。
 */
export function getProgressKey(baseKey: string, username?: string): string {
  if (typeof window === 'undefined') return baseKey
  const raw = username !== undefined ? username : getCurrentUsername()
  const user = String(raw).trim().toLowerCase()
  if (!user) return baseKey
  return `${baseKey}_${user}`
}

/** 研修開始日を取得。未設定の場合は空文字。username 指定時はそのユーザー用キーを参照（管理者画面のリアルタイム表示用）。 */
export function getTrainingStartDate(username?: string): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(getProgressKey(TRAINING_START_DATE_KEY, username)) ?? ''
}

/**
 * インフラ基礎課題1を開始したタイミングで開始日を設定する。
 * 未設定の場合のみ今日の日付を保存し true を返す（開始メッセージ表示用）。
 */
export function setTrainingStartDateFromTask1Start(): boolean {
  if (typeof window === 'undefined') return false
  const key = getProgressKey(TRAINING_START_DATE_KEY)
  const stored = window.localStorage.getItem(key)
  if (stored) return false
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  window.localStorage.setItem(key, `${y}-${m}-${d}`)
  return true
}

/** 開始日を削除する（テスト用・確認ダイアログを再表示したいとき） */
export function clearTrainingStartDate(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(getProgressKey(TRAINING_START_DATE_KEY))
}

/** 課題1関連のキャッシュをすべて削除（開始日・1-1演習・1-2 Linux30問の進捗） */
export function clearTask1Cache(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(getProgressKey(TRAINING_START_DATE_KEY))
  window.localStorage.removeItem(getProgressKey(INFRA_BASIC_1_STORAGE_KEY))
  window.localStorage.removeItem(getProgressKey(INFRA_BASIC_1_CLEARED_KEY))
  window.localStorage.removeItem(getProgressKey(L1_PROGRESS_KEY))
  window.localStorage.removeItem(getProgressKey(L1_CLEARED_KEY))
}

/** 全研修進捗をクリア（開始日・課題1〜5・L1/L2等）。進捗リセット用。 */
export function clearAllTrainingProgress(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(getProgressKey(TRAINING_START_DATE_KEY))
  window.localStorage.removeItem(getProgressKey(INFRA_BASIC_1_STORAGE_KEY))
  window.localStorage.removeItem(getProgressKey(INFRA_BASIC_1_CLEARED_KEY))
  window.localStorage.removeItem(getProgressKey(L1_PROGRESS_KEY))
  window.localStorage.removeItem(getProgressKey(L1_CLEARED_KEY))
  window.localStorage.removeItem(getProgressKey(L2_CLEARED_KEY))
  window.localStorage.removeItem(getProgressKey(L2_PROGRESS_KEY))
  window.localStorage.removeItem(getProgressKey(INFRA_BASIC_21_STORAGE_KEY))
  window.localStorage.removeItem(getProgressKey(INFRA_BASIC_3_1_DONE_KEY))
  window.localStorage.removeItem(getProgressKey(INFRA_BASIC_3_2_STATE_KEY))
  window.localStorage.removeItem(getProgressKey(INFRA_BASIC_3_2_CLEARED_KEY))
  window.localStorage.removeItem(getProgressKey(INFRA_BASIC_4_CLEARED_KEY))
  window.localStorage.removeItem(getProgressKey(INFRA_BASIC_4_VI_ALL_CLEARED_KEY))
  window.localStorage.removeItem(getProgressKey(INFRA_BASIC_4_SHELL_ALL_CLEARED_KEY))
  for (let step = 1; step <= 20; step++) {
    window.localStorage.removeItem(getProgressKey(getViStepKey(step)))
  }
  for (let q = 1; q <= 11; q++) {
    window.localStorage.removeItem(getProgressKey(getShellQuestionKey(q)))
  }
  // 課題5
  window.localStorage.removeItem(getProgressKey(INFRA5_CLEARED_KEY))
  window.localStorage.removeItem(getProgressKey(INFRA5_PHASE1_CLEARED_KEY))
  window.localStorage.removeItem(getProgressKey(INFRA5_PHASE2_CLEARED_KEY))
  window.localStorage.removeItem(getProgressKey(INFRA5_PHASE3_CLEARED_KEY))
  window.localStorage.removeItem(getProgressKey(INFRA5_PHASE4_CLEARED_KEY))
  window.localStorage.removeItem(getProgressKey(INFRA5_PHASE5_CLEARED_KEY))
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

/**
 * DynamoDBスナップショットから clearedKey のクリア状態を解決する。
 * localStorage を参照せずサーバー側データだけで判定できるキーのみ対応。
 */
function resolveKeyFromSnap(clearedKey: string, snap: TraineeProgressSnapshot): boolean {
  if (clearedKey === INFRA_BASIC_1_CLEARED_KEY) return snap.infra1Cleared === true
  if (clearedKey === L1_CLEARED_KEY) return snap.l1Cleared === true
  if (clearedKey === L2_CLEARED_KEY) return (snap.l2CurrentQuestion ?? 0) >= 10
  if (clearedKey === INFRA_BASIC_3_1_DONE_KEY) return snap.infra31Ack === true
  if (clearedKey === INFRA_BASIC_3_2_CLEARED_KEY) {
    return Object.values(snap.infra32Answers ?? {}).some((v) => v && String(v).trim() !== '')
  }
  if (clearedKey === INFRA_BASIC_4_VI_ALL_CLEARED_KEY) {
    return (snap.infra4ViDoneSteps ?? []).length >= VI_STEPS.length
  }
  if (clearedKey === INFRA_BASIC_4_SHELL_ALL_CLEARED_KEY) {
    return (snap.infra4ShellDoneQuestions ?? []).length >= SHELL_QUESTIONS.length
  }
  if (clearedKey === INFRA_BASIC_4_CLEARED_KEY) {
    return (snap.infra4ViDoneSteps ?? []).length >= VI_STEPS.length &&
      (snap.infra4ShellDoneQuestions ?? []).length >= SHELL_QUESTIONS.length
  }
  if (clearedKey === INFRA5_PHASE1_CLEARED_KEY) {
    return snap.infra5SectionDone?.['s1'] === true || (snap.infra5PhaseDone ?? []).includes(1)
  }
  if (clearedKey === INFRA5_PHASE2_CLEARED_KEY) {
    return snap.infra5SectionDone?.['s2'] === true || (snap.infra5PhaseDone ?? []).includes(2)
  }
  if (clearedKey === INFRA5_PHASE3_CLEARED_KEY) {
    return snap.infra5SectionDone?.['s3'] === true || (snap.infra5PhaseDone ?? []).includes(3)
  }
  if (clearedKey === INFRA5_PHASE4_CLEARED_KEY) {
    return snap.infra5SectionDone?.['s4'] === true || (snap.infra5PhaseDone ?? []).includes(4)
  }
  if (clearedKey === INFRA5_PHASE5_CLEARED_KEY) {
    return snap.infra5SectionDone?.['s5'] === true || (snap.infra5PhaseDone ?? []).includes(5)
  }
  if (clearedKey === INFRA5_CLEARED_KEY) {
    const phaseDone = snap.infra5PhaseDone ?? []
    const sectionDone = snap.infra5SectionDone ?? {}
    return phaseDone.length >= 5 || ['s1', 's2', 's3', 's4', 's5'].every((k) => sectionDone[k] === true)
  }
  return false
}

function getSubTaskStatus(sub: SubTaskDef, username?: string, snap?: TraineeProgressSnapshot): SubTaskStatus {
  if (typeof window === 'undefined') return 'not_started'
  if (sub.clearedKey) {
    if (snap) return resolveKeyFromSnap(sub.clearedKey, snap) ? 'cleared' : 'not_started'
    return window.localStorage.getItem(getProgressKey(sub.clearedKey, username)) === 'true' ? 'cleared' : 'not_started'
  }
  if (sub.storageKeyForProgress) {
    // infra21: DynamoDB フィールドで判定
    if (snap && sub.storageKeyForProgress === INFRA_BASIC_21_STORAGE_KEY) {
      const hasInfra21Data = !!(
        snap.infra21Q1Ip || snap.infra21Q2PingLog || snap.infra21PingOk || snap.infra21SshOk
      )
      return hasInfra21Data ? 'in_progress' : 'not_started'
    }
    // localStorage フォールバック
    try {
      const raw = window.localStorage.getItem(getProgressKey(sub.storageKeyForProgress, username))
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

/**
 * username 指定時はそのユーザーの進捗を参照（管理者画面のリアルタイム表示用）。
 * snap 指定時は DynamoDB スナップショットを優先して読み取り、localStorage を参照しない。
 */
export function getTaskProgressList(username?: string, snap?: TraineeProgressSnapshot): TaskProgress[] {
  const start = getTrainingStartDate(username)
  const today = new Date()
  const todayStr =
    today.getFullYear() +
    '-' +
    String(today.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(today.getDate()).padStart(2, '0')
  const tasks = getTrainingTasksForUser(username)
  return tasks.map((task) => {
    const deadline = start ? getDeadlineForTask(start, task.estimatedDays) : '—'
    let cleared = false
    if (snap) {
      if (task.clearedKeys && task.clearedKeys.length > 0) {
        cleared = task.clearedKeys.every((k) => resolveKeyFromSnap(k, snap))
      } else {
        cleared = resolveKeyFromSnap(task.clearedKey, snap)
      }
    } else if (typeof window !== 'undefined') {
      if (task.clearedKeys && task.clearedKeys.length > 0) {
        cleared = task.clearedKeys.every((k) => window.localStorage.getItem(getProgressKey(k, username)) === 'true')
      } else {
        cleared = window.localStorage.getItem(getProgressKey(task.clearedKey, username)) === 'true'
      }
    }
    const isDelayed = !!start && !cleared && todayStr > deadline
    const subTasks: SubTaskProgress[] = task.subTasks.map((sub) => ({
      label: sub.label,
      status: getSubTaskStatus(sub, username, snap),
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

/** username 指定時はそのユーザーの完了数を参照。 */
export function getTotalCleared(username?: string): number {
  if (typeof window === 'undefined') return 0
  const tasks = getTrainingTasksForUser(username)
  return tasks.filter((t) => {
    if (t.clearedKeys && t.clearedKeys.length > 0) {
      return t.clearedKeys.every((k) => window.localStorage.getItem(getProgressKey(k, username)) === 'true')
    }
    return window.localStorage.getItem(getProgressKey(t.clearedKey, username)) === 'true'
  }).length
}

export const TOTAL_TASKS = TRAINING_TASKS.length

/** 指定ユーザーが対象とする課題数（j-terada は 1、それ以外は 4）。 */
export function getTotalTaskCountForUser(username?: string): number {
  return getTrainingTasksForUser(username).length
}

/** インフラ基礎課題1が完了しているか（1-1 と 1-2 両方クリア） */
export function isTask1Cleared(): boolean {
  if (typeof window === 'undefined') return false
  const task = TRAINING_TASKS[0]
  if (!task.clearedKeys || task.clearedKeys.length === 0) return false
  return task.clearedKeys.every((k) => window.localStorage.getItem(getProgressKey(k)) === 'true')
}

/** インフラ基礎課題2が完了しているか */
export function isTask2Cleared(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(getProgressKey(L2_CLEARED_KEY)) === 'true'
}

/** 次の未完了課題のラベル。全てクリアなら null */
export function getNextTaskLabel(): string | null {
  const list = getTaskProgressList()
  const next = list.find((t) => !t.cleared)
  return next ? next.labelShort : null
}

/** 遅延している課題の id 一覧。username 指定時はそのユーザーを参照。 */
export function getDelayedTaskIds(username?: string): TrainingTaskId[] {
  return getTaskProgressList(username)
    .filter((t) => t.isDelayed)
    .map((t) => t.id)
}

/** WBS進捗率（0〜100）。username 指定時はそのユーザーを参照。リアルタイムに「どこまで進んでいるか」を反映するため、各課題の進捗率の平均を取る。 */
export function getWbsProgressPercent(username?: string): number {
  if (typeof window === 'undefined') return 0
  const tasks = getTaskProgressList(username)
  if (!tasks.length) return 0

  const sum = tasks.reduce((acc, task) => {
    if (task.cleared) return acc + 100
    const done = task.subTasks.filter((s) => s.status !== 'not_started').length
    const pct = (done / Math.max(1, task.subTasks.length)) * 100
    return acc + pct
  }, 0)

  return Math.round(sum / tasks.length)
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

const CHAPTER_LABELS: Record<number, string> = {
  1: 'Chapter 1 インフラ基礎課題1',
  2: 'Chapter 2 インフラ基礎課題2',
  3: 'Chapter 3 インフラ基礎課題3',
  4: 'Chapter 4 10日間プロジェクト（Ubuntu 24.04 LTS 構築）',
  5: 'Chapter 5 サーバー構築',
}

/** 対象外プレースホルダー（j-terada は課題2〜4 が別カリキュラムのため） */
function placeholderChapter(chapter: number): ChapterProgress {
  return {
    chapter,
    label: `課題${chapter} 対象外`,
    percent: 0,
    cleared: false,
    isDelayed: false,
    deadline: '—',
  }
}

/** username 指定時はそのユーザーの進捗を参照（管理者画面のリアルタイム表示用）。j-terada は課題1のみ実データ、課題2〜4 は対象外。 */
export function getChapterProgressList(username?: string): ChapterProgress[] {
  const list = getTaskProgressList(username)

  const result: ChapterProgress[] = list.map((task, i) => {
    const chNum = i + 1
    const percent =
      task.cleared ? 100 : (task.subTasks.filter((s) => s.status !== 'not_started').length / Math.max(1, task.subTasks.length)) * 100
    return {
      chapter: chNum,
      label: CHAPTER_LABELS[chNum] ?? task.label,
      percent: Math.round(percent),
      cleared: task.cleared,
      isDelayed: task.isDelayed,
      deadline: task.deadline,
    }
  })

  while (result.length < 5) {
    result.push(placeholderChapter(result.length + 1))
  }

  return result
}

/** 10日間プロジェクトの現在の Day X（1〜10）。未開始は 0。username 指定時はそのユーザーの開始日を参照。 */
export function getCurrentProjectDay(username?: string): number {
  if (typeof window === 'undefined') return 0
  const start = getTrainingStartDate(username)
  if (!start) return 0
  const today = new Date()
  const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')
  return getBusinessDaysFromStart(start, todayStr)
}

/**
 * 講師用リファレンス（設計書サンプル・Ubuntu構築スクリプト等）
 * サイドパネルで即座に正解を確認できるよう格納
 */
export const INSTRUCTOR_REFERENCE = {
  chapter1: {
    title: 'Chapter 1 設計書サンプル',
    content: `# ツール演習チェックリスト
- ターミナル(macOS/Windows): SSH接続・ログ取得
- SCP/SFTP: ファイル転送
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
  ubuntuScript: {
    title: 'Ubuntu 24.04 LTS 用構築スクリプト（.org バックアップ付き）',
    content: `#!/bin/bash
# 設定変更前は必ず cp -p でバックアップ
cp -p /etc/nginx/nginx.conf /etc/nginx/nginx.conf.org
cp -p /etc/ssh/sshd_config /etc/ssh/sshd_config.org

# 変更後は diff で確認
# diff /etc/nginx/nginx.conf.org /etc/nginx/nginx.conf

# Ubuntu 24.04 LTS でのパッケージ例
# apt install -y nginx
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
