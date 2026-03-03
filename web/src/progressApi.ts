/**
 * 進捗をサーバー（API + DynamoDB）に送信・取得し、admin が任意の端末から進捗確認できるようにする。
 */
import type { TraineeProgressSnapshot } from './traineeProgressStorage'

const BASE_URL = typeof import.meta.env !== 'undefined' && import.meta.env.VITE_PROGRESS_API_URL
  ? (import.meta.env.VITE_PROGRESS_API_URL as string).replace(/\/$/, '')
  : ''

export function isProgressApiAvailable(): boolean {
  return BASE_URL.length > 0
}

/** 進捗をサーバーに保存（受講生ログイン中に定期的に呼ぶ） */
export async function postProgress(traineeId: string, snapshot: TraineeProgressSnapshot): Promise<boolean> {
  if (!BASE_URL) return false
  const id = traineeId.trim().toLowerCase()
  if (!id || id === 'admin') return false
  try {
    const res = await fetch(`${BASE_URL}/progress`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ traineeId: id, ...snapshot }),
    })
    return res.ok
  } catch {
    return false
  }
}

export type TraineeProgressFromApi = TraineeProgressSnapshot & { traineeId: string }

/** 全受講生の進捗をサーバーから取得（admin 画面用） */
export async function fetchProgressFromApi(): Promise<TraineeProgressFromApi[]> {
  if (!BASE_URL) return []
  try {
    const res = await fetch(`${BASE_URL}/progress`)
    if (!res.ok) return []
    const data = (await res.json()) as { trainees?: TraineeProgressFromApi[] }
    return Array.isArray(data.trainees) ? data.trainees : []
  } catch {
    return []
  }
}

/** 指定受講生の進捗をサーバーから取得（受講生画面用）。なければ null。 */
export async function fetchMyProgress(traineeId: string): Promise<TraineeProgressSnapshot | null> {
  if (!BASE_URL) return null
  const id = traineeId.trim().toLowerCase()
  if (!id || id === 'admin') return null
  const all = await fetchProgressFromApi()
  const me = all.find((t) => (t.traineeId || '').trim().toLowerCase() === id)
  return me ?? null
}
