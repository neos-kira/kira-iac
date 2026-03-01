export const INFRA_BASIC_21_STORAGE_KEY = 'neos_infra_basic_21'

export type InfraBasic21Practical = {
  q1Ip: string
  q1Mask: string
  q1Dg: string
  q1Mac: string
  q2Devices: string
  q3PingResult: string
  q4TraceResult: string
  q5BoundaryIp: string
  q6PingServerOk: boolean
  q7SshServerOk: boolean
  q8ServerIp: string
  q8ServerMask: string
  q8ServerDg: string
  q9NetworkAddress: string
  q9Working: string
}

export type KnowledgeQuestionId =
  | 'macWhat'
  | 'macDuplicate'
  | 'lanWanDiff'
  | 'globalIpNeed'
  | 'dgMisconfig'

export type InfraBasic21KnowledgeAnswers = Record<KnowledgeQuestionId, string>

export type InfraBasic21KnowledgeResult = {
  checked: boolean
  pass: boolean
  feedback: string
}

export type InfraBasic21StoredState = {
  practical: InfraBasic21Practical
  knowledgeAnswers: InfraBasic21KnowledgeAnswers
  knowledgeResult: Record<KnowledgeQuestionId, InfraBasic21KnowledgeResult>
}

export const INFRA_BASIC_21_DEFAULT_STATE: InfraBasic21StoredState = {
  practical: {
    q1Ip: '',
    q1Mask: '',
    q1Dg: '',
    q1Mac: '',
    q2Devices: '',
    q3PingResult: '',
    q4TraceResult: '',
    q5BoundaryIp: '',
    q6PingServerOk: false,
    q7SshServerOk: false,
    q8ServerIp: '',
    q8ServerMask: '',
    q8ServerDg: '',
    q9NetworkAddress: '',
    q9Working: '',
  },
  knowledgeAnswers: {
    macWhat: '',
    macDuplicate: '',
    lanWanDiff: '',
    globalIpNeed: '',
    dgMisconfig: '',
  },
  knowledgeResult: {
    macWhat: { checked: false, pass: false, feedback: '' },
    macDuplicate: { checked: false, pass: false, feedback: '' },
    lanWanDiff: { checked: false, pass: false, feedback: '' },
    globalIpNeed: { checked: false, pass: false, feedback: '' },
    dgMisconfig: { checked: false, pass: false, feedback: '' },
  },
}

/** storageKey を省略した場合はグローバルキーを使用（後方互換） */
export function loadInfraBasic21State(storageKey?: string): InfraBasic21StoredState {
  if (typeof window === 'undefined') return INFRA_BASIC_21_DEFAULT_STATE
  const key = storageKey ?? INFRA_BASIC_21_STORAGE_KEY
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return INFRA_BASIC_21_DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<InfraBasic21StoredState>
    return {
      practical: { ...INFRA_BASIC_21_DEFAULT_STATE.practical, ...(parsed.practical ?? {}) },
      knowledgeAnswers: { ...INFRA_BASIC_21_DEFAULT_STATE.knowledgeAnswers, ...(parsed.knowledgeAnswers ?? {}) },
      knowledgeResult: { ...INFRA_BASIC_21_DEFAULT_STATE.knowledgeResult, ...(parsed.knowledgeResult ?? {}) },
    }
  } catch {
    return INFRA_BASIC_21_DEFAULT_STATE
  }
}

/** storageKey を省略した場合はグローバルキーを使用（後方互換） */
export function saveInfraBasic21State(state: InfraBasic21StoredState, storageKey?: string): void {
  if (typeof window === 'undefined') return
  const key = storageKey ?? INFRA_BASIC_21_STORAGE_KEY
  try {
    window.localStorage.setItem(key, JSON.stringify(state))
  } catch {
    // ignore
  }
}

type KeywordGroup = {
  label: string
  variants: string[]
}

export type KnowledgeQuestionConfig = {
  id: KnowledgeQuestionId
  title: string
  keywordGroups: KeywordGroup[]
  modelAnswer: string
}

export const KNOWLEDGE_QUESTIONS_21: KnowledgeQuestionConfig[] = [
  {
    id: 'macWhat',
    title: 'MACアドレスとは',
    keywordGroups: [
      { label: '物理アドレス', variants: ['物理アドレス'] },
      { label: '一意', variants: ['一意', '一様', '唯一'] },
      { label: '16進数', variants: ['16進数', '１６進数'] },
      { label: '48bit', variants: ['48bit', '48ビット', '４８ビット'] },
    ],
    modelAnswer:
      'ヒント: 「どの層で使われるか」「物理アドレスであること」「世界で一意」「48bit を 16進数で表している」といった観点で整理してみましょう。',
  },
  {
    id: 'macDuplicate',
    title: 'MACアドレス重複の影響',
    keywordGroups: [
      { label: '届かない', variants: ['届かない', '届かなくなる'] },
      { label: '不安定', variants: ['不安定', '不安定になる'] },
      { label: '通信不能', variants: ['通信不能', '通信できない'] },
    ],
    modelAnswer:
      'ヒント: スイッチの MAC アドレステーブルが「どの端末がどこにいるか」を覚えていることを思い出してください。重複するとテーブルが揺れてしまい、フレームが届かない／通信が不安定になるイメージで説明してみましょう。',
  },
  {
    id: 'lanWanDiff',
    title: 'LANとWANの違い',
    keywordGroups: [
      { label: 'Local/Wide', variants: ['LAN', 'Local', 'ローカル', 'WAN', 'Wide', 'ワイド'] },
      { label: '範囲', variants: ['範囲', 'エリア', 'スコープ'] },
      { label: '組織内/外', variants: ['組織内', '社内', '拠点内', '組織外', 'インターネット'] },
    ],
    modelAnswer:
      'ヒント: 「どのくらいの範囲をカバーするか」と「組織の内側か外側か」に注目して、LAN と WAN を対比させてみましょう。インターネットがどちら側に入るかも言及できると良いです。',
  },
  {
    id: 'globalIpNeed',
    title: 'グローバルIPアドレスが必要な理由',
    keywordGroups: [
      { label: 'インターネット', variants: ['インターネット'] },
      { label: '一意', variants: ['一意', '唯一', '世界で一つ'] },
      { label: '特定', variants: ['特定', '識別', '識別する'] },
    ],
    modelAnswer:
      'ヒント: インターネット上で「住所がかぶっている家」があるとどうなるかをイメージしてみてください。世界で一意に特定できるアドレスが必要な理由を、通信の流れと合わせて説明してみましょう。',
  },
  {
    id: 'dgMisconfig',
    title: 'デフォルトゲートウェイ設定ミスの影響',
    keywordGroups: [
      { label: '外に出られない', variants: ['外に出られない', 'インターネットに出られない', '外へ出られない'] },
      { label: '内部は可能', variants: ['内部は可能', 'LAN内は通信できる', '同一ネットワーク内は通信できる'] },
    ],
    modelAnswer:
      'ヒント: デフォルトゲートウェイは「外の世界への出口」であることを意識してみてください。出口が間違っているとどんな通信だけが失敗して、どんな通信はそのまま通るのか、具体的な例を交えて書いてみましょう。',
  },
]

