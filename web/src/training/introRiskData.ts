// ── 選択式問題 ────────────────────────────────────────────────────────────────

export type MCQuestion = {
  id: string
  section: string
  type: 'single' | 'multi'
  prompt: string
  choices: string[]
  correctIndices: number[]
}

// ── 記述式問題 ────────────────────────────────────────────────────────────────

export type EssayQuestion = {
  id: string
  section: string
  type: 'essay'
  prompt: string
  scenarioText?: string
  scoringCriteria: string
}

export type RiskQuestion = MCQuestion | EssayQuestion

// ── 問題定義 ──────────────────────────────────────────────────────────────────

export const INTRO_RISK_QUESTIONS: RiskQuestion[] = [
  // ── Step 2: AI利用時の機密保持（選択式 3問） ──────────────────────────────

  {
    id: 'ai-1',
    section: 'AI利用時の機密保持',
    type: 'multi',
    prompt: 'AIに入力してはいけない情報はどれですか？（複数選択可）',
    choices: [
      '顧客の個人情報（氏名・連絡先）',
      '社内のソースコード',
      'サーバーのIPアドレス・パスワード',
      '一般公開されている技術ドキュメント',
    ],
    correctIndices: [0, 1, 2],
  },
  {
    id: 'ai-2',
    section: 'AI利用時の機密保持',
    type: 'single',
    prompt: '顧客のサーバー設定ファイルをAIで解析したい。正しい対処は？',
    choices: [
      'そのままAIに貼り付けて解析する',
      'IPアドレスや顧客名をダミー値に置き換えてから入力する',
      '社内の誰かに頼んでAIに入力してもらう',
      'AIは社内ツールなので気にせず使う',
    ],
    correctIndices: [1],
  },
  {
    id: 'ai-3',
    section: 'AI利用時の機密保持',
    type: 'single',
    prompt: 'AIが生成したコードの扱い方として正しいのは？',
    choices: [
      '動作確認せずそのまま本番環境に適用する',
      '内容を理解・検証した上で使用する',
      'AIが生成したコードは完璧なので修正不要',
      '上長に確認せず自己判断で使う',
    ],
    correctIndices: [1],
  },

  // ── Step 3: 物理セキュリティ（選択式 3問） ────────────────────────────────

  {
    id: 'phys-1',
    section: '物理セキュリティ',
    type: 'multi',
    prompt: 'データセンター入館時に必ず行うべきことは？（複数選択可）',
    choices: [
      '入館記録を残す',
      '身分証を提示する',
      '知人が入るので一緒に入る（共連れ）',
      '作業内容を受付に伝える',
    ],
    correctIndices: [0, 1, 3],
  },
  {
    id: 'phys-2',
    section: '物理セキュリティ',
    type: 'single',
    prompt: 'ラック作業中に見知らぬ人が「手伝う」と近づいてきた。どうする？',
    choices: [
      'ありがたく手伝ってもらう',
      '身元と作業依頼元を確認する',
      '無視して作業を続ける',
      'その場を離れる',
    ],
    correctIndices: [1],
  },
  {
    id: 'phys-3',
    section: '物理セキュリティ',
    type: 'single',
    prompt: '作業端末をデータセンターに置き忘れた。最初にすべきことは？',
    choices: [
      '翌日取りに行く',
      '同僚に連絡して代わりに取ってもらう',
      '即座にセキュリティ担当・上長に報告する',
      'SNSで状況を共有する',
    ],
    correctIndices: [2],
  },

  // ── Step 4: リスク共有と報告（記述式 1問 / Bedrock採点） ─────────────────

  {
    id: 'risk-1',
    section: 'リスク共有と報告',
    type: 'essay',
    prompt: '以下のインシデントを5W1Hで報告してください。',
    scenarioText:
      '【シナリオ】\n' +
      'あなたは本日14時に顧客のWebサーバーで定期メンテナンスを実施していました。\n' +
      '作業手順書の手順5を実行したところ、Webサービスが停止しました。\n' +
      '原因を調査したところ設定ファイルの記述ミスが判明しました。\n' +
      '15時に復旧完了しました。',
    scoringCriteria:
      'When・Where・Who・What・Why・Howの全てが含まれていれば合格。一つでも欠けていれば不合格。',
  },
]

// localStorage 互換キー（旧コードとの後方互換）
export const INTRO_RISK_CLEARED_KEY = 'kira-intro-risk-cleared'
export const INTRO_RISK_PROGRESS_KEY = 'kira-intro-risk-progress'
