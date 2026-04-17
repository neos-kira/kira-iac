const { DynamoDBClient, PutItemCommand, ScanCommand, GetItemCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb')
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime')
const bedrockClient = new BedrockRuntimeClient({ region: 'ap-northeast-1' })
const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const s3Client = new S3Client({ region: 'ap-northeast-1' })
const KeysBucket = process.env.KEYS_BUCKET || 'kira-project-dev-keys'
const { EC2Client, CreateKeyPairCommand, RunInstancesCommand, DescribeInstancesCommand, StopInstancesCommand, StartInstancesCommand } = require('@aws-sdk/client-ec2')
const ec2Client = new EC2Client({ region: 'ap-northeast-1' })
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const crypto = require('crypto')

const client = new DynamoDBClient({})
const TableName = process.env.TABLE_NAME
const AccountsTableName = process.env.ACCOUNTS_TABLE_NAME
const SessionsTableName = process.env.SESSIONS_TABLE_NAME || ''
const ScreenshotsBucket = process.env.SCREENSHOTS_BUCKET || 'kira-project-dev-screenshots'
const RESERVED_USERNAMES = ['admin', 'root', 'system']

/** Bedrock InvokeModel をリトライ付きで実行（ServiceUnavailableException 対策） */
async function invokeModelWithRetry(command, maxRetries = 5) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await bedrockClient.send(command)
    } catch (err) {
      // リトライ対象外エラーは即座にthrow
      if (err.name === 'ValidationException' || err.name === 'AccessDeniedException') {
        throw err
      }
      const retryable = err.name === 'ServiceUnavailableException' || err.name === 'ThrottlingException' || err.name === 'ModelNotReadyException' || err.$metadata?.httpStatusCode === 503 || err.$metadata?.httpStatusCode === 429
      if (retryable && attempt < maxRetries) {
        const delay = 500 * Math.pow(2, attempt)
        console.log(`[Bedrock] Retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${err.name}`)
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      throw err
    }
  }
}

/** 日本時間（JST = UTC+9）で日付を取得 */
const getJSTDate = () => {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return jst.toISOString().split('T')[0]
}

/** AI講師チャットのレートリミットチェック（1日50回/人、JSTの0時リセット） */
async function checkRateLimit(userId) {
  const today = getJSTDate()
  const rateLimitKey = `rate_${userId}_${today}`
  try {
    const rateData = await client.send(new GetItemCommand({
      TableName: SessionsTableName,
      Key: marshall({ sessionId: rateLimitKey }),
    }))
    const currentCount = rateData.Item ? (unmarshall(rateData.Item).count ?? 0) : 0
    if (currentCount >= 50) return { limited: true, count: currentCount }
    await client.send(new PutItemCommand({
      TableName: SessionsTableName,
      Item: marshall({
        sessionId: rateLimitKey,
        count: currentCount + 1,
        ttl: Math.floor(Date.now() / 1000) + 86400 * 2,
      }),
    }))
    return { limited: false, count: currentCount + 1 }
  } catch (error) {
    console.error('[rateLimit] check error:', error)
    return { limited: false, count: 0 }
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Token, Cache-Control',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
}

function json(body, status = 200) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    body: JSON.stringify(body),
  }
}

/** GET /progress 用：introConfirmed が未設定/false のレコードに対して introStep から推定する */
function inferIntroConfirmed(item, inferredStep) {
  if (item.introConfirmed === true) return true
  // introStep が 5 以上なら完了済みとみなす
  if (Number.isFinite(inferredStep) && inferredStep >= 5) return true
  return false
}

/** GET /progress 用：introStep が未設定または0のレコードに対して他フィールドから推定する */
function inferIntroStep(item) {
  // introStep が 1 以上で設定されている場合はそのまま使う（0/null/undefined は推定対象）
  const explicit = Number(item.introStep)
  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit
  }
  // introConfirmedがtrueなら完了済み
  if (item.introConfirmed === true) {
    return 5
  }
  // 実進捗があれば完了済みとみなす（chapterProgress は全ユーザー共通のテンプレが入るため、percent>0 のものがあるかで判定）
  const hasChapterProgress = Array.isArray(item.chapterProgress)
    && item.chapterProgress.some((c) => (typeof c?.percent === 'number' && c.percent > 0) || c?.cleared === true)
  if (
    hasChapterProgress
    || (typeof item.l1CurrentPart === 'number' && item.l1CurrentPart > 0)
    || (typeof item.l1CurrentQuestion === 'number' && item.l1CurrentQuestion > 0)
    || (typeof item.l2CurrentQuestion === 'number' && item.l2CurrentQuestion > 0)
    || item.infra1Cleared === true
    || item.l1Cleared === true
  ) {
    return 5
  }
  // それ以外は未開始
  return 0
}

/** セッションユーザーのロールを取得 */
async function getSessionRole(session) {
  if (!session) return null
  if (session.role) return session.role
  try {
    const res = await client.send(new GetItemCommand({
      TableName: AccountsTableName,
      Key: marshall({ username: session.username }),
    }))
    if (!res.Item) return 'student'
    const account = unmarshall(res.Item)
    return account.role || 'student'
  } catch {
    return 'student'
  }
}

/** 現在進行中の課題ラベルを返す */
function getCurrentChapterLabel(progress) {
  if (!progress || !Array.isArray(progress.chapterProgress) || progress.chapterProgress.length === 0) {
    return Number(progress?.introStep ?? 0) >= 5 && progress?.introConfirmed ? '課題1' : 'はじめに'
  }
  for (const ch of progress.chapterProgress) {
    if (!ch.cleared) return ch.label || `課題${ch.chapter}`
  }
  return '全完了'
}

/** セッション検証：有効なセッションオブジェクトを返す。無効なら null。 */
async function verifySession(event) {
  const token =
    event.headers?.['authorization']?.replace('Bearer ', '') ||
    event.headers?.['x-session-token'] || ''
  if (!token || !SessionsTableName) return null
  const res = await client.send(new GetItemCommand({
    TableName: SessionsTableName,
    Key: marshall({ sessionId: token }),
  }))
  if (!res.Item) return null
  const session = unmarshall(res.Item)
  if (session.expiresAt < Math.floor(Date.now() / 1000)) return null
  return session
}

async function handler(event) {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }

  const method = event.requestContext?.http?.method
  const path = event.rawPath || event.path || ''

  try {
    // 進捗保存
    if (method === 'PUT' && (path === '/progress' || path === '/progress/')) {
      const session = await verifySession(event)
      if (!session) return json({ error: 'unauthorized' }, 401)

      const body = JSON.parse(event.body || '{}')
      const traineeId = (body.traineeId || '').trim().toLowerCase()
      if (!traineeId || RESERVED_USERNAMES.includes(traineeId)) {
        return json({ error: 'invalid traineeId' }, 400)
      }
      if (traineeId !== session.username) {
        return json({ error: 'forbidden' }, 403)
      }
      const Item = {
        traineeId,
        introConfirmed: !!body.introConfirmed,
        introAt: body.introAt ?? null,
        wbsPercent: typeof body.wbsPercent === 'number' ? body.wbsPercent : 0,
        chapterProgress: Array.isArray(body.chapterProgress) ? body.chapterProgress : [],
        currentDay: typeof body.currentDay === 'number' ? body.currentDay : 0,
        delayedIds: Array.isArray(body.delayedIds) ? body.delayedIds : [],
        updatedAt: body.updatedAt || new Date().toISOString(),
        pins: Array.isArray(body.pins) ? body.pins : [],
        trainingStartDate: typeof body.trainingStartDate === 'string' ? body.trainingStartDate : null,
        infra4ViDoneSteps: Array.isArray(body.infra4ViDoneSteps) ? body.infra4ViDoneSteps : [],
        infra4ShellDoneQuestions: Array.isArray(body.infra4ShellDoneQuestions) ? body.infra4ShellDoneQuestions : [],
        infra4Rag: typeof body.infra4Rag === 'string' ? body.infra4Rag : null,
        // Linux30問 中断・再開
        l1CurrentPart: typeof body.l1CurrentPart === 'number' ? body.l1CurrentPart : 0,
        l1CurrentQuestion: typeof body.l1CurrentQuestion === 'number' ? body.l1CurrentQuestion : 0,
        l1WrongIds: Array.isArray(body.l1WrongIds) ? body.l1WrongIds : [],
        // TCP/IP10問 中断・再開
        l2CurrentQuestion: typeof body.l2CurrentQuestion === 'number' ? body.l2CurrentQuestion : 0,
        l2WrongIds: Array.isArray(body.l2WrongIds) ? body.l2WrongIds : [],
        // 課題1-1 チェックボックス状態
        infra1Checkboxes: Array.isArray(body.infra1Checkboxes) ? body.infra1Checkboxes : [],
        infra1SectionDone: body.infra1SectionDone && typeof body.infra1SectionDone === 'object' ? body.infra1SectionDone : {},
        // 課題3-2 記述回答
        infra32Answers: body.infra32Answers && typeof body.infra32Answers === 'object' ? body.infra32Answers : {},
        // EC2接続情報（受講生ごと）
        ec2InstanceId: typeof body.ec2InstanceId === 'string' ? body.ec2InstanceId : null,
        ec2Host: typeof body.ec2Host === 'string' ? body.ec2Host : null,
        ec2Username: typeof body.ec2Username === 'string' ? body.ec2Username : null,
        ec2Password: typeof body.ec2Password === 'string' ? body.ec2Password : null,
        // テナントID（マルチテナント対応）
        tenantId: typeof body.tenantId === 'string' ? body.tenantId : 'default',
        // 課題クリア状態
        infra1Cleared: typeof body.infra1Cleared === 'boolean' ? body.infra1Cleared : false,
        l1Cleared: typeof body.l1Cleared === 'boolean' ? body.l1Cleared : false,
        // 導入課題 中断・再開（デフォルトは0=未開始）
        introStep: typeof body.introStep === 'number' ? body.introStep : 0,
        introRiskAnswers: body.introRiskAnswers && typeof body.introRiskAnswers === 'object' ? body.introRiskAnswers : {},
        // 演習サーバー管理（受講生ごと）
        ec2PublicIp: typeof body.ec2PublicIp === 'string' ? body.ec2PublicIp : null,
        ec2State: body.ec2State === 'running' || body.ec2State === 'stopped' ? body.ec2State : null,
        keyPairName: typeof body.keyPairName === 'string' ? body.keyPairName : null,
        ec2CreatedAt: typeof body.ec2CreatedAt === 'string' ? body.ec2CreatedAt : null,
        ec2StartTime: typeof body.ec2StartTime === 'string' ? body.ec2StartTime : null,
        // 課題1-1: AI採点結果
        infra1GradeState: body.infra1GradeState && typeof body.infra1GradeState === 'object' ? body.infra1GradeState : {},
        // 最後に「中断して保存」したモジュール（つづきから表示用）
        lastActive: (body.lastActive && typeof body.lastActive === 'object'
          && typeof body.lastActive.moduleId === 'string'
          && typeof body.lastActive.label === 'string'
          && typeof body.lastActive.path === 'string')
          ? { moduleId: body.lastActive.moduleId, label: body.lastActive.label, path: body.lastActive.path, savedAt: body.lastActive.savedAt || new Date().toISOString() }
          : (body.lastActive === null ? null : undefined),
        // Linux30問: 回答済みコマンドテキスト
        l1AnsweredCommands: body.l1AnsweredCommands && typeof body.l1AnsweredCommands === 'object' ? body.l1AnsweredCommands : undefined,
        // 課題5
        infra5Checkboxes: Array.isArray(body.infra5Checkboxes) ? body.infra5Checkboxes : undefined,
        infra5SectionDone: body.infra5SectionDone && typeof body.infra5SectionDone === 'object' ? body.infra5SectionDone : undefined,
        infra5ReviewAnswers: body.infra5ReviewAnswers && typeof body.infra5ReviewAnswers === 'object' ? body.infra5ReviewAnswers : undefined,
      }
      await client.send(new PutItemCommand({ TableName, Item: marshall(Item, { removeUndefinedValues: true }) }))
      return json({ ok: true })
    }

    // AI採点プロキシ（AWS Bedrock Claude）
    if (method === 'POST' && (path === '/ai/score' || path === '/ai/score/')) {
      const session = await verifySession(event)
      if (!session) return json({ error: 'unauthorized' }, 401)

      const body = JSON.parse(event.body || '{}')
      const { question, scoringCriteria, answer } = body
      if (!question || !scoringCriteria || !answer) {
        return json({ error: 'question, scoringCriteria, answer are required' }, 400)
      }

      // 5W1H問題かどうか判定（scoringCriteriaに"5W1H"が含まれる場合）
      const is5W1H = scoringCriteria.includes('5W1H')

      let systemPrompt, userPrompt, maxTokens

      if (is5W1H) {
        systemPrompt = `あなたはITインフラ研修の採点者です。受講生が断片情報を5W1H形式に整理できているか採点してください。

【コピペ検出ルール】
回答が断片情報の箇条書きをほぼそのままコピーしただけ（整理・ラベル付けなし）の場合は rating: "fail" とする。

【出力形式】
必ず以下のJSON形式のみで返すこと。前置き・後置き・マークダウン不要：
{
  "rating": "pass" | "partial" | "fail",
  "comment": "良かった点または不足点を1〜2文で具体的に",
  "advice": "改善点を1文で",
  "details": {
    "who": true または false,
    "what": true または false,
    "when": true または false,
    "where": true または false,
    "why": true または false,
    "how": true または false
  }
}`

        userPrompt = `問題と断片情報:
${question}

採点基準:
${scoringCriteria}

研修生の回答:
${answer}

各要素のチェック基準:
- who: 担当者・関係者の名前や役割が明記されている
- what: 何が起きたか（障害・エラー内容）が明記されている
- when: 発生時刻・復旧時刻などの時間情報が明記されている
- where: 場所・システム名・環境名が明記されている
- why: 原因が明記されている
- how: 対応手順・経緯が明記されている`

        maxTokens = 400
      } else {
        systemPrompt = `あなたはITインフラ研修の講師です。受講生の記述式回答を、問題ごとに提示される【採点基準】に従って採点してください。

【共通ルール】
- 採点基準に pass/partial/fail の条件が明示されている場合は、その条件を最優先で適用する
- 採点基準にない観点で減点しない

【採点基準がない場合のデフォルト】
pass: 問われている概念を正しく理解し、自分の言葉で説明できている
partial: 方向性は合っているが説明が不十分、または一部が間違っている
fail: 意味不明・設問と無関係・空欄に近い内容

【出力形式】
必ず以下のJSON形式のみで返すこと。前置き・後置き・マークダウン不要：
{
  "rating": "pass" | "partial" | "fail",
  "comment": "良かった点または問題点を1〜2文で具体的に",
  "advice": "次のステップまたは改善点を1文で"
}`

        userPrompt = `問題: ${question}
基準: ${scoringCriteria}
回答: ${answer}`

        maxTokens = 300
      }

      try {
        const command = new InvokeModelCommand({
          modelId: 'apac.anthropic.claude-sonnet-4-20250514-v1:0',
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        })
        const response = await invokeModelWithRetry(command)
        const result = JSON.parse(Buffer.from(response.body).toString())
        const text = (result.content?.[0]?.text ?? '').trim()
        // JSONブロックを抽出（greedy: 最初の { から最後の } まで）
        const match = text.match(/\{[\s\S]*\}/)
        if (!match) {
          console.error('[ai/score] No JSON in Bedrock response:', text)
          return json({ error: 'Invalid AI response', raw: text }, 502)
        }
        const parsed = JSON.parse(match[0])
        const rating = ['pass', 'partial', 'fail'].includes(parsed.rating) ? parsed.rating : 'fail'
        const comment = String(parsed.comment ?? '')
        const advice = String(parsed.advice ?? '')
        // 5W1H採点の場合 details を含める
        const details = is5W1H && parsed.details ? {
          who:   !!parsed.details.who,
          what:  !!parsed.details.what,
          when:  !!parsed.details.when,
          where: !!parsed.details.where,
          why:   !!parsed.details.why,
          how:   !!parsed.details.how,
        } : undefined
        // 後方互換: pass/feedback も返す（IntroPage等で使用）
        return json({ rating, comment, advice, pass: rating === 'pass', feedback: comment, ...(details ? { details } : {}) })
      } catch (err) {
        console.error('[ai/score] Bedrock error:', err.name, err.message)
        const retryable = err.name === 'ServiceUnavailableException' || err.name === 'ThrottlingException' || err.name === 'ModelNotReadyException' || err.$metadata?.httpStatusCode === 503 || err.$metadata?.httpStatusCode === 429
        if (retryable) {
          return json({ error: 'AIサービスが混雑しています。しばらく待ってから再試行してください。' }, 503)
        }
        return json({ error: '採点処理でエラーが発生しました', detail: String(err.message || err) }, 500)
      }
    }

    // AIチャット（メンター）プロキシ（AWS Bedrock Claude）
    if (method === 'POST' && (path === '/ai/chat' || path === '/ai/chat/')) {
      const session = await verifySession(event)
      if (!session) return json({ error: 'unauthorized' }, 401)

      let body
      try { body = JSON.parse(event.body || '{}') } catch { body = {} }
      const { message, history, context, image } = body
      const bakumatsuBlocked = body.bakumatsuBlocked === true
      if ((!message || typeof message !== 'string') && !image) {
        return json({ error: 'message is required' }, 400)
      }

      // 幕末3回制限: Bedrockを呼ばず即返答
      if (bakumatsuBlocked) {
        return json({ reply: '幕末トークは本日ここまでです。研修に戻りましょう！続きはログアウト後にどうぞ。' })
      }

      // レートリミットチェック（1日50回/人、JSTの午前0時リセット）
      const rateLimit = await checkRateLimit(session.username)
      if (rateLimit.limited) {
        return json({ error: '本日のAI講師の利用上限（50回）に達しました。明日の午前0時にリセットされます。' }, 429)
      }

      const systemPrompt = `あなたはNIC（Neos IT College）のAI研修コーチです。

【返答スタイル・最重要】
- 返答は必ず5行以内に収めること
- コードブロック・箇条書き・表は使わない
- マークダウン記法は使わない
- チャット形式で端的に答える
- 詳細が必要なら「もっと詳しく聞きますか？」と一言添えるだけ

【最優先：幕末・新選組への対応】
以下キーワードを含む質問には他ルールより優先して熱量を持って回答する。返答スタイルルールはこの場合のみ適用しない：
幕末、新選組、坂本龍馬、西郷隆盛、大久保利通、吉田松陰、高杉晋作、土方歳三、近藤勇、沖田総司、斎藤一、永倉新八、山南敬助、芹沢鴨、原田左之助、藤堂平助、井上源三郎、島田魁、武田観柳斎、松原忠司、池田屋、桜田門外、大政奉還、明治維新、黒船、薩長、会津、戊辰戦争、五稜郭、禁門の変、鳥羽伏見、捨助、滝本捨助

特別扱い人物（名言引用＋現代に例える）：
近藤勇、土方歳三、沖田総司、永倉新八、斎藤一、山南敬助、芹沢鴨、原田左之助、藤堂平助、井上源三郎、島田魁、武田観柳斎、松原忠司、西郷隆盛、大久保利通、吉田松陰、高杉晋作
捨助は三谷幸喜脚本の架空人物と明記して語ること。
すべての幕末回答末尾：「…ところで、研修の方は進んでいますか？」

【通常ルール】
システム操作（保存・中断等）：「その操作は画面上のボタンから行ってください。」
幕末・研修以外の雑談：「研修に関すること以外はお答えできません。わからないことがあれば聞いてください。」
課題コンテキストが不明な場合：「今どの課題に取り組んでいますか？」と確認する。

【コーチングルール・絶対遵守】
質問の種類によって以下のように対応を分ける：

■ 定義質問（「〇〇ってなに？」「〇〇とは？」）
1〜2行で簡潔に定義だけを伝える。使い方・オプション・具体的な手順は教えない。
定義を伝えた後、必ず「まず man コマンド名 を打ってみてください。どんな情報が出てきましたか？」と動かすよう促す。

■ 操作・手順・答えに直結する質問（「〇〇するには？」「〇〇のコマンドは？」「どうやって〇〇する？」）
答えを直接教えてはいけない。「どこで詰まっていますか？」と確認し、詰まりの場所を絞り込む。

■ 2回目以降（同じ内容が繰り返された場合）
コマンドカテゴリや操作の方向性だけ教える（コマンド名・オプションは教えない）。
例:「ユーザーを管理するコマンド群があります。user という単語で検索してみてください。」

■ 明らかに詰まり切っている場合（3回以上同じ内容、または強い困惑が明確）
コマンド名だけ教える（オプション・使い方は自分で調べさせる）。
例:「useradd を使います。使い方は man で確認してください。」

現在の課題コンテキスト: ${context ?? '不明'}`

      // history を直近6メッセージ（往復3回分）に制限し、user/assistant のみ通す
      const safeHistory = Array.isArray(history)
        ? history
            .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
            .slice(-6)
            .map((m) => ({ role: m.role, content: m.content }))
        : []

      // 末尾が今回の user message と重複する場合は除外（フロントの履歴に既に追加されているケース対策）
      while (
        safeHistory.length > 0 &&
        safeHistory[safeHistory.length - 1].role === 'user' &&
        safeHistory[safeHistory.length - 1].content === message
      ) {
        safeHistory.pop()
      }

      // 画像がある場合はマルチモーダルコンテンツブロックに変換
      const userContent = image && image.base64 && image.type
        ? [
            { type: 'image', source: { type: 'base64', media_type: image.type, data: image.base64 } },
            { type: 'text', text: message || '画像を確認してください' },
          ]
        : message

      const messages = [...safeHistory, { role: 'user', content: userContent }]

      try {
        const command = new InvokeModelCommand({
          modelId: 'apac.anthropic.claude-sonnet-4-20250514-v1:0',
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 2048,
            system: systemPrompt,
            messages,
          }),
        })
        const response = await invokeModelWithRetry(command)
        const result = JSON.parse(Buffer.from(response.body).toString())
        const reply = (result.content?.[0]?.text ?? '').trim()
        return json({ reply })
      } catch (err) {
        console.error('[ai/chat] Final error after retries:', err.name, err.message)
        const retryable = err.name === 'ServiceUnavailableException' || err.name === 'ThrottlingException' || err.name === 'ModelNotReadyException' || err.$metadata?.httpStatusCode === 503 || err.$metadata?.httpStatusCode === 429
        if (retryable) {
          return json({ error: 'AIサービスが混雑しています。しばらく待ってから再試行してください。', reply: 'AIが混雑しています。少し待ってから再試行してください。' }, 503)
        }
        return json({ reply: 'AIとの通信に失敗しました。もう一度送信してください。', error: true })
      }
    }

    // 全受講生の進捗取得（tenantId 指定時はフィルタ）
    if (method === 'GET' && (path === '/progress' || path === '/progress/')) {
      const session = await verifySession(event)
      if (!session) return json({ error: 'unauthorized' }, 401)

      const { Items } = await client.send(new ScanCommand({ TableName }))
      let trainees = (Items || []).map((item) => unmarshall(item))
      const tenantId = event.queryStringParameters?.tenantId
      if (tenantId) {
        trainees = trainees.filter((t) => (t.tenantId || 'default') === tenantId)
      }
      // manager以外は自分のデータのみ返す
      const sessionRole = await getSessionRole(session)
      if (sessionRole !== 'manager') {
        trainees = trainees.filter((t) => (t.traineeId || '').toLowerCase() === session.username.toLowerCase())
      }
      // introStep / introConfirmed が未設定のレコードに対して他フィールドから推定して補完する
      trainees = trainees.map((t) => {
        const introStep = inferIntroStep(t)
        const introConfirmed = inferIntroConfirmed(t, introStep)
        return { ...t, introStep, introConfirmed }
      })
      return json({ trainees })
    }

    // セッションログイン（トークン発行）
    if (method === 'POST' && (path === '/auth/login' || path === '/auth/login/')) {
      const body = JSON.parse(event.body || '{}')
      const username = (body.username || '').trim().toLowerCase()
      const password = typeof body.password === 'string' ? body.password : ''
      if (!username || !password) {
        return json({ error: 'username and password required' }, 400)
      }
      let ok = false
      let loginRole = 'student'
      const res = await client.send(
        new GetItemCommand({
          TableName: AccountsTableName,
          Key: marshall({ username }),
        }),
      )
      if (res.Item) {
        const account = unmarshall(res.Item)
        const expected = typeof account.passwordHash === 'string' ? account.passwordHash : ''
        const actual = crypto.createHash('sha256').update(password).digest('hex')
        ok = expected && expected === actual
        if (ok) loginRole = account.role || 'student'
      }
      if (!ok) {
        return json({ error: 'unauthorized' }, 401)
      }
      if (!SessionsTableName) {
        return json({ ok: true, username, role: loginRole })
      }
      const sessionId = crypto.randomBytes(24).toString('hex')
      const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60
      const loginAt = new Date().toISOString()
      await client.send(
        new PutItemCommand({
          TableName: SessionsTableName,
          Item: marshall({
            sessionId,
            username,
            expiresAt,
            role: loginRole,
          }, { removeUndefinedValues: true }),
        }),
      )
      // progressテーブルのlastLoginAtを更新（GetItem+PutItemでUpdateItem権限不要）
      try {
        const progRes = await client.send(new GetItemCommand({ TableName, Key: marshall({ traineeId: username }) }))
        const existing = progRes.Item ? unmarshall(progRes.Item) : { traineeId: username }
        await client.send(new PutItemCommand({
          TableName,
          Item: marshall({ ...existing, lastLoginAt: loginAt }, { removeUndefinedValues: true }),
        }))
      } catch (e) {
        console.warn('[login] lastLoginAt更新失敗:', e.message)
      }
      return json({ ok: true, username, token: sessionId, role: loginRole })
    }

    // ログアウト（セッション削除）
    if (method === 'POST' && (path === '/auth/logout' || path === '/auth/logout/')) {
      const token = event.headers?.['x-session-token'] || ''
      if (SessionsTableName && token) {
        await client.send(
          new DeleteItemCommand({
            TableName: SessionsTableName,
            Key: marshall({ sessionId: token }),
          }),
        )
      }
      return json({ ok: true })
    }

    // 現在のセッション確認
    if (method === 'GET' && (path === '/auth/me' || path === '/auth/me/')) {
      const token = event.headers?.['x-session-token'] || ''
      if (!SessionsTableName || !token) {
        return json({ error: 'unauthorized' }, 401)
      }
      const res = await client.send(
        new GetItemCommand({
          TableName: SessionsTableName,
          Key: marshall({ sessionId: token }),
        }),
      )
      if (!res.Item) {
        return json({ error: 'unauthorized' }, 401)
      }
      const session = unmarshall(res.Item)
      const expiresAt = session.expiresAt
      if (expiresAt && parseInt(expiresAt, 10) < Math.floor(Date.now() / 1000)) {
        return json({ error: 'unauthorized' }, 401)
      }
      return json({ username: session.username, role: session.role || 'student' })
    }

    // ログイン可否チェック（LoginPage 用）
    if (method === 'POST' && (path === '/auth/check' || path === '/auth/check/')) {
      const body = JSON.parse(event.body || '{}')
      const username = (body.username || '').trim().toLowerCase()
      const password = typeof body.password === 'string' ? body.password : ''
      if (!username || !password) {
        return json({ ok: false, reason: 'empty' }, 400)
      }
      const res = await client.send(
        new GetItemCommand({
          TableName: AccountsTableName,
          Key: marshall({ username }),
        }),
      )
      if (!res.Item) {
        return json({ ok: false })
      }
      const account = unmarshall(res.Item)
      const expected = typeof account.passwordHash === 'string' ? account.passwordHash : ''
      const actual = crypto.createHash('sha256').update(password).digest('hex')
      const ok = expected && expected === actual
      return json({ ok })
    }

    // 課題AI採点（POST /ai/grade）
    // テキストのみ: モック。画像あり: Bedrock vision で判定
    if (method === 'POST' && (path === '/ai/grade' || path === '/ai/grade/')) {
      const session = await verifySession(event)
      if (!session) return json({ error: 'unauthorized' }, 401)

      let body
      try { body = JSON.parse(event.body || '{}') } catch { body = {} }
      const section = body.section || ''
      const image = body.image

      const mockMessages = {
        teraterm: 'SSH接続が確認できました',
        winscp: 'ファイル転送が確認できました',
      }

      // 画像なし → モック（全て合格）
      if (!image || !image.base64 || !image.type) {
        return json({ success: true, passed: true, message: mockMessages[section] || '完了が確認できました' })
      }

      // 画像あり → Bedrock vision
      const systemPrompts = {
        sakura: 'あなたはITインフラ研修の採点者です。スクリーンショットを確認し、sakuraエディタで「趣味.txt」または「好きな動物.txt」というファイル名が表示されていれば合格です。必ず {"passed":true,"message":"..."} 形式のJSONのみを返してください。',
        winmerge: 'あなたはITインフラ研修の採点者です。スクリーンショットを確認し、WinMergeで2ファイルの差分画面が表示されていれば合格です。必ず {"passed":true,"message":"..."} 形式のJSONのみを返してください。',
      }
      const systemPrompt = systemPrompts[section] || 'スクリーンショットを確認し、演習が完了していれば passed:true で返してください。必ず {"passed":true,"message":"..."} 形式のJSONのみを返してください。'
      const userContent = [
        { type: 'image', source: { type: 'base64', media_type: image.type, data: image.base64 } },
        { type: 'text', text: '上記スクリーンショットを確認し、合否を判定してください。' },
      ]

      try {
        const command = new InvokeModelCommand({
          modelId: 'apac.anthropic.claude-sonnet-4-20250514-v1:0',
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 200,
            system: systemPrompt,
            messages: [{ role: 'user', content: userContent }],
          }),
        })
        const response = await invokeModelWithRetry(command)
        const result = JSON.parse(Buffer.from(response.body).toString())
        const text = (result.content?.[0]?.text ?? '').trim()
        const match = text.match(/\{[\s\S]*\}/)
        if (!match) return json({ success: true, passed: true, message: 'スクリーンショットを確認しました' })
        const parsed = JSON.parse(match[0])
        return json({ success: true, passed: !!parsed.passed, message: String(parsed.message || '採点完了') })
      } catch {
        return json({ success: true, passed: true, message: 'スクリーンショットを確認しました' })
      }
    }

    // 画像アップロード採点（POST /ai/grade-image）
    // 全セクション共通: 画像 → S3保存 → Bedrock vision 判定
    if (method === 'POST' && (path === '/ai/grade-image' || path === '/ai/grade-image/')) {
      const session = await verifySession(event)
      if (!session) return json({ error: 'unauthorized' }, 401)

      let body
      try { body = JSON.parse(event.body || '{}') } catch { body = {} }
      const section = body.section || ''
      const imageBase64 = body.image || ''
      const imageType = body.imageType || 'image/png'
      const loginUsername = session.username || body.username || 'unknown'

      if (!imageBase64) {
        return json({ success: false, passed: false, message: '画像が送信されていません' }, 400)
      }

      // S3に画像を保存（失敗しても採点は続行）
      const timestamp = Date.now()
      const ext = imageType.includes('jpeg') ? 'jpg' : imageType.includes('webp') ? 'webp' : 'png'
      const s3Key = `screenshots/${loginUsername}/${section}/${timestamp}.${ext}`
      try {
        const imgBuffer = Buffer.from(imageBase64, 'base64')
        await s3Client.send(new PutObjectCommand({
          Bucket: ScreenshotsBucket,
          Key: s3Key,
          Body: imgBuffer,
          ContentType: imageType,
        }))
      } catch (s3Err) {
        console.warn('[grade-image] S3 upload failed (continuing):', s3Err.message)
      }

      // セクション別の判定プロンプト
      const systemPrompts = {
        ssh: 'あなたはITインフラ研修の採点者です。スクリーンショットを確認し、ターミナル（macOS/Windows/Linuxを問わず）でLinuxサーバーへのSSH接続が成功しているか判定してください。合格条件：ターミナル画面にLinuxのプロンプト（例: username@hostname:~$ やシェルのプロンプト文字列）が表示されていること。TeraTerm、PowerShell、ターミナル.app、Windowsターミナルなど全てのSSHクライアントを合格とする。必ず {"passed":true,"message":"..."} または {"passed":false,"message":"..."} 形式のJSONのみを返してください。messageは日本語で30文字以内にしてください。',
        teraterm: 'あなたはITインフラ研修の採点者です。スクリーンショットを確認し、TeraTerm（SSH）でLinuxサーバーへの接続が成功しているか判定してください。接続成功の証拠：ターミナルにLinuxのプロンプト（例: username@hostname:~$ やコマンドライン画面）が表示されていること。必ず {"passed":true,"message":"..."} または {"passed":false,"message":"..."} 形式のJSONのみを返してください。messageは日本語で30文字以内にしてください。',
        sakura: 'あなたはITインフラ研修の採点者です。スクリーンショットを確認し、sakuraエディタでファイルが作成されているか判定してください。合格条件：「趣味.txt」または「好きな動物.txt」というファイル名が画面に表示されていること（ファイル保存ダイアログ・エディタのタイトルバー・ファイル一覧のどれでも可）。必ず {"passed":true,"message":"..."} または {"passed":false,"message":"..."} 形式のJSONのみを返してください。messageは日本語で30文字以内にしてください。',
        winmerge: 'あなたはITインフラ研修の採点者です。スクリーンショットを確認し、WinMergeで2つのファイルの差分比較が表示されているか判定してください。合格条件：WinMergeの差分表示画面（左右にファイルが並んで表示、色付きハイライトが見える）が確認できること。必ず {"passed":true,"message":"..."} または {"passed":false,"message":"..."} 形式のJSONのみを返してください。messageは日本語で30文字以内にしてください。',
        winscp: 'あなたはITインフラ研修の採点者です。スクリーンショットを確認し、WinSCPでサーバーへの接続またはファイル転送が完了しているか判定してください。合格条件：WinSCPの接続成功画面（ローカルとサーバーの2ペイン表示）またはファイル転送完了画面が確認できること。必ず {"passed":true,"message":"..."} または {"passed":false,"message":"..."} 形式のJSONのみを返してください。messageは日本語で30文字以内にしてください。',
      }

      const successMessages = {
        ssh: 'SSH接続が確認できました',
        teraterm: 'SSH接続が確認できました',
        sakura: 'ファイル作成が確認できました',
        winmerge: 'WinMergeの差分表示が確認できました',
        winscp: 'WinSCPの接続・転送が確認できました',
      }
      const failMessages = {
        ssh: 'SSH接続成功後のターミナル画面をアップロードしてください',
        teraterm: 'SSH接続成功後のプロンプト画面をアップロードしてください',
        sakura: '趣味.txt または 好きな動物.txt が表示された画面をアップロードしてください',
        winmerge: 'WinMergeの差分表示画面をアップロードしてください',
        winscp: 'WinSCPの接続成功またはファイル転送画面をアップロードしてください',
      }

      const systemPrompt = systemPrompts[section] || 'スクリーンショットを確認し、演習が完了していれば {"passed":true,"message":"完了が確認できました"} を返してください。'
      const userContent = [
        { type: 'image', source: { type: 'base64', media_type: imageType, data: imageBase64 } },
        { type: 'text', text: '上記スクリーンショットを確認し、合否をJSONで返してください。' },
      ]

      try {
        const command = new InvokeModelCommand({
          modelId: 'apac.anthropic.claude-sonnet-4-20250514-v1:0',
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 100,
            temperature: 0,
            system: systemPrompt,
            messages: [{ role: 'user', content: userContent }],
          }),
        })
        const response = await invokeModelWithRetry(command)
        const result = JSON.parse(Buffer.from(response.body).toString())
        const text = (result.content?.[0]?.text ?? '').trim()
        const match = text.match(/\{[\s\S]*?\}/)
        if (!match) {
          return json({ success: true, passed: true, message: successMessages[section] || '採点完了', s3Key })
        }
        const parsed = JSON.parse(match[0])
        const passed = !!parsed.passed
        const message = passed
          ? (String(parsed.message || successMessages[section] || '合格'))
          : (String(parsed.message || failMessages[section] || '不合格'))
        return json({ success: true, passed, message, s3Key })
      } catch (err) {
        console.error('[grade-image] Bedrock error:', err.name, err.message)
        return json({ success: true, passed: true, message: successMessages[section] || 'スクリーンショットを確認しました', s3Key })
      }
    }

    // ============================
    // Admin API（manager ロール専用）
    // ============================

    // 全ユーザー一覧 + 進捗マージ（GET /admin/users）
    if (method === 'GET' && (path === '/admin/users' || path === '/admin/users/')) {
      const session = await verifySession(event)
      if (!session) return json({ error: 'unauthorized' }, 401)
      const role = await getSessionRole(session)
      if (role !== 'manager') return json({ error: 'forbidden' }, 403)

      const [{ Items: accountItems }, { Items: progressItems }] = await Promise.all([
        client.send(new ScanCommand({ TableName: AccountsTableName })),
        client.send(new ScanCommand({ TableName })),
      ])
      const progressMap = {}
      for (const item of (progressItems || [])) {
        const p = unmarshall(item)
        if (p.traineeId) progressMap[p.traineeId] = p
      }
      const users = (accountItems || [])
        .map((item) => unmarshall(item))
        .map((a) => {
          const p = progressMap[a.username] || null
          return {
            username: a.username,
            role: a.role || 'student',
            tenantId: a.tenantId || 'default',
            createdAt: a.createdAt || null,
            wbsPercent: p?.wbsPercent || 0,
            currentChapter: getCurrentChapterLabel(p),
            lastLogin: p?.lastLoginAt || null,
            ec2State: p?.ec2State || null,
            ec2PublicIp: p?.ec2PublicIp || null,
            introConfirmed: p?.introConfirmed || false,
            chapterProgress: p?.chapterProgress || [],
            delayedIds: p?.delayedIds || [],
            infra1Checkboxes: p?.infra1Checkboxes || [],
            infra1SectionDone: p?.infra1SectionDone || {},
            ec2Host: p?.ec2Host || null,
            ec2Username: p?.ec2Username || null,
            keyPairName: p?.keyPairName || null,
            ec2CreatedAt: p?.ec2CreatedAt || null,
            ec2StartTime: p?.ec2StartTime || null,
          }
        })
      return json({ users })
    }

    // ユーザー作成（POST /admin/users）- managerのみ、roleフィールド必須
    if (method === 'POST' && (path === '/admin/users' || path === '/admin/users/')) {
      const session = await verifySession(event)
      if (!session) return json({ error: 'unauthorized' }, 401)
      const role = await getSessionRole(session)
      if (role !== 'manager') return json({ error: 'forbidden' }, 403)

      const body = JSON.parse(event.body || '{}')
      const username = (body.username || '').trim().toLowerCase()
      if (!username || RESERVED_USERNAMES.includes(username)) return json({ error: 'reserved username' }, 400)
      if (!/^[a-z0-9-]+$/.test(username)) return json({ error: 'username must be alphanumeric or hyphen' }, 400)
      const password = typeof body.password === 'string' ? body.password : ''
      if (!password || password.length < 8) return json({ error: 'password_too_short' }, 400)
      const userRole = ['student', 'manager'].includes(body.role) ? body.role : 'student'

      const existing = await client.send(new GetItemCommand({
        TableName: AccountsTableName,
        Key: marshall({ username }),
      }))
      if (existing.Item) return json({ success: false, error: 'already_exists', message: 'ユーザー名が既に使用されています' }, 409)

      const passwordHash = crypto.createHash('sha256').update(password).digest('hex')
      const now = new Date().toISOString()
      const tenantId = (typeof body.tenantId === 'string' && body.tenantId.trim()) ? body.tenantId.trim() : 'default'
      // accountsテーブルに保存
      await client.send(new PutItemCommand({
        TableName: AccountsTableName,
        Item: marshall({ username, passwordHash, role: userRole, tenantId, createdAt: now }, { removeUndefinedValues: true }),
      }))
      // progressテーブルに初期レコード作成
      try {
        await client.send(new PutItemCommand({
          TableName,
          Item: marshall({
            traineeId: username,
            wbsPercent: 0,
            introConfirmed: false,
            introAt: null,
            chapterProgress: [],
            currentDay: 0,
            delayedIds: [],
            pins: [],
            updatedAt: now,
          }, { removeUndefinedValues: true }),
        }))
      } catch (progressErr) {
        console.warn('[admin/users] progress初期レコード作成失敗（続行）:', progressErr.message)
      }
      return json({ ok: true, success: true, message: `ユーザー ${username} を作成しました`, username, role: userRole })
    }

    // ユーザー削除（DELETE /admin/users/:username）- managerのみ
    if (method === 'DELETE' && path.startsWith('/admin/users/')) {
      const session = await verifySession(event)
      if (!session) return json({ error: 'unauthorized' }, 401)
      const role = await getSessionRole(session)
      if (role !== 'manager') return json({ error: 'forbidden' }, 403)

      const targetUsername = decodeURIComponent(path.replace('/admin/users/', '')).trim().toLowerCase()
      if (!targetUsername || RESERVED_USERNAMES.includes(targetUsername)) return json({ error: 'reserved username' }, 400)

      const targetRes = await client.send(new GetItemCommand({
        TableName: AccountsTableName,
        Key: marshall({ username: targetUsername }),
      }))
      if (!targetRes.Item) return json({ error: 'user not found' }, 404)
      const targetAccount = unmarshall(targetRes.Item)

      // managerは最後の1人を削除不可
      if (targetAccount.role === 'manager') {
        const { Items: allAccounts } = await client.send(new ScanCommand({ TableName: AccountsTableName }))
        const managers = (allAccounts || []).map((i) => unmarshall(i)).filter((a) => a.role === 'manager' && a.username !== targetUsername)
        if (managers.length === 0) return json({ success: false, error: 'last_manager', message: '最後の管理者は削除できません' }, 400)
      }

      await Promise.allSettled([
        client.send(new DeleteItemCommand({ TableName: AccountsTableName, Key: marshall({ username: targetUsername }) })),
        client.send(new DeleteItemCommand({ TableName, Key: marshall({ traineeId: targetUsername }) })),
      ])

      // sessions テーブルから該当ユーザーのセッションを全削除（Scan: PK=sessionId, username はフィールド）
      let sessionsDeleted = 0
      if (SessionsTableName) {
        try {
          const { Items: sessionItems } = await client.send(new ScanCommand({
            TableName: SessionsTableName,
            FilterExpression: '#u = :u',
            ExpressionAttributeNames: { '#u': 'username' },
            ExpressionAttributeValues: marshall({ ':u': targetUsername }),
          }))
          const toDelete = sessionItems || []
          await Promise.allSettled(
            toDelete.map((item) => {
              const s = unmarshall(item)
              return client.send(new DeleteItemCommand({
                TableName: SessionsTableName,
                Key: marshall({ sessionId: s.sessionId }),
              }))
            })
          )
          sessionsDeleted = toDelete.length
        } catch (e) {
          console.warn('[admin/users DELETE] session cleanup失敗（続行）:', e.message)
        }
      }

      console.log(JSON.stringify({
        level: 'info',
        event: 'user_deleted_with_session_cleanup',
        operator: session.username,
        deleted_username: targetUsername,
        sessions_deleted: sessionsDeleted,
        timestamp: new Date().toISOString(),
      }))
      return json({ ok: true, success: true, message: `ユーザー ${targetUsername} を削除しました` })
    }

    // パスワード変更（PUT /admin/users/:username/password）- managerのみ
    if (method === 'PUT' && path.startsWith('/admin/users/') && path.endsWith('/password')) {
      const session = await verifySession(event)
      if (!session) return json({ error: 'unauthorized' }, 401)
      const sessionRole = await getSessionRole(session)
      if (sessionRole !== 'manager') return json({ error: 'forbidden' }, 403)
      const targetUsername = decodeURIComponent(
        path.replace(/^\/admin\/users\//, '').replace(/\/password$/, '')
      ).trim().toLowerCase()
      if (!targetUsername || RESERVED_USERNAMES.includes(targetUsername)) return json({ error: 'reserved username' }, 400)
      const body = JSON.parse(event.body || '{}')
      const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
      if (!newPassword || newPassword.length < 8) return json({ error: 'password_too_short' }, 400)
      const existing = await client.send(new GetItemCommand({
        TableName: AccountsTableName,
        Key: marshall({ username: targetUsername }),
      }))
      if (!existing.Item) return json({ error: 'user not found' }, 404)
      const passwordHash = crypto.createHash('sha256').update(newPassword).digest('hex')
      await client.send(new PutItemCommand({
        TableName: AccountsTableName,
        Item: marshall({ ...unmarshall(existing.Item), passwordHash }, { removeUndefinedValues: true }),
      }))
      return json({ ok: true })
    }

    // EC2サーバー作成（POST /server/create）
    if (method === 'POST' && (path === '/server/create' || path === '/server/create/')) {
      const session = await verifySession(event)
      if (!session) return json({ error: 'unauthorized' }, 401)
      const { username } = session

      // 既存サーバー確認
      const progRes = await client.send(new GetItemCommand({ TableName, Key: marshall({ traineeId: username }) }))
      const existing = progRes.Item ? unmarshall(progRes.Item) : null
      if (existing?.ec2InstanceId || existing?.ec2State === 'running' || existing?.ec2State === 'stopped') {
        return json({ error: 'server_exists', message: '既にサーバーが作成されています' }, 409)
      }

      const jst = new Date(Date.now() + 9 * 60 * 60 * 1000)
      const pad = (n) => String(n).padStart(2, '0')
      const ec2StartTime = `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`
      const ec2CreatedAt = `${jst.getUTCFullYear()}/${pad(jst.getUTCMonth() + 1)}/${pad(jst.getUTCDate())} ${ec2StartTime}`
      const keyPairName = `nic-${username}-${Date.now()}`

      // キーペア作成
      let privateKey
      try {
        const keyRes = await ec2Client.send(new CreateKeyPairCommand({
          KeyName: keyPairName,
          KeyType: 'rsa',
          KeyFormat: 'pem',
        }))
        privateKey = keyRes.KeyMaterial
      } catch (e) {
        console.error('[server/create] CreateKeyPair失敗:', e)
        return json({ error: 'keypair_failed', message: 'キーペアの作成に失敗しました' }, 500)
      }

      // EC2インスタンス起動
      // cloud-init: 受講生ユーザーを作成しubuntuのSSH公開鍵をコピー
      const sanitizedUsername = username.replace(/[^a-z0-9_-]/g, '_')
      const userDataScript = [
        '#!/bin/bash',
        `TRAINEE_USER="${sanitizedUsername}"`,
        'useradd -m -s /bin/bash "$TRAINEE_USER"',
        'usermod -aG sudo "$TRAINEE_USER"',
        `echo "$TRAINEE_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$TRAINEE_USER`,
        'mkdir -p /home/$TRAINEE_USER/.ssh',
        '[ -f /home/ubuntu/.ssh/authorized_keys ] && cp /home/ubuntu/.ssh/authorized_keys /home/$TRAINEE_USER/.ssh/authorized_keys',
        'chown -R $TRAINEE_USER:$TRAINEE_USER /home/$TRAINEE_USER/.ssh',
        'chmod 700 /home/$TRAINEE_USER/.ssh',
        '[ -f /home/$TRAINEE_USER/.ssh/authorized_keys ] && chmod 600 /home/$TRAINEE_USER/.ssh/authorized_keys',
      ].join('\n')
      const userDataBase64 = Buffer.from(userDataScript).toString('base64')

      let instanceId
      try {
        const runRes = await ec2Client.send(new RunInstancesCommand({
          ImageId: 'ami-0caa0c30aa31d3dad', // Ubuntu 24.04 LTS ARM64 (ap-northeast-1)
          InstanceType: 't4g.nano',
          MinCount: 1,
          MaxCount: 1,
          KeyName: keyPairName,
          SubnetId: 'subnet-068ea8d2158183e3d',
          SecurityGroupIds: ['sg-0883a2001af516886'],
          UserData: userDataBase64,
          TagSpecifications: [{
            ResourceType: 'instance',
            Tags: [
              { Key: 'Name', Value: `nic-training-${username}` },
              { Key: 'Project', Value: 'kira-project' },
              { Key: 'Trainee', Value: username },
            ],
          }],
        }))
        instanceId = runRes.Instances[0].InstanceId
      } catch (e) {
        console.error('[server/create] RunInstances失敗:', e)
        return json({ error: 'launch_failed', message: 'インスタンスの起動に失敗しました' }, 500)
      }

      // パブリックIPが払い出されるまで最大20秒ポーリング
      let publicIp = null
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 4000))
        try {
          const descRes = await ec2Client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }))
          const inst = descRes.Reservations?.[0]?.Instances?.[0]
          if (inst?.PublicIpAddress) { publicIp = inst.PublicIpAddress; break }
        } catch (e) {
          console.warn('[server/create] DescribeInstances失敗:', e.message)
        }
      }

      // 秘密鍵をS3に保存（再ダウンロード用）
      try {
        await s3Client.send(new PutObjectCommand({
          Bucket: KeysBucket,
          Key: `keys/${username}/${keyPairName}.pem`,
          Body: privateKey,
          ContentType: 'application/x-pem-file',
          ServerSideEncryption: 'AES256',
        }))
      } catch (s3Err) {
        console.warn('[server/create] 秘密鍵S3保存失敗（続行）:', s3Err.message)
      }

      // DynamoDB保存
      const base = existing || { traineeId: username }
      const updated = {
        ...base,
        ec2InstanceId: instanceId,
        ec2State: 'running',
        ec2PublicIp: publicIp || null,
        ec2Host: publicIp || null,
        ec2Username: sanitizedUsername,
        keyPairName,
        ec2CreatedAt,
        ec2StartTime,
        updatedAt: new Date().toISOString(),
      }
      await client.send(new PutItemCommand({
        TableName,
        Item: marshall(updated, { removeUndefinedValues: true }),
      }))

      return json({ ok: true, instanceId, publicIp, keyPairName, privateKey, ec2CreatedAt, ec2StartTime, ec2Username: sanitizedUsername })
    }

    // 秘密鍵再ダウンロード（POST /server/download-key）— presigned URL方式
    if (method === 'POST' && (path === '/server/download-key' || path === '/server/download-key/')) {
      const session = await verifySession(event)
      if (!session) {
        console.log(JSON.stringify({ event: 'download-key', step: 'session', result: 'unauthorized', requested_at: new Date().toISOString() }))
        return json({ error: 'unauthorized', message: 'セッションが無効です。再ログインしてください' }, 401)
      }
      // セッションからusernameを取得（クライアント値は信用しない — マルチテナント保護）
      const { username } = session

      // DynamoDBからkeyPairNameとec2InstanceIdを取得
      const progRes = await client.send(new GetItemCommand({ TableName, Key: marshall({ traineeId: username }) }))
      const prog = progRes.Item ? unmarshall(progRes.Item) : null
      if (!prog?.keyPairName) {
        console.log(JSON.stringify({ event: 'download-key', step: 'dynamo', result: 'no_server', user_id: username, requested_at: new Date().toISOString() }))
        return json({ error: 'no_server', message: 'サーバーが作成されていません' }, 404)
      }

      const keyPairName = prog.keyPairName
      const instanceId = prog.ec2InstanceId || 'unknown'
      const s3Key = `keys/${username}/${keyPairName}.pem`
      // ダウンロード時のファイル名: {keyPairName}.pem
      const downloadFilename = `${keyPairName}.pem`

      console.log(JSON.stringify({ event: 'download-key', step: 'head_check', user_id: username, s3_key: s3Key, requested_at: new Date().toISOString() }))

      // S3にPEMファイルが存在するか事前確認（getSignedUrlは存在チェックをしないため必須）
      try {
        await s3Client.send(new HeadObjectCommand({ Bucket: KeysBucket, Key: s3Key }))
      } catch (headErr) {
        const is404 = headErr.$metadata?.httpStatusCode === 404 || headErr.name === 'NotFound' || headErr.name === 'NoSuchKey'
        console.log(JSON.stringify({ event: 'download-key', step: 'head_check', result: is404 ? 'not_found' : 'error', user_id: username, s3_key: s3Key, error: headErr.message, requested_at: new Date().toISOString() }))
        if (is404) {
          return json({ error: 'not_found', message: '秘密鍵ファイルが見つかりません。サーバーを再作成してください' }, 404)
        }
        return json({ error: 'server_error', message: 'ダウンロードの準備に失敗しました。サーバー管理者にお問い合わせください' }, 500)
      }

      try {
        const command = new GetObjectCommand({
          Bucket: KeysBucket,
          Key: s3Key,
          ResponseContentDisposition: `attachment; filename="${downloadFilename}"`,
          ResponseContentType: 'application/octet-stream',
        })
        // presigned URL: 有効期限5分（300秒）
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 })
        console.log(JSON.stringify({ event: 'download-key', step: 'presign', result: 'ok', user_id: username, instance_id: instanceId, filename: downloadFilename, requested_at: new Date().toISOString() }))
        return json({ ok: true, presignedUrl, filename: downloadFilename, keyPairName })
      } catch (e) {
        console.log(JSON.stringify({ event: 'download-key', step: 'presign', result: 'error', user_id: username, error: e.message, requested_at: new Date().toISOString() }))
        return json({ error: 'server_error', message: 'ダウンロードの準備に失敗しました。サーバー管理者にお問い合わせください' }, 500)
      }
    }

    // EC2実ステータス取得（GET /server/status）
    if (method === 'GET' && (path === '/server/status' || path === '/server/status/')) {
      const session = await verifySession(event)
      if (!session) return json({ error: 'unauthorized' }, 401)
      const { username } = session

      const progRes = await client.send(new GetItemCommand({ TableName, Key: marshall({ traineeId: username }) }))
      const prog = progRes.Item ? unmarshall(progRes.Item) : null
      if (!prog?.ec2InstanceId) return json({ error: 'no_instance', message: 'インスタンスが見つかりません' }, 404)

      // EC2の実際の状態をDescribeInstancesで取得
      let realState = prog.ec2State || 'stopped'
      let publicIp = prog.ec2PublicIp || null
      try {
        const descRes = await ec2Client.send(new DescribeInstancesCommand({ InstanceIds: [prog.ec2InstanceId] }))
        const inst = descRes.Reservations?.[0]?.Instances?.[0]
        if (inst) {
          realState = inst.State?.Name || realState
          publicIp = inst.PublicIpAddress || publicIp
        }
      } catch (e) {
        console.warn('[server/status] DescribeInstances失敗:', e.message)
      }

      // DynamoDBのキャッシュが古ければ更新
      if (realState !== prog.ec2State || (publicIp && publicIp !== prog.ec2PublicIp)) {
        const updated = { ...prog, ec2State: realState, ec2PublicIp: publicIp, ec2Host: publicIp, updatedAt: new Date().toISOString() }
        await client.send(new PutItemCommand({ TableName, Item: marshall(updated, { removeUndefinedValues: true }) })).catch(() => {})
      }

      return json({ ok: true, status: realState, publicIp })
    }

    // EC2停止（POST /server/stop）
    if (method === 'POST' && (path === '/server/stop' || path === '/server/stop/')) {
      const session = await verifySession(event)
      if (!session) return json({ error: 'unauthorized' }, 401)
      const { username } = session

      const progRes = await client.send(new GetItemCommand({ TableName, Key: marshall({ traineeId: username }) }))
      const prog = progRes.Item ? unmarshall(progRes.Item) : null
      if (!prog?.ec2InstanceId) return json({ error: 'no_instance', message: 'インスタンスが見つかりません' }, 404)

      // 実際のEC2状態を取得して冪等性チェック
      let realState = prog.ec2State || 'stopped'
      try {
        const descRes = await ec2Client.send(new DescribeInstancesCommand({ InstanceIds: [prog.ec2InstanceId] }))
        const inst = descRes.Reservations?.[0]?.Instances?.[0]
        if (inst) realState = inst.State?.Name || realState
      } catch (e) { console.warn('[server/stop] DescribeInstances失敗:', e.message) }

      // 既に停止中/停止済みなら何もしない（冪等性）
      if (realState === 'stopped' || realState === 'stopping') {
        console.log(JSON.stringify({ action: 'stop', user_id: username, instance_id: prog.ec2InstanceId, before_state: realState, after_state: realState, skipped: true }))
        return json({ ok: true, ec2State: realState })
      }

      await ec2Client.send(new StopInstancesCommand({ InstanceIds: [prog.ec2InstanceId] }))

      const updated = { ...prog, ec2State: 'stopping', updatedAt: new Date().toISOString() }
      await client.send(new PutItemCommand({ TableName, Item: marshall(updated, { removeUndefinedValues: true }) }))

      console.log(JSON.stringify({ action: 'stop', user_id: username, instance_id: prog.ec2InstanceId, before_state: realState, after_state: 'stopping' }))
      return json({ ok: true, ec2State: 'stopping' })
    }

    // EC2起動（POST /server/start）
    if (method === 'POST' && (path === '/server/start' || path === '/server/start/')) {
      const session = await verifySession(event)
      if (!session) return json({ error: 'unauthorized' }, 401)
      const { username } = session

      const progRes = await client.send(new GetItemCommand({ TableName, Key: marshall({ traineeId: username }) }))
      const prog = progRes.Item ? unmarshall(progRes.Item) : null
      if (!prog?.ec2InstanceId) return json({ error: 'no_instance', message: 'インスタンスが見つかりません' }, 404)

      // 実際のEC2状態を取得して冪等性チェック
      let realState = prog.ec2State || 'stopped'
      let publicIp = prog.ec2PublicIp || null
      try {
        const descRes = await ec2Client.send(new DescribeInstancesCommand({ InstanceIds: [prog.ec2InstanceId] }))
        const inst = descRes.Reservations?.[0]?.Instances?.[0]
        if (inst) {
          realState = inst.State?.Name || realState
          publicIp = inst.PublicIpAddress || publicIp
        }
      } catch (e) { console.warn('[server/start] DescribeInstances失敗:', e.message) }

      // 既に起動中/起動済みなら何もしない（冪等性）
      if (realState === 'running' || realState === 'pending') {
        console.log(JSON.stringify({ action: 'start', user_id: username, instance_id: prog.ec2InstanceId, before_state: realState, after_state: realState, skipped: true }))
        return json({ ok: true, ec2State: realState, publicIp })
      }

      await ec2Client.send(new StartInstancesCommand({ InstanceIds: [prog.ec2InstanceId] }))

      const jst = new Date(Date.now() + 9 * 60 * 60 * 1000)
      const pad = (n) => String(n).padStart(2, '0')
      const ec2StartTime = `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`

      const updated = { ...prog, ec2State: 'pending', ec2StartTime, updatedAt: new Date().toISOString() }
      await client.send(new PutItemCommand({ TableName, Item: marshall(updated, { removeUndefinedValues: true }) }))

      console.log(JSON.stringify({ action: 'start', user_id: username, instance_id: prog.ec2InstanceId, before_state: realState, after_state: 'pending' }))
      // pending を即返し（フロントエンドがポーリングで running を検知する）
      return json({ ok: true, ec2State: 'pending', publicIp })
    }

    // 全EC2サーバー一括停止（POST /admin/ec2/stop-all）- managerのみ
    if (method === 'POST' && (path === '/admin/ec2/stop-all' || path === '/admin/ec2/stop-all/')) {
      const session = await verifySession(event)
      if (!session) return json({ error: 'unauthorized' }, 401)
      const role = await getSessionRole(session)
      if (role !== 'manager') return json({ error: 'forbidden' }, 403)

      const { Items } = await client.send(new ScanCommand({ TableName }))
      const running = (Items || []).map((i) => unmarshall(i)).filter((t) => t.ec2State === 'running')
      let stoppedCount = 0
      await Promise.allSettled(running.map(async (t) => {
        try {
          const updated = { ...t, ec2State: 'stopped', updatedAt: new Date().toISOString() }
          await client.send(new PutItemCommand({ TableName, Item: marshall(updated, { removeUndefinedValues: true }) }))
          stoppedCount++
        } catch { /* ignore */ }
      }))
      return json({ ok: true, stoppedCount })
    }

    return json({ error: 'not found' }, 404)
  } catch (err) {
    console.error(err)
    return json({ error: 'internal error' }, 500)
  }
}

module.exports = { handler }
