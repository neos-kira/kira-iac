import { isProgressApiAvailable } from './progressApi'

const BASE_URL =
  typeof import.meta.env !== 'undefined' && import.meta.env.VITE_PROGRESS_API_URL
    ? (import.meta.env.VITE_PROGRESS_API_URL as string).replace(/\/$/, '')
    : ''

export type Account = {
  username: string
  createdAt?: string
}

export function isAccountApiAvailable(): boolean {
  return isProgressApiAvailable()
}

export async function createAccount(username: string): Promise<boolean> {
  if (!BASE_URL) return false
  const name = username.trim().toLowerCase()
  if (!name || name === 'admin') return false
  try {
    const res = await fetch(`${BASE_URL}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: name }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function fetchAccounts(): Promise<Account[]> {
  if (!BASE_URL) return []
  try {
    const res = await fetch(`${BASE_URL}/accounts`)
    if (!res.ok) return []
    const data = (await res.json()) as { accounts?: Account[] }
    if (!Array.isArray(data.accounts)) return []
    return data.accounts
      .map((a) => ({
        username: (a.username || '').trim().toLowerCase(),
        createdAt: a.createdAt,
      }))
      .filter((a) => a.username && a.username !== 'admin')
  } catch {
    return []
  }
}

export async function checkAccount(username: string): Promise<boolean> {
  if (!BASE_URL) return false
  const name = username.trim().toLowerCase()
  if (!name) return false
  try {
    const res = await fetch(`${BASE_URL}/auth/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: name }),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { ok?: boolean }
    return !!data.ok
  } catch {
    return false
  }
}

export async function deleteAccount(username: string): Promise<boolean> {
  if (!BASE_URL) return false
  const name = username.trim().toLowerCase()
  if (!name || name === 'admin') return false
  try {
    const res = await fetch(`${BASE_URL}/accounts`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: name }),
    })
    return res.ok
  } catch {
    return false
  }
}


