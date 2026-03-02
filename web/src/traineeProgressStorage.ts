/**
 * 受講生リストと進捗スナップショットを localStorage に保存し、
 * 管理者画面で admin 以外の受講生（kira-test 等）の進捗を一覧表示するための仕組み。
 */
import { getIntroConfirmed, getIntroConfirmedAt, getIntroConfirmedForUser, getIntroConfirmedAtForUser } from './training/introGate'
import {
  getWbsProgressPercent,
  getChapterProgressList,
  getCurrentProjectDay,
  getDelayedTaskIds,
} from './training/trainingWbsData'
import type { ChapterProgress } from './training/trainingWbsData'

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

/** 現在のグローバル進捗からスナップショットを生成（受講生が利用中に呼ぶ） */
export function getCurrentProgressSnapshot(): TraineeProgressSnapshot {
  return {
    introConfirmed: getIntroConfirmed(),
    introAt: getIntroConfirmedAt(),
    wbsPercent: getWbsProgressPercent(),
    chapterProgress: getChapterProgressList(),
    currentDay: getCurrentProjectDay(),
    delayedIds: getDelayedTaskIds(),
    updatedAt: new Date().toISOString(),
  }
}

/** 指定受講生の進捗スナップショットを保存 */
export function saveProgressSnapshot(username: string, data: TraineeProgressSnapshot): void {
  if (typeof window === 'undefined') return
  const id = username.trim()
  if (!id || id.toLowerCase() === 'admin') return
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
    const raw = window.localStorage.getItem(PROGRESS_SNAPSHOT_PREFIX + username)
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
    }
  }
  const id = username.trim()
  if (!id || id.toLowerCase() === 'admin') {
    return {
      introConfirmed: false,
      introAt: null,
      wbsPercent: 0,
      chapterProgress: [],
      currentDay: 0,
      delayedIds: [],
      updatedAt: new Date().toISOString(),
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
  }
}
