import { INFRA_BASIC_1_CLEARED_KEY, INFRA_BASIC_1_STORAGE_KEY } from './infraBasic1Data'
import { L1_CLEARED_KEY, L1_PROGRESS_KEY } from './linuxLevel1Data'
import { L2_CLEARED_KEY } from './linuxLevel2Data'
import { INFRA_BASIC_3_1_DONE_KEY, INFRA_BASIC_3_2_CLEARED_KEY } from './infraBasic3Data'
import { INFRA_BASIC_21_STORAGE_KEY } from './infraBasic21Data'

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

export type TrainingTaskId = 'infra-basic-1' | 'infra-basic-2' | 'infra-basic-3'

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
