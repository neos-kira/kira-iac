const { DynamoDBClient, PutItemCommand, ScanCommand, GetItemCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb')
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime')
const bedrockClient = new BedrockRuntimeClient({ region: 'ap-northeast-1' })
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const crypto = require('crypto')

const client = new DynamoDBClient({})
const TableName = process.env.TABLE_NAME
const AccountsTableName = process.env.ACCOUNTS_TABLE_NAME
const SessionsTableName = process.env.SESSIONS_TABLE_NAME || ''
const AdminPassword = process.env.ADMIN_PASSWORD || ''

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
      if (!traineeId || traineeId === 'admin') {
        return json({ error: 'invalid traineeId' }, 400)
      }
      // admin以外は自分のデータのみ更新可能
      if (session.username !== 'admin' && traineeId !== session.username) {
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

      const systemPrompt = `あなたはITインフラ研修の講師です。受講生の記述式回答を採点してください。

【採点基準】
pass（理解できています）:
- 問われている概念を正しく理解し、自分の言葉で説明できている
- キーワードの羅列ではなく、因果関係や理由が含まれている

partial（もう少しです）:
- 方向性は合っているが説明が不十分、または一部が間違っている
- キーワードは含まれているが説明になっていない

fail（再挑戦してください）:
- 意味不明な文字列・記号の羅列
- 設問と全く無関係な回答
- 未回答・空欄に近い内容

【出力形式】
必ず以下のJSON形式のみで返すこと。前置き・後置き・マークダウン不要：
{
  "rating": "pass" | "partial" | "fail",
  "comment": "良かった点または問題点を1〜2文で具体的に",
  "advice": "次のステップまたは改善点を1文で"
}`

      const userPrompt = `問題: ${question}
基準: ${scoringCriteria}
回答: ${answer}`

      try {
        const command = new InvokeModelCommand({
          modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 300,
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
        // 後方互換: pass/feedback も返す（IntroPage等で使用）
        return json({ rating, comment, advice, pass: rating === 'pass', feedback: comment })
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

      const systemPrompt = `あなたはNIC（Neos IT College）のAI講師です。

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
研修内容の質問には5行以内で端的に回答。
システム操作（保存・中断等）：「その操作は画面上のボタンから行ってください。」
幕末・研修以外の雑談：「研修に関すること以外はお答えできません。わからないことがあれば聞いてください。」

【研修問題への回答禁止ルール】
研修生が現在取り組んでいる問題の答えを直接教えてはいけない。
「〇〇するには？」「〇〇のコマンドは？」という質問に対しては答えを直接提示せず、以下の形式でヒントのみ提供する：
- 「どのコマンドを使うか」のカテゴリだけ教える
- 「man コマンド名」や「--help」で調べる方法を案内する
- 「どこで詰まっていますか？」と確認する
答えを直接教えることは研修生の学習を妨げるため絶対に禁止する。

現在の課題コンテキスト: ${context ?? '不明'}`

      // history を直近10メッセージ（往復5回分）に制限し、user/assistant のみ通す
      const safeHistory = Array.isArray(history)
        ? history
            .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
            .slice(-10)
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
          modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
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
      // admin以外は自分のデータのみ返す
      if (session.username !== 'admin') {
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

    // アカウント作成（admin 画面用）
    if (method === 'POST' && (path === '/accounts' || path === '/accounts/')) {
      const body = JSON.parse(event.body || '{}')
      const username = (body.username || '').trim().toLowerCase()
      if (!username || username === 'admin') {
        return json({ error: 'invalid username' }, 400)
      }
      const password = typeof body.password === 'string' ? body.password : ''
      if (!password) {
        return json({ error: 'invalid password' }, 400)
      }
      const passwordHash = crypto.createHash('sha256').update(password).digest('hex')
      const Item = {
        username,
        passwordHash,
        createdAt: new Date().toISOString(),
      }
      await client.send(
        new PutItemCommand({
          TableName: AccountsTableName,
          Item: marshall(Item, { removeUndefinedValues: true }),
        }),
      )
      return json({ ok: true })
    }

    // アカウント一覧取得（admin 画面用）
    if (method === 'GET' && (path === '/accounts' || path === '/accounts/')) {
      const { Items } = await client.send(new ScanCommand({ TableName: AccountsTableName }))
      const accounts = (Items || []).map((item) => unmarshall(item))
      return json({ accounts })
    }

    // パスワードリセット（admin 用）
    if (method === 'PUT' && (path === '/accounts/password' || path === '/accounts/password/')) {
      const body = JSON.parse(event.body || '{}')
      const username = (body.username || '').trim().toLowerCase()
      const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
      if (!username || username === 'admin' || !newPassword) {
        return json({ error: 'invalid username or password' }, 400)
      }
      const existing = await client.send(
        new GetItemCommand({
          TableName: AccountsTableName,
          Key: marshall({ username }),
        }),
      )
      if (!existing.Item) {
        return json({ error: 'user not found' }, 404)
      }
      const passwordHash = crypto.createHash('sha256').update(newPassword).digest('hex')
      await client.send(
        new PutItemCommand({
          TableName: AccountsTableName,
          Item: marshall(
            { ...unmarshall(existing.Item), passwordHash },
            { removeUndefinedValues: true },
          ),
        }),
      )
      return json({ ok: true })
    }

    // アカウント削除（admin 用）
    if (method === 'DELETE' && (path === '/accounts' || path === '/accounts/')) {
      const body = JSON.parse(event.body || '{}')
      const username = (body.username || '').trim().toLowerCase()
      if (!username || username === 'admin') {
        return json({ error: 'invalid username' }, 400)
      }
      await client.send(
        new DeleteItemCommand({
          TableName: AccountsTableName,
          Key: marshall({ username }),
        }),
      )
      return json({ ok: true })
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
      if (username === 'admin' && AdminPassword) {
        ok = password === AdminPassword
      } else {
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
        }
      }
      if (!ok) {
        return json({ error: 'unauthorized' }, 401)
      }
      if (!SessionsTableName) {
        return json({ ok: true, username })
      }
      const sessionId = crypto.randomBytes(24).toString('hex')
      const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60
      await client.send(
        new PutItemCommand({
          TableName: SessionsTableName,
          Item: marshall({
            sessionId,
            username,
            expiresAt,
          }, { removeUndefinedValues: true }),
        }),
      )
      return json({ ok: true, username, token: sessionId })
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
      return json({ username: session.username })
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

    return json({ error: 'not found' }, 404)
  } catch (err) {
    console.error(err)
    return json({ error: 'internal error' }, 500)
  }
}

module.exports = { handler }
