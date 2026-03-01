export type FeatureId = 'training' | 'timeTracking' | 'projects' | 'unknown'

export type TrainingCategory =
  | 'linuxLevel1'
  | 'linuxLevel2'
  | 'infra'
  | 'security'
  | 'business'
  | 'generic'

export type CommandResolution =
  | {
    feature: 'training'
    displayName: string
    reason: string
    training: {
      category: TrainingCategory
      // 実際の実装ではここにコースIDやクエリ条件などを持たせる
    }
  }
  | {
    feature: 'timeTracking' | 'projects'
    displayName: string
    reason: string
  }
  | {
    feature: 'unknown'
    displayName: string
    reason: string
  }

/**
 * LLM 連携の入口となるコマンド解析関数の雛形。
 * 現時点ではキーワードベースで判定しつつ、将来的に LLM 呼び出しに差し替えられるよう設計している。
 */
export async function resolveCommand(
  input: string,
): Promise<CommandResolution> {
  const text = input.trim()
  const lower = text.toLowerCase()

  // --- 研修系 ---
  if (/インフラ研修2|インフラ研修\s*2/.test(text)) {
    return {
      feature: 'training',
      displayName: 'インフラ研修2（TCP/IP）',
      reason: '「インフラ研修2」を検出しました。L1クリア者のみ挑戦可能です。',
      training: { category: 'linuxLevel2' },
    }
  }
  if (
    /インフラ研修1を開始|インフラ研修\s*1を開始|インフラ研修1/.test(text) ||
    (/インフラ研修|インフラ\s*トレーニング/.test(text) && /1|レベル\s*1/.test(text))
  ) {
    return {
      feature: 'training',
      displayName: 'インフラ研修1（Linuxコマンド30問）',
      reason: '「インフラ研修1」を検出しました。別タブで問題を開きます。',
      training: { category: 'linuxLevel1' },
    }
  }
  if (
    /インフラ研修|インフラ\s*トレーニング/.test(text) ||
    (lower.includes('training') && lower.includes('infra'))
  ) {
    return {
      feature: 'training',
      displayName: 'インフラ研修モジュール',
      reason: '「インフラ研修」に関するキーワードを検出しました。',
      training: { category: 'infra' },
    }
  }

  if (
    /研修|トレーニング/.test(text) ||
    lower.includes('training') ||
    lower.includes('learning')
  ) {
    return {
      feature: 'training',
      displayName: '研修ポータル',
      reason: '「研修」に関するキーワードを検出しました。',
      training: {
        category: 'generic',
      },
    }
  }

  // --- 勤怠 ---
  if (
    /勤怠|打刻|出勤|退勤/.test(text) ||
    lower.includes('attendance') ||
    lower.includes('time tracking')
  ) {
    return {
      feature: 'timeTracking',
      displayName: '勤怠管理モジュール',
      reason: '勤怠・打刻に関するキーワードを検出しました。',
    }
  }

  // --- プロジェクト管理 ---
  if (
    /プロジェクト管理|案件管理|タスク管理/.test(text) ||
    lower.includes('project') ||
    lower.includes('task board')
  ) {
    return {
      feature: 'projects',
      displayName: 'プロジェクト管理モジュール',
      reason: 'プロジェクト管理に関するキーワードを検出しました。',
    }
  }

  // --- LLM フォールバックのイメージ ---
  // 実際にはここで LLM API を呼び出して、スロットフィリングや意図分類を行う。
  // 例:
  // const llmResult = await callLlm({ input });
  // return mapLlmResultToResolution(llmResult);

  return {
    feature: 'unknown',
    displayName: '対応する機能が見つかりませんでした',
    reason: '既知のキーワードにマッチしませんでした。',
  }
}

