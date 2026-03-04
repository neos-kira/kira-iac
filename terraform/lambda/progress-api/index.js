const { DynamoDBClient, PutItemCommand, ScanCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb')
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')

const client = new DynamoDBClient({})
const TableName = process.env.TABLE_NAME
const AccountsTableName = process.env.ACCOUNTS_TABLE_NAME

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
}

function json(body, status = 200) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    body: JSON.stringify(body),
  }
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
      const body = JSON.parse(event.body || '{}')
      const traineeId = (body.traineeId || '').trim().toLowerCase()
      if (!traineeId || traineeId === 'admin') {
        return json({ error: 'invalid traineeId' }, 400)
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
      }
      await client.send(new PutItemCommand({ TableName, Item: marshall(Item, { removeUndefinedValues: true }) }))
      return json({ ok: true })
    }

    // 全受講生の進捗取得
    if (method === 'GET' && (path === '/progress' || path === '/progress/')) {
      const { Items } = await client.send(new ScanCommand({ TableName }))
      const trainees = (Items || []).map((item) => unmarshall(item))
      return json({ trainees })
    }

    // アカウント作成（admin 画面用）
    if (method === 'POST' && (path === '/accounts' || path === '/accounts/')) {
      const body = JSON.parse(event.body || '{}')
      const username = (body.username || '').trim().toLowerCase()
      if (!username || username === 'admin') {
        return json({ error: 'invalid username' }, 400)
      }
      const Item = {
        username,
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

    // ログイン可否チェック（LoginPage 用）
    if (method === 'POST' && (path === '/auth/check' || path === '/auth/check/')) {
      const body = JSON.parse(event.body || '{}')
      const username = (body.username || '').trim().toLowerCase()
      if (!username) {
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
      const exists = !!res.Item
      return json({ ok: exists })
    }

    return json({ error: 'not found' }, 404)
  } catch (err) {
    console.error(err)
    return json({ error: 'internal error' }, 500)
  }
}

module.exports = { handler }
