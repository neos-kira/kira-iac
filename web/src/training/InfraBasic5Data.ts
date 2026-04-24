/**
 * インフラ基礎課題5: サーバー構築（40タスク・5セクション構成）
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

export type Infra5Task = {
  id: string
  sectionId: string
  index: number
  number: string
  title: string
  objective: string
  /** 「考え方・調べ方」のみ。答え（コマンド）を書かない */
  hint?: string
  /** 研修生に実行させる確認コマンド */
  verifyCommand?: string
  /** AIへの採点基準（完了と判定する条件） */
  successCriteria?: string
  /** true のとき理解度確認モード（手順書テキスト + AI採点） */
  isReview?: boolean
  reviewCriteria?: string
  /** 理解度確認タスクで使用するExcelテンプレートのファイル名（/templates/ 配下） */
  templateFile?: string
}

export type Infra5Section = {
  id: string
  number: number
  title: string
  clearedKey: string
  tasks: Infra5Task[]
}

export const INFRA5_SECTIONS: Infra5Section[] = [
  // ──────────────────────────────────────────────
  // セクション1: OS設定（11項目）
  // ──────────────────────────────────────────────
  {
    id: 's1', number: 1, title: 'OS設定', clearedKey: INFRA5_PHASE1_CLEARED_KEY,
    tasks: [
      {
        id: 's1-1', sectionId: 's1', index: 0, number: '1-1',
        title: 'リモートユーザー作成',
        objective: 'SSH接続用の作業ユーザーを作成し、パスワードを設定してください。',
        hint: 'Linuxでユーザーを追加するコマンドは何か調べてください。また、パスワードを設定するコマンドも確認してください。',
        verifyCommand: 'id <作成したユーザー名>',
        successCriteria: 'idコマンドの出力に uid= と gid= が表示され、ユーザーが正しく作成されていること。',
      },
      {
        id: 's1-2', sectionId: 's1', index: 1, number: '1-2',
        title: 'ホスト名設定',
        objective: 'サーバーのホスト名を任意の名前に変更してください。',
        hint: 'hostnamectlコマンドの --help オプションで使い方を確認してください。',
        verifyCommand: 'hostname',
        successCriteria: '設定したホスト名が表示されること（デフォルトのホスト名から変更されていること）。',
      },
      {
        id: 's1-3', sectionId: 's1', index: 2, number: '1-3',
        title: 'ネットワーク設定確認',
        objective: 'サーバーに割り当てられたIPアドレスを確認してください。',
        hint: 'LinuxでIPアドレスを表示するコマンドは複数あります。ip、ifconfig、nmcli などを調べてください。',
        verifyCommand: 'ip a',
        successCriteria: 'inet の行にIPアドレス（x.x.x.x形式）が表示されること。',
      },
      {
        id: 's1-4', sectionId: 's1', index: 3, number: '1-4',
        title: '名前解決設定確認',
        objective: '外部ドメインの名前解決ができることを確認してください。',
        hint: '名前解決の設定ファイル（/etc/resolv.conf 等）の内容を確認し、nslookup または dig コマンドでテストしてください。',
        verifyCommand: 'nslookup google.com',
        successCriteria: 'google.com のIPアドレスが "Address:" の後に表示されること。',
      },
      {
        id: 's1-5', sectionId: 's1', index: 4, number: '1-5',
        title: '外部疎通確認',
        objective: '外部サーバー（google.com等）と通信できることを確認してください。',
        hint: 'ネットワーク疎通を確認する基本的なコマンドを調べてください。パケットロスが 0% になっていることを確認してください。',
        verifyCommand: 'ping -c 4 google.com',
        successCriteria: '4パケット送信し、0% packet loss であること。',
      },
      {
        id: 's1-6', sectionId: 's1', index: 5, number: '1-6',
        title: 'SSH設定 - rootログイン禁止',
        objective: 'rootユーザーによる直接SSHログインを禁止してください。',
        hint: 'SSHの設定ファイル（/etc/ssh/sshd_config）を開き、rootログインに関する設定項目を探してください。変更後はsshdの再起動が必要です。',
        verifyCommand: 'grep -i PermitRootLogin /etc/ssh/sshd_config',
        successCriteria: '"PermitRootLogin no" の行が有効（#でコメントアウトされていない）になっていること。',
      },
      {
        id: 's1-7', sectionId: 's1', index: 6, number: '1-7',
        title: 'コマンド履歴設定',
        objective: 'historyコマンドで日時が表示され、十分な履歴が保存されるようにしてください。',
        hint: 'bashの履歴に関する環境変数（HISTで始まるもの）を調べてください。日時を記録する変数、件数を増やす変数の2種類があります。設定は ~/.bashrc に追記します。',
        verifyCommand: 'grep HIST ~/.bashrc',
        successCriteria: 'HISTSIZE、HISTFILESIZE、HISTTIMEFORMAT の3つの変数が ~/.bashrc に設定されていること。',
      },
      {
        id: 's1-8', sectionId: 's1', index: 7, number: '1-8',
        title: 'ufw有効化',
        objective: 'ufwを有効化し、SSH接続が許可されていることを確認してください。',
        hint: 'ufw コマンドの --help でオプションを確認してください。SSH接続を許可してからufwを有効化する順序が重要です（順序を誤ると締め出される可能性があります）。',
        verifyCommand: 'ufw status',
        successCriteria: '"Status: active" が表示され、SSH（22番ポート）の接続が許可されていること。',
      },
      {
        id: 's1-9', sectionId: 's1', index: 8, number: '1-9',
        title: 'AppArmor確認',
        objective: 'UbuntuではSELinuxの代わりにAppArmorが使用されています。AppArmorの状態を確認してください。',
        hint: 'aa-status コマンドでAppArmorの状態を確認できます。Ubuntuでは標準でAppArmorが有効になっています。',
        verifyCommand: 'aa-status 2>&1 | head -5',
        successCriteria: 'AppArmorのプロファイル数・強制モード数が表示されること。',
      },
      {
        id: 's1-10', sectionId: 's1', index: 9, number: '1-10',
        title: 'システム再起動',
        objective: 'これまでの設定を確認するためにサーバーを再起動し、正常に起動していることを確認してください。',
        hint: 'Linuxを再起動するコマンドを調べてください。再起動後、uptimeコマンドでシステムの稼働状況を確認してください。',
        verifyCommand: 'uptime',
        successCriteria: 'uptime が表示されシステムが正常起動していること。',
      },
      {
        id: 's1-11', sectionId: 's1', index: 10, number: '1-11',
        title: '【理解度確認】OS設定の手順書作成・提出',
        objective: 'セクション1で実施したOS設定の手順書を作成し、Excelテンプレートに記入して提出してください。',
        isReview: true,
        hint: '手順書には目的・手順・確認の3点を必ず含めてください。コマンドを羅列するだけでなく、なぜその設定が必要かを説明してください。',
        reviewCriteria: 'OS設定（ユーザー作成、ホスト名、ネットワーク確認、SSH強化、ufw設定・AppArmor確認）の各手順が網羅されていること。各設定の目的が説明されていること。確認コマンドと期待する結果が記載されていること。',
        templateFile: 'os_setup_template.xlsx',
      },
    ],
  },

  // ──────────────────────────────────────────────
  // セクション2: ディスク追加（6項目）
  // ──────────────────────────────────────────────
  {
    id: 's2', number: 2, title: 'ディスク追加', clearedKey: INFRA5_PHASE2_CLEARED_KEY,
    tasks: [
      {
        id: 's2-1', sectionId: 's2', index: 11, number: '2-1',
        title: 'パーティション作成',
        objective: '追加ディスクにパーティションを作成してください。',
        hint: 'ディスクの一覧を確認するコマンド（lsblk, fdisk -l）で追加ディスクのデバイス名を調べてください。次に fdisk または parted でパーティションを作成する方法を調べてください。',
        verifyCommand: 'lsblk',
        successCriteria: '追加ディスク（/dev/xvdb 等）にパーティション（xvdb1 等）が作成されていること。',
      },
      {
        id: 's2-2', sectionId: 's2', index: 12, number: '2-2',
        title: 'PV作成',
        objective: '作成したパーティションでPhysical Volume（PV）を作成してください。',
        hint: 'LVMの3層構造（PV→VG→LV）を調べてください。PVを作成するコマンドを man ページや --help で確認してください。',
        verifyCommand: 'pvs',
        successCriteria: 'pvs コマンドで作成したパーティション（/dev/xvdb1 等）がPVとして表示されること。',
      },
      {
        id: 's2-3', sectionId: 's2', index: 13, number: '2-3',
        title: 'VG作成',
        objective: 'PVを使用してVolume Group（VG）を作成してください。',
        hint: 'vgcreate コマンドの使い方を調べてください。VGに任意の名前を付けることができます。',
        verifyCommand: 'vgs',
        successCriteria: 'vgs コマンドで作成したVGが表示されること。',
      },
      {
        id: 's2-4', sectionId: 's2', index: 14, number: '2-4',
        title: 'LV作成',
        objective: 'VG内にLogical Volume（LV）を作成してください。',
        hint: 'lvcreate コマンドの使い方を調べてください。VGの容量をすべて使用するオプションがあります。',
        verifyCommand: 'lvs',
        successCriteria: 'lvs コマンドで作成したLVが表示されること。',
      },
      {
        id: 's2-5', sectionId: 's2', index: 15, number: '2-5',
        title: 'マウント設定',
        objective: 'LVをフォーマットし、マウントポイントを作成してマウントしてください。再起動後も自動マウントされるよう /etc/fstab にも設定してください。',
        hint: 'ファイルシステムを作成するコマンド（mkfs）と、マウントするコマンド（mount）を調べてください。/etc/fstab への追記方法も確認してください。',
        verifyCommand: 'df -h && grep vg /etc/fstab',
        successCriteria: 'df -h でマウントポイントが表示されること。/etc/fstab に設定が記載されていること。',
      },
      {
        id: 's2-6', sectionId: 's2', index: 16, number: '2-6',
        title: '【理解度確認】ディスク追加の手順書作成・提出',
        objective: 'セクション2で実施したディスク追加の手順書をExcelテンプレートに記入して提出してください。LVMの仕組み（PV→VG→LV の3層構造）の説明を含めてください。',
        isReview: true,
        hint: 'LVMを使うメリット（柔軟なサイズ変更など）も含めると良い手順書になります。',
        reviewCriteria: 'LVMの3層構造（PV→VG→LV）が正しく説明されていること。パーティション作成からマウントまでの手順が順序通り記載されていること。/etc/fstab による永続化設定が含まれていること。確認コマンド（pvs/vgs/lvs/df -h）が記載されていること。',
        templateFile: 'disk_setup_template.xlsx',
      },
    ],
  },

  // ──────────────────────────────────────────────
  // セクション3: apache2基本設定（7項目）
  // ──────────────────────────────────────────────
  {
    id: 's3', number: 3, title: 'apache2基本設定', clearedKey: INFRA5_PHASE3_CLEARED_KEY,
    tasks: [
      {
        id: 's3-1', sectionId: 's3', index: 17, number: '3-1',
        title: 'apache2インストール',
        objective: 'Ubuntu にApache（apache2）をインストールしてください。',
        hint: 'Ubuntu のパッケージ管理コマンドを調べてください。パッケージ名は apache2 です。',
        verifyCommand: 'dpkg -l apache2',
        successCriteria: '"ii  apache2 ..." の形式でインストール済みのパッケージが表示されること。',
      },
      {
        id: 's3-2', sectionId: 's3', index: 18, number: '3-2',
        title: 'apache2.conf設定',
        objective: '/etc/apache2/apache2.conf を確認し、ログの出力先・フォーマットを把握・必要に応じて変更してください。',
        hint: 'apache2.conf の中で LogFormat、CustomLog、ErrorLog という設定項目を探してください。各設定の意味を調べてください。',
        verifyCommand: 'grep -E "^(LogFormat|CustomLog|ErrorLog)" /etc/apache2/apache2.conf',
        successCriteria: 'LogFormat、CustomLog、ErrorLog の設定行が表示されること。',
      },
      {
        id: 's3-3', sectionId: 's3', index: 19, number: '3-3',
        title: 'apache2起動',
        objective: 'Apacheサービスを起動してください。',
        hint: 'systemctl コマンドでサービスを起動する方法を調べてください。起動後は status で状態を確認してください。',
        verifyCommand: 'systemctl status apache2',
        successCriteria: '"Active: active (running)" が表示されること。',
      },
      {
        id: 's3-4', sectionId: 's3', index: 20, number: '3-4',
        title: '自動起動設定',
        objective: 'サーバー再起動時にApacheが自動起動するよう設定してください。',
        hint: 'systemctl でサービスの自動起動を有効化するサブコマンドを調べてください。enable と is-enabled の違いも確認してください。',
        verifyCommand: 'systemctl is-enabled apache2',
        successCriteria: '"enabled" が表示されること。',
      },
      {
        id: 's3-5', sectionId: 's3', index: 21, number: '3-5',
        title: 'テストページ作成',
        objective: '/var/www/html/index.html にテスト用のHTMLファイルを作成してください。',
        hint: 'Apacheのドキュメントルートのパスを調べ、そこにHTMLファイルを作成してください。',
        verifyCommand: 'cat /var/www/html/index.html',
        successCriteria: '/var/www/html/index.html に内容が存在すること（空でないこと）。',
      },
      {
        id: 's3-6', sectionId: 's3', index: 22, number: '3-6',
        title: 'ブラウザ動作確認',
        objective: 'ブラウザまたはcurlコマンドでApacheのテストページが表示されることを確認してください。',
        hint: 'curl コマンドを使ってローカルからHTTPリクエストを送る方法を調べてください。-I オプションでヘッダーだけ確認することもできます。',
        verifyCommand: 'curl -s -o /dev/null -w "%{http_code}" http://localhost',
        successCriteria: 'HTTPステータスコード 200 が返されること。',
      },
      {
        id: 's3-7', sectionId: 's3', index: 23, number: '3-7',
        title: '【理解度確認】apache2設定の手順書作成・提出',
        objective: 'セクション3で実施したapache2設定の手順書をExcelテンプレートに記入して提出してください。Apacheの役割と設定ファイルの構成を含めてください。',
        isReview: true,
        hint: 'なぜWebサーバーが必要か、apache2.conf のどの設定がどの動作を制御するかを説明してください。',
        reviewCriteria: 'インストールから動作確認までの手順が記載されていること。apache2.conf の主要設定（DocumentRoot、ログ設定）が説明されていること。systemctl での起動・自動起動設定が記載されていること。確認方法（curl/ブラウザ）が含まれていること。',
        templateFile: 'httpd_setup_template.xlsx',
      },
    ],
  },

  // ──────────────────────────────────────────────
  // セクション4: 改ざん検知 AIDE（6項目）
  // ──────────────────────────────────────────────
  {
    id: 's4', number: 4, title: '改ざん検知 AIDE', clearedKey: INFRA5_PHASE4_CLEARED_KEY,
    tasks: [
      {
        id: 's4-1', sectionId: 's4', index: 24, number: '4-1',
        title: 'AIDEインストール',
        objective: 'AIDE（Advanced Intrusion Detection Environment）をインストールしてください。',
        hint: 'apt でパッケージ名 aide を検索・インストールしてください。',
        verifyCommand: 'dpkg -l aide',
        successCriteria: '"ii  aide ..." の形式でインストール済みのパッケージが表示されること。',
      },
      {
        id: 's4-2', sectionId: 's4', index: 25, number: '4-2',
        title: 'aide.conf設定',
        objective: '/etc/aide.conf を確認し、監視対象ディレクトリの設定を理解してください。',
        hint: '/etc/aide.conf を開いて、どのディレクトリが監視対象になっているかを確認してください。コメント行（#）以外の行に注目してください。',
        verifyCommand: 'grep -v "^#" /etc/aide.conf | grep -v "^$" | head -20',
        successCriteria: '設定ファイルの有効行が表示され、監視対象パス（/bin, /etc 等）が含まれていること。',
      },
      {
        id: 's4-3', sectionId: 's4', index: 26, number: '4-3',
        title: 'データベース作成',
        objective: 'aide --init コマンドで初期データベースを作成し、本番用にリネームしてください。',
        hint: 'aide --init を実行してデータベースファイルを生成します。生成されたファイル名と本番用ファイル名の違いを調べてください（aide.db.new.gz → aide.db.gz）。',
        verifyCommand: 'ls -la /var/lib/aide/',
        successCriteria: '/var/lib/aide/ に aide.db.gz（または aide.db）ファイルが存在すること。',
      },
      {
        id: 's4-4', sectionId: 's4', index: 27, number: '4-4',
        title: '動作確認',
        objective: 'テスト用にファイルを変更し、aide --check コマンドで改ざんが検知されることを確認してください。',
        hint: '監視対象ディレクトリ（/etc など）にテストファイルを作成・変更してから aide --check を実行してください。変更が報告される内容を確認してください。',
        verifyCommand: 'aide --check 2>&1 | tail -20',
        successCriteria: '変更したファイルの情報が "Added files:" や "Changed files:" のセクションに表示されること。',
      },
      {
        id: 's4-5', sectionId: 's4', index: 28, number: '4-5',
        title: 'cron自動実行設定',
        objective: 'AIDE の定期チェックを cron に登録してください。',
        hint: 'crontab -e でcronジョブを編集する方法を調べてください。日次実行の cron 書式を確認してください。',
        verifyCommand: 'crontab -l',
        successCriteria: 'aide --check を実行するcronエントリが登録されていること。',
      },
      {
        id: 's4-6', sectionId: 's4', index: 29, number: '4-6',
        title: '【理解度確認】AIDE設定の手順書作成・提出',
        objective: 'セクション4で実施したAIDE設定の手順書をExcelテンプレートに記入して提出してください。改ざん検知の仕組みと運用方法を含めてください。',
        isReview: true,
        hint: 'AIDEがどのようにして改ざんを検知するか（ハッシュ値の比較）、なぜ定期実行が重要かを説明してください。',
        reviewCriteria: 'AIDEの役割（ファイル改ざん検知の仕組み）が説明されていること。インストールからcron設定までの手順が記載されていること。データベース初期化と更新の手順が含まれていること。改ざん検知の動作確認手順が記載されていること。',
        templateFile: 'aide_setup_template.xlsx',
      },
    ],
  },

  // ──────────────────────────────────────────────
  // セクション5: PostgreSQL基本設定（10項目）
  // ──────────────────────────────────────────────
  {
    id: 's5', number: 5, title: 'PostgreSQL基本設定', clearedKey: INFRA5_PHASE5_CLEARED_KEY,
    tasks: [
      {
        id: 's5-1', sectionId: 's5', index: 30, number: '5-1',
        title: 'PostgreSQLインストール',
        objective: 'apt を使って PostgreSQL をインストールしてください。',
        hint: 'apt でパッケージ名 postgresql を調べてください。Ubuntuではインストールと同時にDBクラスターの初期化も行われます。',
        verifyCommand: 'dpkg -l postgresql',
        successCriteria: '"ii  postgresql ..." の形式でインストール済みのパッケージが表示されること。',
      },
      {
        id: 's5-2', sectionId: 's5', index: 31, number: '5-2',
        title: 'PostgreSQL設定確認',
        objective: 'PostgreSQLの設定ファイルが存在することを確認してください。',
        hint: 'Ubuntuではapt installと同時にDBクラスターが初期化されます。ls コマンドで /etc/postgresql/ ディレクトリを確認してください。',
        verifyCommand: 'ls /etc/postgresql/',
        successCriteria: '/etc/postgresql/ にバージョンディレクトリ（例: 16/）が表示されること。',
      },
      {
        id: 's5-3', sectionId: 's5', index: 32, number: '5-3',
        title: 'PostgreSQL起動',
        objective: 'PostgreSQL サービスを起動してください。',
        hint: 'systemctl でサービスを起動する方法は他のサービスと同じです。サービス名を確認してください。',
        verifyCommand: 'systemctl status postgresql',
        successCriteria: '"Active: active (running)" が表示されること。',
      },
      {
        id: 's5-4', sectionId: 's5', index: 33, number: '5-4',
        title: '自動起動設定',
        objective: 'サーバー再起動時にPostgreSQLが自動起動するよう設定してください。',
        hint: 'systemctl enable コマンドを使います。他のセクションで実施した手順と同じです。',
        verifyCommand: 'systemctl is-enabled postgresql',
        successCriteria: '"enabled" が表示されること。',
      },
      {
        id: 's5-5', sectionId: 's5', index: 34, number: '5-5',
        title: 'ユーザー作成',
        objective: 'psql コマンドで neos という名前のスーパーユーザーを作成し、パスワードを設定してください。',
        hint: 'postgres ユーザーとして psql を実行する方法を調べてください。SQL の CREATE USER 文の書き方も確認してください。',
        verifyCommand: 'sudo -u postgres psql -c "\\du"',
        successCriteria: '\\du の出力に neos ユーザーが表示され、Superuser 権限が付与されていること。',
      },
      {
        id: 's5-6', sectionId: 's5', index: 35, number: '5-6',
        title: 'DB作成',
        objective: 'neos ユーザーが所有するデータベースを作成してください。',
        hint: 'createdb コマンドまたは SQL の CREATE DATABASE 文でデータベースを作成できます。オーナーを指定するオプションを調べてください。',
        verifyCommand: 'sudo -u postgres psql -c "\\l"',
        successCriteria: '\\l の出力に作成したデータベースが表示され、Owner が neos になっていること。',
      },
      {
        id: 's5-7', sectionId: 's5', index: 36, number: '5-7',
        title: 'テーブル作成',
        objective: '作成したデータベースに接続し、テスト用テーブルを作成してください。',
        hint: 'psql で特定のデータベースに接続するオプションを調べてください。CREATE TABLE 文の書き方も確認してください。',
        verifyCommand: 'sudo -u postgres psql -d neosdb -c "\\dt"',
        successCriteria: '\\dt の出力に作成したテーブルが表示されること。',
      },
      {
        id: 's5-8', sectionId: 's5', index: 37, number: '5-8',
        title: 'テーブル削除',
        objective: '作成したテーブルを削除してください。',
        hint: 'SQL の DROP TABLE 文の書き方を調べてください。',
        verifyCommand: 'sudo -u postgres psql -d neosdb -c "\\dt"',
        successCriteria: '\\dt の出力が "Did not find any relations." または空になっていること（テーブルが存在しないこと）。',
      },
      {
        id: 's5-9', sectionId: 's5', index: 38, number: '5-9',
        title: 'DB削除',
        objective: '作成したデータベースを削除してください。',
        hint: 'dropdb コマンドまたは SQL の DROP DATABASE 文でデータベースを削除できます。',
        verifyCommand: 'sudo -u postgres psql -c "\\l"',
        successCriteria: '\\l の出力から作成したデータベースが消えていること（template0/template1/postgres のみ残っていること）。',
      },
      {
        id: 's5-10', sectionId: 's5', index: 39, number: '5-10',
        title: '【理解度確認】PostgreSQL設定の手順書作成・提出',
        objective: 'セクション5で実施したPostgreSQL設定の手順書をExcelテンプレートに記入して提出してください。RDBMSの基本概念と運用手順を含めてください。',
        isReview: true,
        hint: 'PostgreSQLをインストールして使えるようにするまでの一連の流れを、「なぜその手順が必要か」を添えて説明してください。',
        reviewCriteria: 'インストールから基本操作（DB/ユーザー/テーブル作成・削除）までの手順が記載されていること。postgresql-setup --initdb の役割が説明されていること。ユーザー管理（SUPERUSER）が含まれていること。自動起動設定が記載されていること。',
        templateFile: 'postgresql_setup_template.xlsx',
      },
    ],
  },
]

export const ALL_INFRA5_TASKS = INFRA5_SECTIONS.flatMap((s) => s.tasks)

// 後方互換
export const SERVER_PARAMS = [] as const
export const BUILD_QUESTIONS = [] as const
export const TROUBLE_QUESTIONS = [] as const
export const SECURITY_QUESTIONS = [] as const
