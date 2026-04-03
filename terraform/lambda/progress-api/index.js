const { DynamoDBClient, PutItemCommand, ScanCommand, GetItemCommand, DeleteItemCommand } = require('@aws-sdk/client-dynamodb')
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const crypto = require('crypto')

const client = new DynamoDBClient({})
const TableName = process.env.TABLE_NAME
const AccountsTableName = process.env.ACCOUNTS_TABLE_NAME
const SessionsTableName = process.env.SESSIONS_TABLE_NAME || ''
const AdminPassword = process.env.ADMIN_PASSWORD || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
}

function json(body, status = 200) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    body: JSON.stringify(body),
  }
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
        // 導入課題 中断・再開
        introStep: typeof body.introStep === 'number' ? body.introStep : 1,
        introRiskAnswers: body.introRiskAnswers && typeof body.introRiskAnswers === 'object' ? body.introRiskAnswers : {},
      }
      await client.send(new PutItemCommand({ TableName, Item: marshall(Item, { removeUndefinedValues: true }) }))
      return json({ ok: true })
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
      if (username === 'admin') {
        ok = AdminPassword && password === AdminPassword
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
      // admin はコード内特別扱いとし、DB には登録しない
      if (username === 'admin') {
        return json({ ok: true })
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
