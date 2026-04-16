/** 演習用パラメータ（管理画面のフォームプレースホルダー用途のみ — 実際の接続先IPは各研修生のec2PublicIpを使用すること） */
export const INFRA_BASIC_1_PARAMS = {
  host: 'xx.xx.xx.xx',
  userRoot: 'root',
  userKensyu: 'neos-training',
  password: 'neos-training',
} as const

/** 一括コピー用のテキストブロック */
export function getInfraBasic1CopyBlock(): string {
  return [
    `接続先IP: ${INFRA_BASIC_1_PARAMS.host}`,
    `ユーザ名: ${INFRA_BASIC_1_PARAMS.userRoot} または ${INFRA_BASIC_1_PARAMS.userKensyu}`,
    `共通パスワード: ${INFRA_BASIC_1_PARAMS.password}`,
  ].join('\n')
}

export const INFRA_BASIC_1_STORAGE_KEY = 'neos_infra_basic_1'
export const INFRA_BASIC_1_CLEARED_KEY = 'neos_infra_basic_1_cleared'

export type InfraBasic1StoredState = {
  checkboxes: boolean[]
  sectionDone: Record<string, boolean>
}

export const INFRA_BASIC_1_DEFAULT_STATE: InfraBasic1StoredState = {
  checkboxes: [],
  sectionDone: {},
}

/** storageKey を省略した場合はグローバルキーを使用（後方互換） */
export function loadInfraBasic1State(storageKey?: string): InfraBasic1StoredState {
  if (typeof window === 'undefined') return INFRA_BASIC_1_DEFAULT_STATE
  const key = storageKey ?? INFRA_BASIC_1_STORAGE_KEY
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return INFRA_BASIC_1_DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<InfraBasic1StoredState>
    return {
      checkboxes: Array.isArray(parsed.checkboxes) ? parsed.checkboxes : [],
      sectionDone: parsed.sectionDone && typeof parsed.sectionDone === 'object' ? parsed.sectionDone : {},
    }
  } catch {
    return INFRA_BASIC_1_DEFAULT_STATE
  }
}

/** storageKey を省略した場合はグローバルキーを使用（後方互換） */
export function saveInfraBasic1State(state: InfraBasic1StoredState, storageKey?: string): void {
  if (typeof window === 'undefined') return
  const key = storageKey ?? INFRA_BASIC_1_STORAGE_KEY
  try {
    window.localStorage.setItem(key, JSON.stringify(state))
  } catch {
    // ignore
  }
}
