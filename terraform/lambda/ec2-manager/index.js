/**
 * EC2インスタンス管理Lambda
 * エンドポイント: POST /ec2/create, POST /ec2/start, POST /ec2/stop, GET /ec2/status
 *
 * 環境変数:
 *   SECURITY_GROUP_ID  - EC2に付与するセキュリティグループID
 *   SUBNET_ID          - 起動するサブネットID
 *   KEY_PAIR_NAME      - EC2キーペア名（デフォルト: nic-trainee-key）
 */

const {
  EC2Client,
  RunInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  DescribeInstancesCommand,
  DescribeImagesCommand,
} = require('@aws-sdk/client-ec2')
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb')

const ec2 = new EC2Client({ region: 'ap-northeast-1' })
const dynamoClient = new DynamoDBClient({ region: 'ap-northeast-1' })
const docClient = DynamoDBDocumentClient.from(dynamoClient)

const PROGRESS_TABLE = process.env.TABLE_NAME || 'kira-project-dev-progress'
const SECURITY_GROUP_ID = process.env.SECURITY_GROUP_ID
const SUBNET_ID = process.env.SUBNET_ID
const KEY_PAIR_NAME = process.env.KEY_PAIR_NAME || 'nic-trainee-key'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function respond(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', ...corsHeaders }, body: JSON.stringify(body) }
}

/** Rocky Linux 8 の最新 AMI を取得 */
async function getRockyLinuxAMI() {
  const res = await ec2.send(new DescribeImagesCommand({
    Owners: ['679593333241'],
    Filters: [
      { Name: 'name', Values: ['Rocky-8-EC2-Base-8.*'] },
      { Name: 'state', Values: ['available'] },
      { Name: 'architecture', Values: ['x86_64'] },
    ],
  }))
  const sorted = (res.Images || []).sort((a, b) => new Date(b.CreationDate) - new Date(a.CreationDate))
  return sorted[0]?.ImageId ?? null
}

/** ユーザーの EC2 インスタンスを検索（running/stopped 含む、terminated 除く） */
async function findInstance(userId) {
  const res = await ec2.send(new DescribeInstancesCommand({
    Filters: [
      { Name: 'tag:NicUserId', Values: [userId] },
      { Name: 'tag:Project', Values: ['nic-training'] },
      { Name: 'instance-state-name', Values: ['pending', 'running', 'stopping', 'stopped'] },
    ],
  }))
  const instances = (res.Reservations ?? []).flatMap((r) => r.Instances ?? [])
  return instances[0] ?? null
}

/** EC2 作成 */
async function createInstance(userId) {
  const existing = await findInstance(userId)
  if (existing) {
    return { success: true, instanceId: existing.InstanceId, message: '既存のインスタンスがあります', alreadyExists: true }
  }
  const amiId = await getRockyLinuxAMI()
  if (!amiId) throw new Error('Rocky Linux 8 AMI が見つかりません')

  const runParams = {
    ImageId: amiId,
    InstanceType: 't2.micro',
    MinCount: 1,
    MaxCount: 1,
    KeyName: KEY_PAIR_NAME,
    TagSpecifications: [{
      ResourceType: 'instance',
      Tags: [
        { Key: 'Name', Value: `nic-${userId}-server` },
        { Key: 'NicUserId', Value: userId },
        { Key: 'Project', Value: 'nic-training' },
      ],
    }],
  }
  if (SECURITY_GROUP_ID) runParams.SecurityGroupIds = [SECURITY_GROUP_ID]
  if (SUBNET_ID) runParams.SubnetId = SUBNET_ID

  const res = await ec2.send(new RunInstancesCommand(runParams))
  const instanceId = res.Instances[0].InstanceId

  // DynamoDB に保存
  await docClient.send(new PutCommand({
    TableName: PROGRESS_TABLE,
    Item: {
      traineeId: userId,
      ec2InstanceId: instanceId,
      ec2CreatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  }))

  return { success: true, instanceId, message: 'インスタンスを作成しました' }
}

/** EC2 起動 */
async function startInstance(userId) {
  const instance = await findInstance(userId)
  if (!instance) throw new Error('インスタンスが見つかりません')
  if (instance.State.Name === 'running') {
    return { success: true, message: '既に起動しています', publicIp: instance.PublicIpAddress ?? null }
  }
  await ec2.send(new StartInstancesCommand({ InstanceIds: [instance.InstanceId] }))
  return { success: true, instanceId: instance.InstanceId, message: '起動を開始しました' }
}

/** EC2 停止 */
async function stopInstance(userId) {
  const instance = await findInstance(userId)
  if (!instance) throw new Error('インスタンスが見つかりません')
  if (instance.State.Name === 'stopped') {
    return { success: true, message: '既に停止しています' }
  }
  await ec2.send(new StopInstancesCommand({ InstanceIds: [instance.InstanceId] }))
  return { success: true, instanceId: instance.InstanceId, message: '停止を開始しました' }
}

/** EC2 状態取得 */
async function getStatus(userId) {
  const instance = await findInstance(userId)
  if (!instance) return { success: true, status: 'not_created', message: 'インスタンスがありません' }
  return {
    success: true,
    status: instance.State.Name,
    instanceId: instance.InstanceId,
    publicIp: instance.PublicIpAddress ?? null,
    privateIp: instance.PrivateIpAddress ?? null,
  }
}

exports.handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET'

  if (method === 'OPTIONS') return respond(200, {})

  try {
    const path = event.path || event.rawPath || ''
    const bodyRaw = event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : '{}'
    const body = JSON.parse(bodyRaw)
    const userId = (body.userId || event.queryStringParameters?.userId || '').trim().toLowerCase()

    if (!userId) return respond(400, { success: false, error: 'userId が必要です' })

    if (path.endsWith('/create')) return respond(200, await createInstance(userId))
    if (path.endsWith('/start')) return respond(200, await startInstance(userId))
    if (path.endsWith('/stop')) return respond(200, await stopInstance(userId))
    if (path.endsWith('/status')) return respond(200, await getStatus(userId))

    return respond(404, { success: false, error: '不明なエンドポイントです' })
  } catch (err) {
    console.error('[ec2-manager] error:', err)
    return respond(500, { success: false, error: err.message })
  }
}
