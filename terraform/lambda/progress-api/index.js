const { DynamoDBClient, PutItemCommand, ScanCommand, GetItemCommand, DeleteItemCommand, UpdateItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb')
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
const AiChatHistoryTableName = process.env.AI_CHAT_HISTORY_TABLE_NAME || ''
const ScreenshotsBucket = process.env.SCREENSHOTS_BUCKET || 'kira-project-dev-screenshots'
const RESERVED_USERNAMES = ['admin', 'root', 'system']

/** Bedrock InvokeModel をリトライ付きで実行（ServiceUnavailableException 対策） */
async function invokeModelWithRetry(command, maxRetries = 3) {
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
        // 初回1秒、2倍バックオフ、最大30秒でキャップ
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000)
        console.log(JSON.stringify({ level: 'warn', event: 'bedrock_retry', attempt: attempt + 1, max_retries: maxRetries, delay_ms: delay, error_name: err.name, timestamp: new Date().toISOString() }))
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      throw err
    }
  }
}

/** ULID 生成（時系列ソート可能な 26 文字 ID） */
function generateULID() {
  const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  let ts = Date.now()
  let timeStr = ''
  for (let i = 9; i >= 0; i--) {
    timeStr = ENCODING[ts % 32] + timeStr
    ts = Math.floor(ts / 32)
  }
  const randomBytes = crypto.randomBytes(10)
  let randStr = ''
  for (let i = 0; i < 10; i++) {
    const hi = (randomBytes[i] >> 3) & 0x1f
    const lo = randomBytes[i] & 0x07
    randStr += ENCODING[hi]
    if (randStr.length < 16) randStr += ENCODING[lo]
  }
  return timeStr + randStr.slice(0, 16)
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

/** wbsPercent を progress フィールドから算出（student側と同じロジック） */
function calcWbsPercent(p) {
  if (!p) return 0
  const ch = Array.isArray(p.chapterProgress) ? p.chapterProgress : []
  const subCleared = [
    Number(p.introStep ?? 0) >= 5 && p.introConfirmed ? 1 : 0,
    p.infra1Cleared ? 1 : 0,
    p.l1Cleared ? 1 : 0,
    ch[1]?.cleared ? 1 : 0,
    ch[2]?.cleared ? 1 : 0,
    ch[3]?.cleared ? 1 : 0,
  ].reduce((a, b) => a + b, 0)
  return Math.round(subCleared / 8 * 100)
}

/** 現在進行中の課題ラベルを返す（lastActive.label 優先、student側と同じフォールバック） */
function getCurrentChapterLabel(progress) {
  if (!progress) return 'はじめに'
  if (progress.lastActive?.label) return progress.lastActive.label
  // フォールバック: l1CurrentPart/l1CurrentQuestion から判定
  const l1Part = Number(progress.l1CurrentPart ?? 0)
  const l1Q = Number(progress.l1CurrentQuestion ?? 0)
  if ((l1Part > 0 || l1Q > 0) && !progress.l1Cleared) {
    const partLabels = ['基本操作', 'サーバー構築', '実践問題']
    return `課題1-2 · ${partLabels[l1Part] ?? '基本操作'} ${l1Q + 1}/10問`
  }
  // infra1途中
  const infra1Checkboxes = Array.isArray(progress.infra1Checkboxes) ? progress.infra1Checkboxes : []
  if (infra1Checkboxes.some(Boolean) && !progress.infra1Cleared) {
    return '課題1-1 · ツール演習（途中から再開）'
  }
  // l2途中
  const l2Q = Number(progress.l2CurrentQuestion ?? 0)
  if (l2Q > 0) return `課題2-2 · TCP/IP ${l2Q + 1}/10問`
  return 'はじめに'
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

/** EventBridge Scheduler から呼び出される自動停止ハンドラ（8時間超のEC2を停止） */
async function autoStopEc2() {
  const now = Date.now()
  const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000

  const { Items } = await client.send(new ScanCommand({ TableName }))
  const running = (Items || []).map((i) => unmarshall(i)).filter(
    (t) => t.ec2State === 'running' && t.ec2InstanceId && t.ec2CreatedAt,
  )

  const stopped = []
  const errors = []

  for (const rec of running) {
    try {
      // ec2CreatedAt形式: "YYYY/MM/DD HH:MM" (JST) → UTC変換
      const parts = rec.ec2CreatedAt.split(' ')
      const [year, month, day] = parts[0].split('/').map(Number)
      const [hour, minute] = (parts[1] || '00:00').split(':').map(Number)
      const createdUtc = new Date(Date.UTC(year, month - 1, day, hour - 9, minute))
      const elapsed = now - createdUtc.getTime()

      if (elapsed < EIGHT_HOURS_MS) continue

      await ec2Client.send(new StopInstancesCommand({ InstanceIds: [rec.ec2InstanceId] }))

      await client.send(new UpdateItemCommand({
        TableName,
        Key: marshall({ traineeId: rec.traineeId }),
        UpdateExpression: 'SET ec2State = :state, updatedAt = :ts',
        ExpressionAttributeValues: marshall({ ':state': 'stopped', ':ts': new Date().toISOString() }),
      }))

      console.log(JSON.stringify({
        level: 'info',
        event: 'auto_stop',
        message: `[AutoStop] userId: ${rec.traineeId}, instanceId: ${rec.ec2InstanceId}, 起動時刻: ${rec.ec2CreatedAt}`,
        userId: rec.traineeId,
        instanceId: rec.ec2InstanceId,
        startedAt: rec.ec2CreatedAt,
        elapsedHours: Math.round(elapsed / (1000 * 60 * 60) * 10) / 10,
        timestamp: new Date().toISOString(),
      }))
      stopped.push({ traineeId: rec.traineeId, instanceId: rec.ec2InstanceId })
    } catch (err) {
      console.error(JSON.stringify({
        level: 'error',
        event: 'auto_stop_error',
        userId: rec.traineeId,
        instanceId: rec.ec2InstanceId,
        error: err.message,
        timestamp: new Date().toISOString(),
      }))
      errors.push({ traineeId: rec.traineeId, error: err.message })
    }
  }

  console.log(JSON.stringify({
    level: 'info',
    event: 'auto_stop_summary',
    checked: running.length,
    stopped: stopped.length,
    errors: errors.length,
    timestamp: new Date().toISOString(),
  }))

  return { ok: true, stopped: stopped.length, errors: errors.length }
}

async function handler(event) {
  // ============================================================
  // EventBridge Scheduler: autoStopEc2 ディスパッチ
  // ============================================================
  if (event.action === 'autoStopEc2') {
    return autoStopEc2()
  }

  // ============================================================
  // EventBridge: EC2 state-change イベント処理
  // ============================================================
  if (event.source === 'aws.ec2' && event['detail-type'] === 'EC2 Instance State-change Notification') {
    const instanceId = event.detail?.['instance-id']
    const state = event.detail?.state

    if (!instanceId || !state) {
      console.log(JSON.stringify({ level: 'warn', event: 'ec2_state_change_invalid', detail: event.detail, timestamp: new Date().toISOString() }))
      return { statusCode: 200, body: 'invalid event' }
    }

    console.log(JSON.stringify({ level: 'info', event: 'ec2_state_change_received', instanceId, state, timestamp: new Date().toISOString() }))

    // インスタンス情報とタグを取得
    const descRes = await ec2Client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }))
    const inst = descRes.Reservations?.[0]?.Instances?.[0]

    if (!inst) {
      console.log(JSON.stringify({ level: 'warn', event: 'ec2_state_change_not_found', instanceId, timestamp: new Date().toISOString() }))
      return { statusCode: 200, body: 'instance not found' }
    }

    // NIC管理のEC2か確認（Project=kira-project タグ）
    const tags = inst.Tags || []
    const isNicManaged = tags.some(t => t.Key === 'Project' && t.Value === 'kira-project')
    if (!isNicManaged) {
      console.log(JSON.stringify({ level: 'info', event: 'ec2_state_change_skipped', instanceId, state, reason: 'not_nic_managed', timestamp: new Date().toISOString() }))
      return { statusCode: 200, body: 'not nic managed' }
    }

    // DynamoDB で該当ユーザーを検索（ec2InstanceId で照合）
    const scanRes = await client.send(new ScanCommand({
      TableName,
      FilterExpression: 'ec2InstanceId = :iid',
      ExpressionAttributeValues: marshall({ ':iid': instanceId }),
    }))

    if (!scanRes.Items || scanRes.Items.length === 0) {
      console.log(JSON.stringify({ level: 'warn', event: 'ec2_state_change_no_user', instanceId, state, timestamp: new Date().toISOString() }))
      return { statusCode: 200, body: 'no user found in dynamo' }
    }

    for (const item of scanRes.Items) {
      const record = unmarshall(item)

      if (state === 'running') {
        // 起動時: 新IPを取得してec2PublicIp/ec2Host/ec2Stateを更新
        let newIp = inst.PublicIpAddress || null
        // running直後はIPが未割り当ての場合があるため最大2回リトライ（3秒間隔）
        if (!newIp) {
          for (let i = 0; i < 2; i++) {
            await new Promise(r => setTimeout(r, 3000))
            const retryRes = await ec2Client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }))
            newIp = retryRes.Reservations?.[0]?.Instances?.[0]?.PublicIpAddress || null
            if (newIp) break
          }
        }

        if (!newIp) {
          console.log(JSON.stringify({ level: 'warn', event: 'ec2_ip_update_no_ip', instanceId, traineeId: record.traineeId, timestamp: new Date().toISOString() }))
          // IPなしでもstateだけ更新
          await client.send(new UpdateItemCommand({
            TableName,
            Key: marshall({ traineeId: record.traineeId }),
            UpdateExpression: 'SET ec2State = :state, updatedAt = :ts',
            ExpressionAttributeValues: marshall({ ':state': 'running', ':ts': new Date().toISOString() }),
          }))
          continue
        }

        await client.send(new UpdateItemCommand({
          TableName,
          Key: marshall({ traineeId: record.traineeId }),
          UpdateExpression: 'SET ec2PublicIp = :ip, ec2Host = :ip, ec2State = :state, updatedAt = :ts',
          ExpressionAttributeValues: marshall({ ':ip': newIp, ':state': 'running', ':ts': new Date().toISOString() }),
        }))
        console.log(JSON.stringify({ level: 'info', event: 'ec2_ip_auto_updated', traineeId: record.traineeId, instanceId, newIp, timestamp: new Date().toISOString() }))
      }

      if (state === 'stopped') {
        // 停止時: ec2Stateをstoppedに更新（IPは保持 — UIで停止中バッジが出るため混乱なし）
        await client.send(new UpdateItemCommand({
          TableName,
          Key: marshall({ traineeId: record.traineeId }),
          UpdateExpression: 'SET ec2State = :state, updatedAt = :ts',
          ExpressionAttributeValues: marshall({ ':state': 'stopped', ':ts': new Date().toISOString() }),
        }))
        console.log(JSON.stringify({ level: 'info', event: 'ec2_state_auto_updated', traineeId: record.traineeId, instanceId, state: 'stopped', timestamp: new Date().toISOString() }))
      }

      if (state === 'terminated' || state === 'shutting-down') {
        // 削除時: ec2State/ec2InstanceId/ec2PublicIp/ec2Hostをクリア
        await client.send(new UpdateItemCommand({
          TableName,
          Key: marshall({ traineeId: record.traineeId }),
          UpdateExpression: 'SET ec2State = :state, updatedAt = :ts REMOVE ec2InstanceId, ec2PublicIp, ec2Host',
          ExpressionAttributeValues: marshall({ ':state': 'terminated', ':ts': new Date().toISOString() }),
        }))
        console.log(JSON.stringify({ level: 'info', event: 'ec2_terminated_cleared', traineeId: record.traineeId, instanceId, state, timestamp: new Date().toISOString() }))
      }
    }

    return { statusCode: 200, body: 'ok' }
  }

  // HTTP API Gateway リクエスト処理
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
        l1SavedQueueIdx: typeof body.l1SavedQueueIdx === 'number' ? body.l1SavedQueueIdx : undefined,
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
        // IT業界の歩き方: カテゴリIDごとのテスト合格状態
        itBasicsProgress: (body.itBasicsProgress && typeof body.itBasicsProgress === 'object' && !Array.isArray(body.itBasicsProgress)) ? body.itBasicsProgress : undefined,
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
        const retryable = err.name === 'ServiceUnavailableException' || err.name === 'ThrottlingException' || err.name === 'ModelNotReadyException' || err.$metadata?.httpStatusCode === 503 || err.$metadata?.httpStatusCode === 429
        console.log(JSON.stringify({
          level: 'error',
          event: 'ai_score_error',
          username: session.username,
          error_name: err.name,
          error_message: err.message,
          model_id: 'apac.anthropic.claude-sonnet-4-20250514-v1:0',
          http_status: err.$metadata?.httpStatusCode,
          retryable,
          timestamp: new Date().toISOString(),
        }))
        if (retryable) {
          return json({ error: 'AIサービスが混雑しています。しばらく待ってから再試行してください。' }, 503)
        }
        return json({ error: '採点処理でエラーが発生しました', detail: String(err.message || err) }, 500)
      }
    }

    // AI会話ログ保存（POST /ai/chat-log）
    if (method === 'POST' && (path === '/ai/chat-log' || path === '/ai/chat-log/')) {
      const session = await verifySession(event)
      if (!session) return json({ error: 'unauthorized' }, 401)

      let body
      try { body = JSON.parse(event.body || '{}') } catch { body = {} }
      const { userId, role, content, contextPage, isCorrect } = body

      if (!userId || !role || !content) return json({ error: 'userId, role, content are required' }, 400)
      if (!['user', 'assistant'].includes(role)) return json({ error: 'invalid role' }, 400)
      // 自分のログのみ書き込み可能
      if (userId !== session.username) return json({ error: 'forbidden' }, 403)
      if (!AiChatHistoryTableName) return json({ error: 'table not configured' }, 500)

      const messageId = generateULID()
      const createdAt = new Date().toISOString()
      const item = { userId, messageId, role, content, createdAt }
      if (contextPage) item.contextPage = contextPage
      if (isCorrect !== undefined && isCorrect !== null) item.isCorrect = isCorrect

      await client.send(new PutItemCommand({
        TableName: AiChatHistoryTableName,
        Item: marshall(item, { removeUndefinedValues: true }),
      }))
      return json({ ok: true, messageId })
    }

    // AI会話ログ取得（GET /ai/chat-log）
    if (method === 'GET' && (path === '/ai/chat-log' || path === '/ai/chat-log/')) {
      const session = await verifySession(event)
      if (!session) return json({ error: 'unauthorized' }, 401)

      const userId = event.queryStringParameters?.userId
      const limit = Math.min(parseInt(event.queryStringParameters?.limit || '50', 10), 100)

      if (!userId) return json({ error: 'userId is required' }, 400)
      // 自分のログのみ取得可能（manager は将来拡張で対応）
      if (userId !== session.username) return json({ error: 'forbidden' }, 403)
      if (!AiChatHistoryTableName) return json({ messages: [] })

      const { Items } = await client.send(new QueryCommand({
        TableName: AiChatHistoryTableName,
        IndexName: 'createdAt-index',
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: marshall({ ':uid': userId }),
        ScanIndexForward: false, // 新しい順
        Limit: limit,
      }))

      const messages = (Items || []).map((item) => {
        const m = unmarshall(item)
        return {
          messageId: m.messageId,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
          ...(m.contextPage ? { contextPage: m.contextPage } : {}),
        }
      })
      return json({ messages })
    }

    // AIチャット（メンター）プロキシ（AWS Bedrock Claude）
    if (method === 'POST' && (path === '/ai/chat' || path === '/ai/chat/')) {
      const session = await verifySession(event)
      if (!session) return json({ error: 'unauthorized' }, 401)

      let body
      try { body = JSON.parse(event.body || '{}') } catch { body = {} }
      const { message, history, context, image, currentQuestion, studentAnswer, isCorrect } = body
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

      const systemPrompt = `あなたはNIC（Neos IT College）のAI講師です。
シニアエンジニアの先輩として、研修生がインフラエンジニアとして独り立ちできるよう協調的なトーンで導いてください。

【絶対禁止】
- 「良い質問ですね」「素晴らしい」「いいですね」「さすがです」等の称賛・褒め言葉で文を始めること（どんな状況でも禁止）
- コマンド名の頭文字・部分文字列をヒントとして出すこと（例：「ch で始まります」「ls の仲間です」等は禁止）
- 研修生がサーバーにログインできている前提で手順を話すこと（接続状況が不明な場合は必ず確認する）
- 「〜の結果を教えてください」「一緒に確認しましょう」「一緒に見ていきましょう」「結果を見せてください」等、作業報告を求めるフレーズ（どんな状況でも禁止）
- 「演習サーバーにログインした状態で〜を実行してください」等、コマンド実行を直接促す表現（研修生がサーバーにアクセスできる前提で話すことを禁止）
- 3文以上の応答。必ず2文以内で完結させること。

【返答スタイル・最重要】
- コードブロック・箇条書き・表は使わない
- マークダウン記法は使わない
- 必ず2文以内で完結させる。3文以上は絶対禁止。
- 基本テンプレート（この2文形式を守ること）：
  「〇〇という操作には専用のコマンドがあります。『Linux △△ コマンド』で検索すると実例付きの解説が見つかります。」
- 研修生に「結果を教えてください」「一緒に〜」等の追加アクションを促す文を末尾に付けない

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

【AI講師ルール・絶対遵守】

【最重要ルール: man を最初の手段にしない】
man コマンドは「最後の補足」として回答末尾に置くことはできるが、回答の最初に持ってくることを禁止する。
最初に提示するのは「具体的なコマンド例」または「具体的な検索キーワード」であること。

【実行場所の明示・絶対遵守】
コマンド実行を促す時は必ず「演習サーバーにログインした状態で」と前置きすること。
初回または接続状況が不明な場合は「ダッシュボードの『あなたの演習サーバー』から接続してから試してみましょう」と案内する。
SSH接続方法が分からない様子であれば「まずダッシュボードに戻って演習サーバーが起動しているか確認してください。起動していたら ssh ユーザー名@IPアドレス -i PEMファイル で接続できます。接続できたら教えてください。接続方法が分からなくても大丈夫です、一緒にやりましょう」と案内する。

【「なぜ大丈夫か」の理由付き安心感・最重要】
研修生は未経験者で「間違えたら壊れるんじゃないか」という不安を抱えている。
「安心してください」「大丈夫です」だけで理由がない回答は禁止。必ず「なぜ問題ないか」の具体的理由を添えること。

コマンドの種類別に以下の理由を必ず添える：
- 参照系（ls, ps, cat, grep, find, df, ss, whoami, id等）：「このコマンドは情報を表示するだけなので実行しても問題ありません」
- 変更系（chmod, chown, mkdir, touch, mv, cp等）：「このコマンドはファイルの設定を変更しますが、演習サーバーは練習専用なので実行しても問題ありません」
- 破壊系（rm, systemctl stop, kill等）：「このコマンドはファイルを削除しますが、演習サーバーは再作成できるので実行しても問題ありません」
- パッケージ操作（dnf install, dnf remove等）：「このコマンドはソフトウェアをインストールしますが、演習サーバーへの追加なので実行しても問題ありません」
- 設定変更（viで設定ファイル編集、firewall-cmd等）：「このコマンドはサーバーの設定を変更しますが、演習サーバーは練習専用なので実行しても問題ありません。設定を戻したくなったら一緒に手順を確認しましょう」

【エラー報告への対応・絶対遵守】
研修生がエラーを報告してきた場合：
- まず「エラーが出るのは普通のことです。プロのエンジニアでも毎日エラーと向き合っています」と受け止める
- 「エラーメッセージの中にヒントがあります。一緒に読み解きましょう」と伝える
- 「間違っています」「違います」とは絶対に言わない
- 代わりに「惜しいです」「方向性は合っています」「もう少しです」を使う

【回答の構成（この順序を守ること）】
1. まず共感・受け止め（1文）
   「それは実務でもよく使います」「最初はそこで詰まる人が多いです」等
   ※「良い質問ですね」「素晴らしい」等の称賛フレーズは絶対使わない
2. 概念の説明（1〜2文）
   そのコマンド/技術が何をするものかを簡潔に説明。コマンドの完全な答えは教えない。
3. 具体的なヒント（核心、2〜3文）
   以下の両方を状況に応じて提示する：
   【ターミナルで調べる方法】
   「演習サーバーにログインした状態で コマンド --help を実行すると、オプション一覧が出ます」
   「演習サーバーにログインした状態で まずコマンドだけで実行してみてください」
   【ブラウザで検索する方法（実務で最も使う調べ方）】
   「『Linux ファイル 所有者 変更』で検索すると、実例付きの解説記事が見つかります」
   「『Rocky Linux httpd インストール 手順』で検索すると、ステップバイステップのガイドが見つかります」
   ターミナルとブラウザ検索の両方を提示するのが理想。研修生が「両方の調べ方を身につける」ことが目標。
4. 「なぜ大丈夫か」の理由（1文・必須）
   上記コマンド種別ルールに従い、理由を必ず添える。
5. 次の1アクション（1文）
   「まず〜を実行して、結果を教えてください。一緒に見ていきましょう」
6. 補足としてのman（任意、なくてもよい）
   「より詳しく知りたくなったら man コマンド名 も参考になります」
   → 回答の末尾にのみ置く。最初には絶対に置かない。

【禁止パターン（これらの回答を生成してはいけない）】
- 「良い質問ですね」「素晴らしい」「いいですね」「さすがです」で始まる回答
- コマンド名の頭文字・部分文字列をヒントにする回答（「ch で始まります」等）
- 「man XXX を実行してみてください」で始まる回答
- 「man XXX で調べましょう」で始まる回答
- manコマンドしか具体的な行動指示がない回答
- 「調べてみましょう」だけで具体的な調べ方がない回答
- 「〜の結果を教えてください」「一緒に確認しましょう」「一緒に見ていきましょう」を含む回答
- 「演習サーバーにログインした状態で〜を実行してください」等のコマンド実行を直接促す回答
- 「安心してください」「大丈夫です」だけで理由がない回答
- 「間違っています」「違います」という否定表現
- 3文以上の回答

【良い回答の例】
質問「psコマンドってなに」:
「psは現在動いているプロセス（実行中のプログラム）を表示するコマンドです。実務でもサーバーの状態確認によく使います。演習サーバーにログインした状態で ps aux | head と打ってみてください。このコマンドは情報を表示するだけなので実行しても問題ありません。USER, PID, %CPU, %MEM... と列が並んで今動いているプログラムの一覧が表示されますよ。また『Linux ps コマンド 使い方』でブラウザ検索すると、実例付きの解説が見つかります。結果を教えてください。一緒に見ていきましょう。」

質問「ファイルの所有者を変更するには？」:
「ファイルの所有者変更は、サーバー管理の基本操作ですね。演習サーバーにログインした状態で、まず ls -l を実行して対象ファイルの現在の所有者を確認してみましょう。このコマンドは情報を表示するだけなので実行しても問題ありません。所有者変更のコマンドは『Linux ファイル 所有者 変更 コマンド』でブラウザ検索すると実例付きの解説が見つかります。演習サーバーはファイルの設定を変更しても練習専用なので実行しても問題ありません。まず ls -l の結果を教えてください。一緒に進めましょう。」

質問「ファイルの権限を変更したいんだけど怖い」:
「その気持ち、よく分かります。最初は誰でもサーバーを触るのが怖いものです。権限変更のコマンドは chmod といいます。このコマンドはファイルの設定を変更しますが、演習サーバーは練習専用なので実行しても問題ありません。万が一おかしくなってもサーバーは再作成できます。演習サーバーにログインした状態で、まず ls -l で対象ファイルの現在の権限を確認してみましょう。このコマンドは情報を表示するだけなので実行しても問題ありません。『Linux chmod 使い方 初心者』でブラウザ検索すると図解付きで分かりやすい記事が見つかりますよ。ls -l の結果を教えてください。一緒に読み解きましょう。」

質問「コマンド打ったらPermission deniedって出た」:
「エラーが出るのは普通のことです。プロのエンジニアでも毎日エラーと向き合っています。Permission denied は『権限がない』という意味です。つまりコマンド自体は正しいけど、実行する権限が足りない状態です。方向性は合っていますよ。この場合、コマンドの先頭に sudo をつけると管理者権限で実行できます。sudo をつけてもサーバーが壊れることはないので実行しても問題ありません。演習サーバーにログインした状態で、先頭に sudo をつけて実行してみてください。結果を教えてもらえれば一緒に確認しましょう。」

質問「httpdをインストールするには？」:
「Rocky Linux では dnf というパッケージ管理コマンドを使います。演習サーバーにログインした状態で dnf search httpd と打ってみてください。インストール可能なhttpd関連パッケージの一覧が表示されます。このコマンドは情報を表示するだけなので実行しても問題ありません。また『Rocky Linux dnf パッケージ インストール 方法』で検索すると、手順が画像付きで解説されている記事が見つかります。dnf search httpd の結果を教えてください。一緒に見ていきましょう。」

■ 2回目以降（同じ内容が繰り返された場合）
コマンドカテゴリや操作の方向性を教え、具体的な検索コマンドとブラウザ検索キーワードを示す。

■ 明らかに詰まり切っている場合（3回以上同じ内容、または強い困惑が明確）
コマンド名だけ教える（オプション・使い方は自分で調べさせる）。
--help オプションとブラウザ検索キーワードを必ず添える。manコマンドのみで終わることは禁止。

現在の課題コンテキスト: ${context ?? '不明'}

【現在の問題】
${currentQuestion ?? '（問題情報なし）'}

【研修生の回答】
${studentAnswer ? studentAnswer : '（未回答）'}

【採点結果】
${isCorrect === true ? '正解済み。この問題は解決しています。発展的な話題や関連知識を提供してください。' : isCorrect === false ? '不正解。答えは絶対に言わず、ヒントと調べ方を提示してください。' : '未採点。問題への取り組みをサポートしてください。'}

返答は必ず2文以内に収めること。3文以上は絶対禁止。`

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
        const retryable = err.name === 'ServiceUnavailableException' || err.name === 'ThrottlingException' || err.name === 'ModelNotReadyException' || err.$metadata?.httpStatusCode === 503 || err.$metadata?.httpStatusCode === 429
        console.log(JSON.stringify({
          level: 'error',
          event: 'ai_chat_error',
          username: session.username,
          error_name: err.name,
          error_message: err.message,
          model_id: 'apac.anthropic.claude-sonnet-4-20250514-v1:0',
          http_status: err.$metadata?.httpStatusCode,
          retryable,
          timestamp: new Date().toISOString(),
        }))
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
      // accounts テーブルから termsAgreedAt / termsVersion / accountType を取得
      let termsAgreedAt = null
      let termsVersion = null
      let accountType = 'individual'
      if (AccountsTableName && session.username) {
        const accRes = await client.send(new GetItemCommand({
          TableName: AccountsTableName,
          Key: marshall({ username: session.username }),
        }))
        if (accRes.Item) {
          const acc = unmarshall(accRes.Item)
          termsAgreedAt = acc.termsAgreedAt || null
          termsVersion = acc.termsVersion || null
          accountType = acc.accountType || 'individual'
        }
      }
      return json({ username: session.username, role: session.role || 'student', termsAgreedAt, termsVersion, accountType })
    }

    // 利用規約同意（POST /terms/agree）
    if (method === 'POST' && (path === '/terms/agree' || path === '/terms/agree/')) {
      const session = await verifySession(event)
      if (!session) return json({ error: 'unauthorized' }, 401)
      if (!AccountsTableName) return json({ error: 'server error' }, 500)

      const now = new Date().toISOString()
      const version = '1.0'
      const ip = event.requestContext?.http?.sourceIp || ''
      await client.send(new UpdateItemCommand({
        TableName: AccountsTableName,
        Key: marshall({ username: session.username }),
        UpdateExpression: 'SET termsAgreedAt = :t, termsVersion = :v, termsAgreedIp = :ip',
        ExpressionAttributeValues: marshall({ ':t': now, ':v': version, ':ip': ip }),
      }))
      return json({ ok: true, termsAgreedAt: now, termsVersion: version })
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

    // 研修生 AI 会話ログ取得（GET /admin/ai-chat-log）- managerのみ
    if (method === 'GET' && (path === '/admin/ai-chat-log' || path === '/admin/ai-chat-log/')) {
      const session = await verifySession(event)
      if (!session) return json({ error: 'unauthorized' }, 401)
      const role = await getSessionRole(session)
      if (role !== 'manager') return json({ error: 'forbidden' }, 403)

      const userId = event.queryStringParameters?.userId
      const limit = Math.min(parseInt(event.queryStringParameters?.limit || '100', 10), 100)
      const from = event.queryStringParameters?.from   // ISO 日付（例: 2026-04-01）
      const to = event.queryStringParameters?.to       // ISO 日付（例: 2026-04-30）

      if (!userId) return json({ error: 'userId is required' }, 400)
      if (!AiChatHistoryTableName) return json({ messages: [] })

      // GSI createdAt-index で取得（新しい順）
      const queryParams = {
        TableName: AiChatHistoryTableName,
        IndexName: 'createdAt-index',
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: marshall({ ':uid': userId }),
        ScanIndexForward: false,
        Limit: limit,
      }
      // from/to フィルタ
      if (from && to) {
        queryParams.KeyConditionExpression += ' AND createdAt BETWEEN :from AND :to'
        queryParams.ExpressionAttributeValues = marshall({ ':uid': userId, ':from': from, ':to': to + 'T23:59:59.999Z' })
      } else if (from) {
        queryParams.KeyConditionExpression += ' AND createdAt >= :from'
        queryParams.ExpressionAttributeValues = marshall({ ':uid': userId, ':from': from })
      } else if (to) {
        queryParams.KeyConditionExpression += ' AND createdAt <= :to'
        queryParams.ExpressionAttributeValues = marshall({ ':uid': userId, ':to': to + 'T23:59:59.999Z' })
      }

      const { Items } = await client.send(new QueryCommand(queryParams))
      const messages = (Items || []).map((item) => {
        const m = unmarshall(item)
        return {
          messageId: m.messageId,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
          ...(m.contextPage ? { contextPage: m.contextPage } : {}),
        }
      })
      return json({ messages })
    }

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
            wbsPercent: calcWbsPercent(p),
            currentChapter: getCurrentChapterLabel(p),
            lastActive: p?.lastActive || null,
            lastLogin: p?.lastLoginAt || null,
            ec2State: p?.ec2State || null,
            ec2InstanceId: p?.ec2InstanceId || null,
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
            termsAgreedAt: a.termsAgreedAt || null,
            accountType: a.accountType || 'individual',
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
      const userAccountType = ['corporate', 'individual'].includes(body.accountType) ? body.accountType : 'individual'

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
        Item: marshall({ username, passwordHash, role: userRole, tenantId, accountType: userAccountType, createdAt: now }, { removeUndefinedValues: true }),
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

    // EC2インスタンスIDをIPアドレスから自動解決し、DynamoDBに書き戻す（自己修復）
    async function resolveEc2InstanceId(prog) {
      if (prog.ec2InstanceId) return prog   // 既知なので何もしない
      if (!prog.ec2PublicIp) return prog     // IPもなければ検索不可
      try {
        const searchRes = await ec2Client.send(new DescribeInstancesCommand({
          Filters: [{ Name: 'ip-address', Values: [prog.ec2PublicIp] }],
        }))
        const inst = searchRes.Reservations?.[0]?.Instances?.[0]
        if (inst?.InstanceId) {
          const updated = { ...prog, ec2InstanceId: inst.InstanceId, updatedAt: new Date().toISOString() }
          await client.send(new PutItemCommand({
            TableName,
            Item: marshall(updated, { removeUndefinedValues: true }),
          })).catch(() => {})
          console.log(JSON.stringify({ level: 'info', event: 'ec2_instance_id_recovered', traineeId: prog.traineeId, instanceId: inst.InstanceId, ip: prog.ec2PublicIp, timestamp: new Date().toISOString() }))
          return updated
        }
      } catch (e) {
        console.warn('[resolveEc2InstanceId] DescribeInstances(filter)失敗:', e.message)
      }
      return prog
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
        // カリキュラム必須パッケージをインストール
        'apt-get update -y',
        'DEBIAN_FRONTEND=noninteractive apt-get install -y ufw dnsutils lvm2',
        'ufw --force enable',
        // 受講生ユーザー作成
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

    // EC2実ステータス取得（GET /server/status）
    if (method === 'GET' && (path === '/server/status' || path === '/server/status/')) {
      const session = await verifySession(event)
      if (!session) return json({ error: 'unauthorized' }, 401)
      const { username } = session

      const progRes = await client.send(new GetItemCommand({ TableName, Key: marshall({ traineeId: username }) }))
      let prog = progRes.Item ? unmarshall(progRes.Item) : null
      // ec2InstanceIdが未設定でもIPがあれば自動解決を試みる
      if (prog && !prog.ec2InstanceId && prog.ec2PublicIp) {
        prog = await resolveEc2InstanceId(prog)
      }
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

      return json({ ok: true, status: realState, publicIp, instanceId: prog.ec2InstanceId })
    }

    // EC2停止（POST /server/stop）
    if (method === 'POST' && (path === '/server/stop' || path === '/server/stop/')) {
      const session = await verifySession(event)
      if (!session) return json({ error: 'unauthorized' }, 401)
      const { username } = session

      const progRes = await client.send(new GetItemCommand({ TableName, Key: marshall({ traineeId: username }) }))
      let prog = progRes.Item ? unmarshall(progRes.Item) : null
      if (prog && !prog.ec2InstanceId && prog.ec2PublicIp) prog = await resolveEc2InstanceId(prog)
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
      let prog = progRes.Item ? unmarshall(progRes.Item) : null
      if (prog && !prog.ec2InstanceId && prog.ec2PublicIp) prog = await resolveEc2InstanceId(prog)
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
      // 再起動時にec2CreatedAtをリセット（8時間タイマーの起点を現在時刻に更新）
      const ec2CreatedAt = `${jst.getUTCFullYear()}/${pad(jst.getUTCMonth() + 1)}/${pad(jst.getUTCDate())} ${ec2StartTime}`

      const updated = { ...prog, ec2State: 'pending', ec2StartTime, ec2CreatedAt, updatedAt: new Date().toISOString() }
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
