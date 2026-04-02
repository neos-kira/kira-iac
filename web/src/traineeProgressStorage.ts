/**
 * 受講生リストと進捗スナップショットを localStorage に保存し、
 * 管理者画面で admin 以外の受講生（kira-test 等）の進捗を一覧表示するための仕組み。
 */
import { getIntroConfirmed, getIntroConfirmedAt, getIntroConfirmedForUser, getIntroConfirmedAtForUser, setIntroConfirmedForUserWithTimestamp } from './training/introGate'
import {
  getWbsProgressPercent,
  getChapterProgressList,
  getCurrentProjectDay,
  getDelayedTaskIds,
  getProgressKey,
  getTrainingStartDate,
  TRAINING_START_DATE_KEY,
} from './training/trainingWbsData'
import type { ChapterProgress } from './training/trainingWbsData'
import { INFRA_BASIC_1_CLEARED_KEY } from './training/infraBasic1Data'
import { L1_CLEARED_KEY } from './training/linuxLevel1Data'
import { L2_CLEARED_KEY } from './training/linuxLevel2Data'
import { INFRA_BASIC_3_2_CLEARED_KEY } from './training/infraBasic3Data'
import {
  INFRA_BASIC_4_VI_ALL_CLEARED_KEY,
  INFRA_BASIC_4_SHELL_ALL_CLEARED_KEY,
  getViStepKey,
  getShellQuestionKey,
} from './training/InfraBasic4Data'

const TRAINEE_LIST_KEY = 'kira-admin-trainee-list'
const PROGRESS_SNAPSHOT_PREFIX = 'kira-progress-snapshot-'

/** 管理者以外で最初から表示したい受講生ID（存在している受講生） */
const DEFAULT_TRAINEE_IDS = ['kira-test', 'j-terada']

export type TraineeProgressSnapshot = {
  introConfirmed: boolean
  introAt: string | null
  wbsPercent: number
  chapterProgress: ChapterProgress[]
  currentDay: number
  delayedIds: string[]
  updatedAt: string
  /** ピン留めした課題ID（サーバー同期用） */
  pins: string[]
  /** 研修開始日（YYYY-MM-DD）。別端末復元用。 */
  trainingStartDate?: string | null
  /** 課題4: vi 操作で完了済みのステップ番号一覧（サーバー同期用） */
  infra4ViDoneSteps?: number[]
  /** 課題4: シェルスクリプト演習で完了済みの問題番号一覧（サーバー同期用） */
  infra4ShellDoneQuestions?: number[]
  /** 課題4: RAG ステータス（green / yellow / red） */
  infra4Rag?: 'green' | 'yellow' | 'red' | null
}

/** 受講生IDは小文字統一（kira-test 等）。大文字小文字のずれを防ぐ。 */
function loadTraineeList(): string[] {
  if (typeof window === 'undefined') return [...DEFAULT_TRAINEE_IDS]
  try {
    const raw = window.localStorage.getItem(TRAINEE_LIST_KEY)
    if (!raw) return [...DEFAULT_TRAINEE_IDS]
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...DEFAULT_TRAINEE_IDS]
    const normalized = (parsed as string[])
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim().toLowerCase())
    const list = [...new Set([...DEFAULT_TRAINEE_IDS, ...normalized])]
    return list.filter((id) => id !== 'admin')
  } catch {
    return [...DEFAULT_TRAINEE_IDS]
  }
}

function saveTraineeList(list: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(TRAINEE_LIST_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

/** 管理者画面に表示する受講生ID一覧（admin 除く。kira-test は常に含む） */
export function getTraineeList(): string[] {
  return loadTraineeList()
}

/** ログイン時に受講生をリストに追加（admin は追加しない）。IDは小文字で統一。 */
export function addTrainee(username: string): void {
  if (typeof window === 'undefined') return
  const id = username.trim().toLowerCase()
  if (!id || id === 'admin') return
  const list = loadTraineeList()
  if (list.includes(id)) return
  saveTraineeList([...list, id])
}

/** 現在のグローバル進捗からスナップショットを生成（受講生が利用中に呼ぶ）。pins は呼び出し元でマージする。 */
export function getCurrentProgressSnapshot(pinsOverride?: string[]): TraineeProgressSnapshot {
  return {
    introConfirmed: getIntroConfirmed(),
    introAt: getIntroConfirmedAt(),
    wbsPercent: getWbsProgressPercent(),
    chapterProgress: getChapterProgressList(),
    currentDay: getCurrentProjectDay(),
    delayedIds: getDelayedTaskIds(),
    updatedAt: new Date().toISOString(),
    pins: Array.isArray(pinsOverride) ? pinsOverride : [],
    trainingStartDate: getTrainingStartDate() || null,
    infra4ViDoneSteps: [],
    infra4ShellDoneQuestions: [],
    infra4Rag: null,
  }
}

/** 指定受講生の進捗スナップショットを保存（IDは小文字統一で admin と一致） */
export function saveProgressSnapshot(username: string, data: TraineeProgressSnapshot): void {
  if (typeof window === 'undefined') return
  const id = username.trim().toLowerCase()
  if (!id || id === 'admin') return
  try {
    window.localStorage.setItem(PROGRESS_SNAPSHOT_PREFIX + id, JSON.stringify(data))
  } catch {
    // ignore
  }
}

/** 指定受講生の進捗スナップショットを取得（保存済みキャッシュ。管理者画面では getProgressSnapshotLive を推奨） */
export function getProgressSnapshot(username: string): TraineeProgressSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const id = username.trim().toLowerCase()
    const raw = window.localStorage.getItem(PROGRESS_SNAPSHOT_PREFIX + id)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const d = parsed as Record<string, unknown>
    return {
      introConfirmed: Boolean(d.introConfirmed),
      introAt: typeof d.introAt === 'string' ? d.introAt : null,
      wbsPercent: typeof d.wbsPercent === 'number' ? d.wbsPercent : 0,
      chapterProgress: Array.isArray(d.chapterProgress) ? (d.chapterProgress as ChapterProgress[]) : [],
      currentDay: typeof d.currentDay === 'number' ? d.currentDay : 0,
      delayedIds: Array.isArray(d.delayedIds) ? (d.delayedIds as string[]) : [],
      updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : '',
      pins: Array.isArray(d.pins) ? (d.pins as string[]) : [],
      trainingStartDate: typeof (d as any).trainingStartDate === 'string' ? (d as any).trainingStartDate : null,
      infra4ViDoneSteps: Array.isArray((d as any).infra4ViDoneSteps)
        ? ((d as any).infra4ViDoneSteps as number[])
        : [],
      infra4ShellDoneQuestions: Array.isArray((d as any).infra4ShellDoneQuestions)
        ? ((d as any).infra4ShellDoneQuestions as number[])
        : [],
      infra4Rag:
        typeof (d as any).infra4Rag === 'string'
          ? (((d as any).infra4Rag as string) as 'green' | 'yellow' | 'red')
          : null,
    }
  } catch {
    return null
  }
}

/**
 * 指定受講生の進捗を localStorage からリアルタイムで算出（管理者画面用）。
 * 保存済みスナップショットに依存せず、常に正しい進捗を表示する。
 */
export function getProgressSnapshotLive(username: string): TraineeProgressSnapshot {
  if (typeof window === 'undefined') {
    return {
      introConfirmed: false,
      introAt: null,
      wbsPercent: 0,
      chapterProgress: [],
      currentDay: 0,
      delayedIds: [],
      updatedAt: new Date().toISOString(),
      pins: [],
    }
  }
  const id = username.trim().toLowerCase()
  if (!id || id === 'admin') {
    return {
      introConfirmed: false,
      introAt: null,
      wbsPercent: 0,
      chapterProgress: [],
      currentDay: 0,
      delayedIds: [],
      updatedAt: new Date().toISOString(),
      pins: [],
      infra4ViDoneSteps: [],
      infra4ShellDoneQuestions: [],
      infra4Rag: null,
    }
  }
  return {
    introConfirmed: getIntroConfirmedForUser(id),
    introAt: getIntroConfirmedAtForUser(id),
    wbsPercent: getWbsProgressPercent(id),
    chapterProgress: getChapterProgressList(id),
    currentDay: getCurrentProjectDay(id),
    delayedIds: getDelayedTaskIds(id),
    updatedAt: new Date().toISOString(),
    pins: [],
    trainingStartDate: getTrainingStartDate(id) || null,
    infra4ViDoneSteps: [],
    infra4ShellDoneQuestions: [],
    infra4Rag: null,
  }
}

/**
 * サーバーから取得したスナップショットを localStorage に書き戻す。
 * 別端末ログイン時に進捗が消えないよう、isDataReady を true にする前に必ず呼ぶこと。
 * 既に値がある場合は上書きしない（端末上での新しい操作を優先）。
 */
export function restoreProgressToLocalStorage(username: string, snap: TraineeProgressSnapshot): void {
  if (typeof window === 'undefined' || !username || username.toLowerCase() === 'admin') return
  const id = username.trim().toLowerCase()

  // はじめに完了状態（元のタイムスタンプを保持）
  if (snap.introConfirmed) {
    setIntroConfirmedForUserWithTimestamp(id, snap.introAt)
  }

  // 研修開始日（未設定の場合のみ復元）
  if (snap.trainingStartDate) {
    const startKey = getProgressKey(TRAINING_START_DATE_KEY, id)
    if (!window.localStorage.getItem(startKey)) {
      window.localStorage.setItem(startKey, snap.trainingStartDate)
    }
  }

  // チャプタークリアフラグ（chapterProgress の cleared が true のものだけ復元）
  // index 0→課題1, 1→課題2, 2→課題3, 3→課題4 に対応
  const CHAPTER_CLEARED_KEYS: string[][] = [
    [INFRA_BASIC_1_CLEARED_KEY, L1_CLEARED_KEY],
    [L2_CLEARED_KEY],
    [INFRA_BASIC_3_2_CLEARED_KEY],
    [INFRA_BASIC_4_VI_ALL_CLEARED_KEY, INFRA_BASIC_4_SHELL_ALL_CLEARED_KEY],
  ]
  if (Array.isArray(snap.chapterProgress)) {
    snap.chapterProgress.forEach((ch, i) => {
      if (!ch.cleared) return
      const keys = CHAPTER_CLEARED_KEYS[i]
      if (!keys) return
      keys.forEach((k) => window.localStorage.setItem(getProgressKey(k, id), 'true'))
    })
  }

  // 課題4 vi 操作の完了ステップ
  if (Array.isArray(snap.infra4ViDoneSteps)) {
    snap.infra4ViDoneSteps.forEach((step) => {
      window.localStorage.setItem(getProgressKey(getViStepKey(step), id), 'true')
    })
  }

  // 課題4 シェルスクリプト演習の完了問題
  if (Array.isArray(snap.infra4ShellDoneQuestions)) {
    snap.infra4ShellDoneQuestions.forEach((q) => {
      window.localStorage.setItem(getProgressKey(getShellQuestionKey(q), id), 'true')
    })
  }
}
