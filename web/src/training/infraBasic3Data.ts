export const INFRA_BASIC_3_1_DONE_KEY = 'neos_infra_basic_3_1_done'
export const INFRA_BASIC_3_2_STATE_KEY = 'neos_infra_basic_3_2_state'
export const INFRA_BASIC_3_2_CLEARED_KEY = 'neos_infra_basic_3_2_cleared'

export type InfraBasic32Answers = {
  q1: string
  q2: string
  q3: string
  q4: string
  q5: string
  q6: string
  q7: string
  q8: string
}

export type InfraBasic32Result = {
  checked: boolean
  pass: boolean
  feedback: string
}

export type InfraBasic32StoredState = {
  answers: InfraBasic32Answers
  results: Record<keyof InfraBasic32Answers, InfraBasic32Result>
}

export const INFRA_BASIC_3_2_DEFAULT_STATE: InfraBasic32StoredState = {
  answers: {
    q1: '',
    q2: '',
    q3: '',
    q4: '',
    q5: '',
    q6: '',
    q7: '',
    q8: '',
  },
  results: {
    q1: { checked: false, pass: false, feedback: '' },
    q2: { checked: false, pass: false, feedback: '' },
    q3: { checked: false, pass: false, feedback: '' },
    q4: { checked: false, pass: false, feedback: '' },
    q5: { checked: false, pass: false, feedback: '' },
    q6: { checked: false, pass: false, feedback: '' },
    q7: { checked: false, pass: false, feedback: '' },
    q8: { checked: false, pass: false, feedback: '' },
  },
}

export function loadInfraBasic32State(): InfraBasic32StoredState {
  if (typeof window === 'undefined') return INFRA_BASIC_3_2_DEFAULT_STATE
  try {
    const raw = window.localStorage.getItem(INFRA_BASIC_3_2_STATE_KEY)
    if (!raw) return INFRA_BASIC_3_2_DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<InfraBasic32StoredState>
    return {
      answers: { ...INFRA_BASIC_3_2_DEFAULT_STATE.answers, ...(parsed.answers ?? {}) },
      results: { ...INFRA_BASIC_3_2_DEFAULT_STATE.results, ...(parsed.results ?? {}) },
    }
  } catch {
    return INFRA_BASIC_3_2_DEFAULT_STATE
  }
}

export function saveInfraBasic32State(state: InfraBasic32StoredState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(INFRA_BASIC_3_2_STATE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

