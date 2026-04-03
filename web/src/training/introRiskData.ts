export type RiskQuestion = {
  id: string
  section: string
  prompt: string
  scoringCriteria: string
}

export const INTRO_RISK_QUESTIONS: RiskQuestion[] = [
  // 1-1: AI利用時の機密保持
  {
    id: 'ai-1',
    section: 'AI利用時の機密保持',
    prompt: '現場でAIに入力してはいけない情報を具体的に3つ挙げ、その理由を説明してください。',
    scoringCriteria: '個人情報・顧客データ・社内機密・設計書・ソースコード・パスワードのいずれか3つ以上が挙げられており、外部サーバーに送信されるリスクについて言及されていれば合格。',
  },
  {
    id: 'ai-2',
    section: 'AI利用時の機密保持',
    prompt: '顧客のサーバー設定ファイルをAIで解析したいと思った時、どのように対処しますか？',
    scoringCriteria: 'そのまま入力しないことが明記されており、ダミーデータ化・社内ツール利用・上長への確認など代替手段への言及があれば合格。',
  },
  {
    id: 'ai-3',
    section: 'AI利用時の機密保持',
    prompt: 'AIが生成したコードをそのまま本番環境に適用することの問題点を説明してください。',
    scoringCriteria: '動作未確認リスク・セキュリティホール・責任の所在のいずれか2つ以上に言及していれば合格。',
  },
  // 1-2: 物理セキュリティ
  {
    id: 'phys-1',
    section: '物理セキュリティ',
    prompt: 'データセンターに入館する際に必ず行うべきことを説明してください。',
    scoringCriteria: '入館記録・身分証確認・共連れ禁止のいずれか2つ以上に言及していれば合格。',
  },
  {
    id: 'phys-2',
    section: '物理セキュリティ',
    prompt: 'ラック作業中に第三者が「作業を手伝う」と近づいてきた場合、どう対応しますか？',
    scoringCriteria: '身元確認・作業依頼元への確認・不審者報告のいずれかに言及していれば合格。',
  },
  {
    id: 'phys-3',
    section: '物理セキュリティ',
    prompt: '作業端末をデータセンター内に置き忘れた場合の対応手順を説明してください。',
    scoringCriteria: '即時報告・アクセスログ確認・セキュリティ担当への連絡への言及があれば合格。',
  },
  // 1-3: リスク共有と報告
  {
    id: 'risk-1',
    section: 'リスク共有と報告',
    prompt: `以下のインシデントを5W1Hで報告してください。

【シナリオ】
あなたは本日14時に顧客のWebサーバーで定期メンテナンスを実施していました。
作業手順書の手順5を実行したところ、Webサービスが停止しました。
原因を調査したところ、設定ファイルの記述ミスが判明しました。
15時に復旧完了しました。`,
    scoringCriteria: 'When・Where・Who・What・Why・Howの全てが含まれていれば合格。一つでも欠けていれば不合格。',
  },
]

export const INTRO_RISK_CLEARED_KEY = 'kira-intro-risk-cleared'
export const INTRO_RISK_PROGRESS_KEY = 'kira-intro-risk-progress'
