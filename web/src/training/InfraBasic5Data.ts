/**
 * インフラ基礎課題5: サーバー構築（5フェーズ構成）
 * 5-1 パラメーターシート作成
 * 5-2 手順書作成
 * 5-3 サーバー構築実践（3問）
 * 5-4 トラブルシューティング（5問）
 * 5-5 セキュリティチェック（2問）
 */

const PREFIX = 'kira-infra-basic-5'

export const INFRA5_CLEARED_KEY = `${PREFIX}-all-cleared`
export const INFRA5_PHASE1_CLEARED_KEY = `${PREFIX}-phase1-cleared`
export const INFRA5_PHASE2_CLEARED_KEY = `${PREFIX}-phase2-cleared`
export const INFRA5_PHASE3_CLEARED_KEY = `${PREFIX}-phase3-cleared`
export const INFRA5_PHASE4_CLEARED_KEY = `${PREFIX}-phase4-cleared`
export const INFRA5_PHASE5_CLEARED_KEY = `${PREFIX}-phase5-cleared`

export const PHASE_CLEARED_KEYS = [
  INFRA5_PHASE1_CLEARED_KEY,
  INFRA5_PHASE2_CLEARED_KEY,
  INFRA5_PHASE3_CLEARED_KEY,
  INFRA5_PHASE4_CLEARED_KEY,
  INFRA5_PHASE5_CLEARED_KEY,
] as const

// --- 5-1 パラメーターシート ---

export type ParamField = {
  id: string
  label: string
  placeholder: string
  type: 'text' | 'password'
}

export const WEB_PARAMS: ParamField[] = [
  { id: 'webIp', label: 'WebサーバーIPアドレス', placeholder: '例: 10.0.1.10', type: 'text' },
  { id: 'webPort', label: 'Webサーバーポート番号', placeholder: '例: 80', type: 'text' },
  { id: 'webOs', label: 'OS', placeholder: '例: Amazon Linux 2023', type: 'text' },
]

export const DB_PARAMS: ParamField[] = [
  { id: 'dbIp', label: 'DBサーバーIPアドレス', placeholder: '例: 10.0.2.10', type: 'text' },
  { id: 'dbPort', label: 'DBサーバーポート番号', placeholder: '例: 3306', type: 'text' },
  { id: 'dbOs', label: 'OS', placeholder: '例: Amazon Linux 2023', type: 'text' },
  { id: 'dbName', label: 'DB名', placeholder: '例: myappdb', type: 'text' },
  { id: 'dbUser', label: 'DBユーザー名', placeholder: '例: appuser', type: 'text' },
  { id: 'dbPassword', label: 'DBパスワード', placeholder: '********', type: 'password' },
]

// --- 5-3 サーバー構築実践 ---

export type BuildQuestion = {
  q: number
  title: string
  task: string
  verify: string
  expected: string
}

export const BUILD_QUESTIONS: BuildQuestion[] = [
  {
    q: 1,
    title: 'Apacheインストール・起動',
    task: 'WebサーバーにApache（httpd）をインストールし、起動してください。systemctl status httpd の結果を貼り付けてください。',
    verify: 'systemctl status httpd の出力を貼り付けてください。',
    expected: 'httpd が active (running) であること。インストールと起動が正常に完了していること。',
  },
  {
    q: 2,
    title: 'MySQLインストール・起動',
    task: 'DBサーバーにMySQL（またはMariaDB）をインストールし、起動してください。systemctl status mysqld（またはmariadb）の結果を貼り付けてください。',
    verify: 'systemctl status mysqld（またはmariadb）の出力を貼り付けてください。',
    expected: 'mysqld または mariadb が active (running) であること。インストールと起動が正常に完了していること。',
  },
  {
    q: 3,
    title: 'curlでWebサーバーにアクセス',
    task: 'curl http://自分のWebサーバーIP を実行し、Apacheのデフォルトページが表示されることを確認してください。',
    verify: 'curl の実行結果を貼り付けてください。',
    expected: 'HTMLレスポンスが返却されていること。Apacheのテストページまたはデフォルトページの内容が含まれていること。',
  },
]

// --- 5-4 トラブルシューティング ---

export type TroubleQuestion = {
  q: number
  title: string
  scenario: string
  log: string
  verify: string
  expected: string
}

export const TROUBLE_QUESTIONS: TroubleQuestion[] = [
  {
    q: 1,
    title: 'Apacheが起動しない（ポート競合）',
    scenario: 'Apacheを起動しようとしたら以下のエラーが出ました。原因と対処法を答えてください。',
    log: `$ sudo systemctl start httpd
Job for httpd.service failed because the control process exited with error code.

$ sudo journalctl -u httpd --no-pager -n 20
-- Logs begin at ... --
httpd[1234]: (98)Address already in use: AH00072: make_sock: could not bind to address 0.0.0.0:80
httpd[1234]: no listening sockets available, shutting down
httpd[1234]: AH00015: Unable to open logs`,
    verify: '原因と対処法をテキストエリアに記述してください。',
    expected: 'ポート80が他のプロセスに使用されていることが原因であると特定し、ss -tlnp や lsof で競合プロセスを調べて停止する、またはApacheのListenポートを変更するなどの対処法を述べていること。',
  },
  {
    q: 2,
    title: 'MySQLに接続できない（bind-address）',
    scenario: 'WebサーバーからDBサーバーのMySQLに接続できません。以下のエラーが出ます。原因と対処法を答えてください。',
    log: `$ mysql -h 10.0.2.10 -u appuser -p
ERROR 2003 (HY000): Can't connect to MySQL server on '10.0.2.10:3306' (110)

$ sudo ss -tlnp | grep 3306
LISTEN  0  80  127.0.0.1:3306  0.0.0.0:*  users:(("mysqld",pid=5678,fd=22))`,
    verify: '原因と対処法をテキストエリアに記述してください。',
    expected: 'MySQLのbind-addressが127.0.0.1（localhost）に設定されているため外部から接続できないことが原因であると特定し、my.cnfのbind-addressを0.0.0.0またはDBサーバーのIPに変更してMySQLを再起動する対処法を述べていること。',
  },
  {
    q: 3,
    title: '外部からWebサーバーにアクセスできない（セキュリティグループ）',
    scenario: 'EC2上のApacheは起動していますが、ブラウザからアクセスできません。以下の状態です。原因と対処法を答えてください。',
    log: `$ systemctl status httpd
● httpd.service - The Apache HTTP Server
   Active: active (running)

$ curl http://localhost
<!DOCTYPE html>
<html>... Apache Test Page ...</html>

$ curl http://10.0.1.10 （別のEC2から）
curl: (7) Failed to connect to 10.0.1.10 port 80: Connection timed out

# セキュリティグループ（インバウンドルール）:
# ポート22 (SSH) - 0.0.0.0/0 ← 許可済み
# ポート80 (HTTP) - 設定なし`,
    verify: '原因と対処法をテキストエリアに記述してください。',
    expected: 'セキュリティグループのインバウンドルールでポート80（HTTP）が許可されていないことが原因であると特定し、AWSコンソールまたはCLIでセキュリティグループにHTTP（ポート80）のインバウンドルールを追加する対処法を述べていること。',
  },
  {
    q: 4,
    title: 'DBに接続できない（パスワード間違い）',
    scenario: 'MySQLに接続しようとすると以下のエラーが出ます。原因と対処法を答えてください。',
    log: `$ mysql -h 10.0.2.10 -u appuser -p
Enter password: ********
ERROR 1045 (28000): Access denied for user 'appuser'@'10.0.1.10' (using password: YES)`,
    verify: '原因と対処法をテキストエリアに記述してください。',
    expected: 'パスワードが間違っている、またはユーザーappuserに対してWebサーバーのIPからのアクセス権限が付与されていないことが原因であると特定し、パスワードの確認・再設定、またはGRANT文でユーザー権限を設定する対処法を述べていること。',
  },
  {
    q: 5,
    title: 'サーバーが重い（不要プロセスの暴走）',
    scenario: 'サーバーが非常に重くなっています。以下のtop出力を見て原因と対処法を答えてください。',
    log: `$ top
top - 14:23:01 up 2 days,  3:15,  1 user,  load average: 8.52, 7.91, 6.34
Tasks: 112 total,   2 running, 110 sleeping,   0 stopped,   0 zombie
%Cpu(s): 98.2 us,  1.3 sy,  0.0 ni,  0.0 id,  0.5 wa,  0.0 hi,  0.0 si,  0.0 st

  PID USER      PR  NI    VIRT    RES    SHR S  %CPU %MEM     TIME+ COMMAND
 9876 ec2-user  20   0  512340  48320   3200 R  97.3  4.8  45:12.34 stress
 1234 root      20   0  256120  12480   8960 S   0.7  1.2   2:34.56 httpd
    1 root      20   0  171820  11200   8320 S   0.0  1.1   0:05.23 systemd`,
    verify: '原因と対処法をテキストエリアに記述してください。',
    expected: 'PID 9876のstressプロセスがCPUを97.3%消費して暴走していることが原因であると特定し、kill 9876 または kill -9 9876 でプロセスを停止する対処法を述べていること。また、load averageが高いこと、us（ユーザープロセス）が98.2%であることからアプリ側の問題と判断できること。',
  },
]

// --- 5-5 セキュリティチェック ---

export type SecurityQuestion = {
  q: number
  title: string
  task: string
  verify: string
  expected: string
}

export const SECURITY_QUESTIONS: SecurityQuestion[] = [
  {
    q: 1,
    title: 'ポート確認（netstat）',
    task: 'WebサーバーまたはDBサーバーで netstat -tlnp（または ss -tlnp）を実行し、開いているポートを確認してください。不要なポートが開いていないかAIが確認します。',
    verify: 'netstat -tlnp または ss -tlnp の出力を貼り付けてください。',
    expected: '必要なポート（22, 80, 3306等）のみがLISTENしていること。不要なポートが開いている場合は指摘する。出力にLISTEN状態のポート一覧が含まれていること。',
  },
  {
    q: 2,
    title: 'SSH設定確認',
    task: 'cat /etc/ssh/sshd_config を実行し、SSH設定を確認してください。設定が安全かどうかAIが確認します。',
    verify: 'cat /etc/ssh/sshd_config の出力を貼り付けてください。',
    expected: 'sshd_configの内容が表示されていること。PermitRootLogin、PasswordAuthentication、Port等のセキュリティ関連設定が確認できること。理想的にはPermitRootLogin no、PasswordAuthentication noが設定されていること。',
  },
]
