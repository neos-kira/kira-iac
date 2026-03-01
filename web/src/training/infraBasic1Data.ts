/** 演習用パラメータ（一括コピー用） */
export const INFRA_BASIC_1_PARAMS = {
  host: '43.207.53.141',
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

export function loadInfraBasic1State(): InfraBasic1StoredState {
  if (typeof window === 'undefined') return INFRA_BASIC_1_DEFAULT_STATE
  try {
    const raw = window.localStorage.getItem(INFRA_BASIC_1_STORAGE_KEY)
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

export function saveInfraBasic1State(state: InfraBasic1StoredState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(INFRA_BASIC_1_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}
