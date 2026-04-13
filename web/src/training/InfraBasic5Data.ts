/**
 * インフラ基礎課題5: サーバー構築（40タスク・5セクション構成）
 * セクション1: OS設定（11項目）
 * セクション2: ディスク追加（6項目）
 * セクション3: httpd基本設定（7項目）
 * セクション4: 改ざん検知 AIDE（6項目）
 * セクション5: PostgreSQL基本設定（10項目）
 */

const PREFIX = 'kira-infra-basic-5'

// --- 既存エクスポート維持（trainingWbsData.ts / traineeProgressStorage.ts 依存） ---
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

// --- 新タスク構造 ---

export type Infra5Task = {
  id: string
  sectionId: string
  /** checkboxes 配列の 0 始まりインデックス */
  index: number
  /** 表示番号 e.g. "1-1" */
  number: string
  title: string
  objective: string
  hint?: string
  /** true の場合、AI採点テキストエリアを表示する */
  isReview?: boolean
  /** AI採点時の採点基準（理解度確認タスクのみ） */
  reviewCriteria?: string
}

export type Infra5Section = {
  id: string
  number: number
  title: string
  /** WBS進捗と連動するクリアキー */
  clearedKey: string
  tasks: Infra5Task[]
}

export const INFRA5_SECTIONS: Infra5Section[] = [
  {
    id: 's1',
    number: 1,
    title: 'OS設定',
    clearedKey: INFRA5_PHASE1_CLEARED_KEY,
    tasks: [
      {
        id: 's1-1', sectionId: 's1', index: 0, number: '1-1',
        title: 'リモートユーザー作成',
        objective: 'useradd・passwd コマンドでリモート作業用ユーザーを作成してください。',
        hint: 'useradd <username> && passwd <username>',
      },
      {
        id: 's1-2', sectionId: 's1', index: 1, number: '1-2',
        title: 'ホスト名設定',
        objective: 'hostnamectl コマンドでサーバーのホスト名を設定してください。',
        hint: 'hostnamectl set-hostname <hostname>',
      },
      {
        id: 's1-3', sectionId: 's1', index: 2, number: '1-3',
        title: 'ネットワーク設定確認',
        objective: 'ip a および nmcli コマンドでネットワーク設定を確認してください。',
        hint: 'ip a && nmcli device status',
      },
      {
        id: 's1-4', sectionId: 's1', index: 3, number: '1-4',
        title: '名前解決設定',
        objective: '/etc/resolv.conf を確認し、nslookup コマンドで名前解決が動作することを確認してください。',
        hint: 'cat /etc/resolv.conf && nslookup google.com',
      },
      {
        id: 's1-5', sectionId: 's1', index: 4, number: '1-5',
        title: '外部疎通確認',
        objective: 'ping google.com で外部への通信ができることを確認してください。',
        hint: 'ping -c 4 google.com',
      },
      {
        id: 's1-6', sectionId: 's1', index: 5, number: '1-6',
        title: 'SSH設定 - rootログイン禁止',
        objective: '/etc/ssh/sshd_config を編集し、PermitRootLogin を no に設定してください。設定後 sshd を再起動してください。',
        hint: 'sed -i "s/^#PermitRootLogin.*/PermitRootLogin no/" /etc/ssh/sshd_config && systemctl restart sshd',
      },
      {
        id: 's1-7', sectionId: 's1', index: 6, number: '1-7',
        title: 'コマンド履歴設定',
        objective: '~/.bashrc に HISTSIZE、HISTFILESIZE、HISTTIMEFORMAT を設定し、コマンド履歴に日時が記録されるようにしてください。',
        hint: 'HISTSIZE=10000、HISTFILESIZE=20000、HISTTIMEFORMAT="%Y/%m/%d %T " を .bashrc に追加',
      },
      {
        id: 's1-8', sectionId: 's1', index: 7, number: '1-8',
        title: 'firewalld停止',
        objective: 'firewalld を停止し、自動起動も無効化してください。',
        hint: 'systemctl disable --now firewalld',
      },
      {
        id: 's1-9', sectionId: 's1', index: 8, number: '1-9',
        title: 'SELinux停止',
        objective: '/etc/selinux/config を編集して SELINUX=disabled に設定してください（再起動後に反映されます）。',
        hint: 'setenforce 0 && sed -i "s/^SELINUX=.*/SELINUX=disabled/" /etc/selinux/config',
      },
      {
        id: 's1-10', sectionId: 's1', index: 9, number: '1-10',
        title: 'システム再起動',
        objective: 'SELinux の設定を反映させるためにサーバーを再起動してください。再起動後、getenforce コマンドで Disabled になっていることを確認してください。',
        hint: 'reboot → ログイン後 getenforce',
      },
      {
        id: 's1-11', sectionId: 's1', index: 10, number: '1-11',
        title: '【理解度確認】OS設定の手順書作成・提出',
        objective: 'セクション1で実施したOS設定の手順書を作成し、内容を記述してください。「何のために」「何をしたか」「確認コマンドと結果」の3点を含めてください。',
        isReview: true,
        reviewCriteria: 'OS設定（ユーザー作成、ホスト名、ネットワーク、SSH強化、firewalld/SELinux無効化）の各手順が網羅されていること。コマンドと確認方法が具体的に記載されていること。目的（なぜ実施するか）が説明されていること。',
      },
    ],
  },
  {
    id: 's2',
    number: 2,
    title: 'ディスク追加',
    clearedKey: INFRA5_PHASE2_CLEARED_KEY,
    tasks: [
      {
        id: 's2-1', sectionId: 's2', index: 11, number: '2-1',
        title: 'パーティション作成',
        objective: 'fdisk または parted コマンドで追加ディスクにパーティションを作成してください。',
        hint: 'fdisk /dev/xvdb → n（新規）→ 規定値で作成 → w（書き込み）',
      },
      {
        id: 's2-2', sectionId: 's2', index: 12, number: '2-2',
        title: 'PV作成',
        objective: 'pvcreate コマンドで Physical Volume を作成してください。',
        hint: 'pvcreate /dev/xvdb1',
      },
      {
        id: 's2-3', sectionId: 's2', index: 13, number: '2-3',
        title: 'VG作成',
        objective: 'vgcreate コマンドで Volume Group を作成してください。',
        hint: 'vgcreate vg_data /dev/xvdb1',
      },
      {
        id: 's2-4', sectionId: 's2', index: 14, number: '2-4',
        title: 'LV作成',
        objective: 'lvcreate コマンドで Logical Volume を作成してください。',
        hint: 'lvcreate -l 100%FREE -n lv_data vg_data',
      },
      {
        id: 's2-5', sectionId: 's2', index: 15, number: '2-5',
        title: 'マウント設定',
        objective: 'mkfs でフォーマット、mount でマウントし、/etc/fstab に永続化設定を追記してください。',
        hint: 'mkfs.xfs /dev/vg_data/lv_data && mkdir /data && mount /dev/vg_data/lv_data /data',
      },
      {
        id: 's2-6', sectionId: 's2', index: 16, number: '2-6',
        title: '【理解度確認】ディスク追加の手順書作成・提出',
        objective: 'セクション2で実施したディスク追加の手順書を作成し、内容を記述してください。LVM の仕組み（PV→VG→LV）の説明を含めてください。',
        isReview: true,
        reviewCriteria: 'LVMの概念（PV、VG、LV）が正しく説明されていること。パーティション作成からマウントまでの手順が順序通り記載されていること。fstab への永続化設定が含まれていること。確認コマンド（pvs、vgs、lvs、df -h）が記載されていること。',
      },
    ],
  },
  {
    id: 's3',
    number: 3,
    title: 'httpd基本設定',
    clearedKey: INFRA5_PHASE3_CLEARED_KEY,
    tasks: [
      {
        id: 's3-1', sectionId: 's3', index: 17, number: '3-1',
        title: 'httpdインストール',
        objective: 'dnf install httpd コマンドで Apache をインストールしてください。',
        hint: 'dnf install -y httpd',
      },
      {
        id: 's3-2', sectionId: 's3', index: 18, number: '3-2',
        title: 'httpd.conf設定',
        objective: '/etc/httpd/conf/httpd.conf を編集し、アクセスログ・エラーログの形式を確認・変更してください。',
        hint: 'vi /etc/httpd/conf/httpd.conf → LogFormat、CustomLog、ErrorLog を確認',
      },
      {
        id: 's3-3', sectionId: 's3', index: 19, number: '3-3',
        title: 'httpd起動',
        objective: 'systemctl start httpd で Apache を起動してください。',
        hint: 'systemctl start httpd && systemctl status httpd',
      },
      {
        id: 's3-4', sectionId: 's3', index: 20, number: '3-4',
        title: '自動起動設定',
        objective: 'systemctl enable httpd でシステム起動時に Apache が自動起動するよう設定してください。',
        hint: 'systemctl enable httpd',
      },
      {
        id: 's3-5', sectionId: 's3', index: 21, number: '3-5',
        title: 'テストページ作成',
        objective: '/var/www/html/index.html に任意の HTML を作成してください。',
        hint: 'echo "<h1>Hello NIC</h1>" > /var/www/html/index.html',
      },
      {
        id: 's3-6', sectionId: 's3', index: 22, number: '3-6',
        title: 'ブラウザ動作確認',
        objective: 'ブラウザで http://<サーバーIP> にアクセスし、作成したページが表示されることを確認してください。',
        hint: 'curl http://localhost でサーバー側からも確認できます',
      },
      {
        id: 's3-7', sectionId: 's3', index: 23, number: '3-7',
        title: '【理解度確認】httpd設定の手順書作成・提出',
        objective: 'セクション3で実施したhttpd設定の手順書を作成し、内容を記述してください。Apache の役割と設定ファイルの構成を含めてください。',
        isReview: true,
        reviewCriteria: 'Apache のインストールから動作確認までの手順が記載されていること。httpd.conf の主要な設定項目（DocumentRoot、ログ設定等）が説明されていること。systemctl での起動・自動起動設定が記載されていること。動作確認方法が含まれていること。',
      },
    ],
  },
  {
    id: 's4',
    number: 4,
    title: '改ざん検知 AIDE',
    clearedKey: INFRA5_PHASE4_CLEARED_KEY,
    tasks: [
      {
        id: 's4-1', sectionId: 's4', index: 24, number: '4-1',
        title: 'AIDEインストール',
        objective: 'dnf install aide コマンドで AIDE をインストールしてください。',
        hint: 'dnf install -y aide',
      },
      {
        id: 's4-2', sectionId: 's4', index: 25, number: '4-2',
        title: 'aide.conf設定',
        objective: '/etc/aide.conf を確認し、監視対象ディレクトリの設定を理解してください。',
        hint: 'cat /etc/aide.conf | grep -v "^#" | grep -v "^$"',
      },
      {
        id: 's4-3', sectionId: 's4', index: 26, number: '4-3',
        title: 'データベース作成',
        objective: 'aide --init コマンドで初期データベースを作成し、本番用にリネームしてください。',
        hint: 'aide --init && cp /var/lib/aide/aide.db.new.gz /var/lib/aide/aide.db.gz',
      },
      {
        id: 's4-4', sectionId: 's4', index: 27, number: '4-4',
        title: '動作確認',
        objective: 'テスト用ファイルを変更し、aide --check コマンドで改ざん検知が機能することを確認してください。',
        hint: 'touch /etc/testfile && aide --check → 変更が検出されることを確認',
      },
      {
        id: 's4-5', sectionId: 's4', index: 28, number: '4-5',
        title: 'cron自動実行設定',
        objective: 'crontab に aide --check を定期実行するエントリを追加してください。',
        hint: '0 2 * * * /usr/sbin/aide --check >> /var/log/aide/aide-check.log 2>&1',
      },
      {
        id: 's4-6', sectionId: 's4', index: 29, number: '4-6',
        title: '【理解度確認】AIDE設定の手順書作成・提出',
        objective: 'セクション4で実施したAIDE設定の手順書を作成し、内容を記述してください。改ざん検知の仕組みと運用方法を含めてください。',
        isReview: true,
        reviewCriteria: 'AIDE の役割（ファイル改ざん検知）が説明されていること。インストールからcron設定までの手順が記載されていること。データベースの初期化と更新の手順が含まれていること。改ざん検知の動作確認手順が記載されていること。',
      },
    ],
  },
  {
    id: 's5',
    number: 5,
    title: 'PostgreSQL基本設定',
    clearedKey: INFRA5_PHASE5_CLEARED_KEY,
    tasks: [
      {
        id: 's5-1', sectionId: 's5', index: 30, number: '5-1',
        title: 'PostgreSQL 16インストール',
        objective: 'dnf モジュールで PostgreSQL 16 を有効化し、インストールしてください。',
        hint: 'dnf module enable postgresql:16 -y && dnf install -y postgresql-server',
      },
      {
        id: 's5-2', sectionId: 's5', index: 31, number: '5-2',
        title: 'DB初期化',
        objective: 'postgresql-setup --initdb コマンドで DB クラスターを初期化してください。',
        hint: 'postgresql-setup --initdb',
      },
      {
        id: 's5-3', sectionId: 's5', index: 32, number: '5-3',
        title: 'PostgreSQL起動',
        objective: 'systemctl start postgresql でサービスを起動してください。',
        hint: 'systemctl start postgresql && systemctl status postgresql',
      },
      {
        id: 's5-4', sectionId: 's5', index: 33, number: '5-4',
        title: '自動起動設定',
        objective: 'systemctl enable postgresql で自動起動を設定してください。',
        hint: 'systemctl enable postgresql',
      },
      {
        id: 's5-5', sectionId: 's5', index: 34, number: '5-5',
        title: 'ユーザー作成',
        objective: 'psql コマンドで neos ユーザー（SUPERUSER）を作成し、パスワードを設定してください。',
        hint: 'sudo -u postgres psql -c "CREATE USER neos WITH SUPERUSER PASSWORD \'P@ssw0rd\';"',
      },
      {
        id: 's5-6', sectionId: 's5', index: 35, number: '5-6',
        title: 'DB作成',
        objective: 'createdb コマンドで neos ユーザー用のデータベースを作成してください。',
        hint: 'sudo -u postgres createdb -O neos neosdb',
      },
      {
        id: 's5-7', sectionId: 's5', index: 36, number: '5-7',
        title: 'テーブル作成',
        objective: 'psql で neosdb に接続し、テスト用テーブルを CREATE TABLE コマンドで作成してください。',
        hint: 'psql -U neos -d neosdb -c "CREATE TABLE test (id SERIAL PRIMARY KEY, name VARCHAR(100));"',
      },
      {
        id: 's5-8', sectionId: 's5', index: 37, number: '5-8',
        title: 'テーブル削除',
        objective: 'DROP TABLE コマンドで作成したテーブルを削除してください。',
        hint: 'psql -U neos -d neosdb -c "DROP TABLE test;"',
      },
      {
        id: 's5-9', sectionId: 's5', index: 38, number: '5-9',
        title: 'DB削除',
        objective: 'dropdb コマンドでテスト用データベースを削除してください。',
        hint: 'sudo -u postgres dropdb neosdb',
      },
      {
        id: 's5-10', sectionId: 's5', index: 39, number: '5-10',
        title: '【理解度確認】PostgreSQL設定の手順書作成・提出',
        objective: 'セクション5で実施したPostgreSQL設定の手順書を作成し、内容を記述してください。RDBMSの基本概念と運用手順を含めてください。',
        isReview: true,
        reviewCriteria: 'PostgreSQL のインストールから基本操作（DB/ユーザー/テーブル作成・削除）までの手順が記載されていること。postgresql-setup --initdb の役割が説明されていること。ユーザー管理（SUPERUSER 権限等）が含まれていること。自動起動設定が記載されていること。',
      },
    ],
  },
]

// 全タスクのフラット配列（インデックス参照用）
export const ALL_INFRA5_TASKS = INFRA5_SECTIONS.flatMap((s) => s.tasks)

// 後方互換：旧エクスポート（InfraBasic5Page で使用していたが削除）
// trainingWbsData.ts と traineeProgressStorage.ts の PHASE_CLEARED_KEYS は引き続き有効
export const SERVER_PARAMS = [] as const
export const BUILD_QUESTIONS = [] as const
export const TROUBLE_QUESTIONS = [] as const
export const SECURITY_QUESTIONS = [] as const
