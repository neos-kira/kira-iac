/**
 * インフラ基礎課題5: サーバー構築（41タスク・5セクション構成）
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
  /** 研修生が自分で考えて実行する確認の指示文 */
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
        objective: '本番サーバーではrootで直接作業しません。rootでの操作ミスはシステム全体に影響します。障害時の影響範囲を最小化するため、作業用ユーザーを作成して以降の作業はそのユーザーで行います。SSH接続用の作業ユーザーを作成し、パスワードを設定してください。',
        hint: 'Linuxのユーザー情報は /etc/passwd に記録されています。ユーザー追加コマンドとパスワード設定コマンドをそれぞれ調べてみてください。作成後にユーザー情報を確認するコマンドも合わせて調べてみてください。',
        verifyCommand: '作成したユーザーが存在すること・ホームディレクトリが作成されていること・ログインシェルが設定されていることの3点を確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: '作業ユーザーが正しく作成され、ホームディレクトリとシェルが設定されていることが確認できていること。',
      },
      {
        id: 's1-2', sectionId: 's1', index: 1, number: '1-2',
        title: 'ホスト名設定',
        objective: '複数のサーバーを管理する現場では、ホスト名でサーバーを識別します。意味のないホスト名では誤操作の原因になります。サーバーのホスト名を任意の名前に変更してください。',
        hint: 'hostnamectl コマンドの --help オプションで使い方を確認してください。変更後は別のコマンドでホスト名が反映されているか確認してみてください。',
        verifyCommand: '現在のホスト名が変更されていることを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: 'デフォルトのホスト名から任意の名前に変更されていることが確認できていること。',
      },
      {
        id: 's1-3', sectionId: 's1', index: 2, number: '1-3',
        title: 'ネットワーク設定確認',
        objective: '現場ではサーバーに割り当てられたIPアドレスを把握していないと、接続先の確認や疎通テストができません。サーバーに割り当てられたIPアドレスを確認してください。',
        hint: 'Linuxでネットワーク情報を表示するコマンドはいくつかあります。ip コマンドや ifconfig コマンドを調べてみてください。インターフェース名・IPアドレス・サブネットマスクが確認できます。',
        verifyCommand: 'ネットワークインターフェース名・IPアドレス・サブネットマスクの3点を確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: 'サーバーに割り当てられたIPアドレスとネットワークインターフェース名が確認できていること。',
      },
      {
        id: 's1-4', sectionId: 's1', index: 3, number: '1-4',
        title: '名前解決設定確認',
        objective: 'DNSが機能しないとパッケージインストールやソフトウェアのダウンロードができなくなります。現場でのサーバー構築開始前に名前解決が正常であることを必ず確認します。外部ドメインの名前解決ができることを確認してください。',
        hint: '名前解決のテストには nslookup や dig コマンドが使えます。使用しているDNSサーバーの設定は /etc/resolv.conf に記録されています。',
        verifyCommand: '外部ドメイン（google.com等）の名前解決ができることと、使用しているDNSサーバーのIPアドレスを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: '外部ドメインのIPアドレスが解決できており、利用しているDNSサーバーが確認できていること。',
      },
      {
        id: 's1-5', sectionId: 's1', index: 4, number: '1-5',
        title: '外部疎通確認',
        objective: 'ルーティング設定が正しくても実際の通信ができないことがあります。「疎通できるか」は設定後の必須確認事項です。外部サーバー（google.com等）と通信できることを確認してください。',
        hint: 'ネットワーク疎通確認の基本コマンドを調べてみてください。送受信パケット数とパケットロス率が表示されます。',
        verifyCommand: '外部ホストへの疎通確認結果（送信パケット数・受信パケット数・パケットロス率）を確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: '外部ホストへの通信が成功し、パケットロスがないことが確認できていること。',
      },
      {
        id: 's1-6', sectionId: 's1', index: 5, number: '1-6',
        title: 'SSH設定 - rootログイン禁止',
        objective: 'rootへの直接SSH攻撃（ブルートフォース攻撃）は世界中で毎秒行われています。auth.logを確認すれば自分のサーバーにも無数の試みが記録されているはずです。rootログインを禁止することは最低限のセキュリティ対策です。rootユーザーによる直接SSHログインを禁止してください。',
        hint: 'SSHの設定ファイルは /etc/ssh/sshd_config です。rootログインに関する設定項目を探し、変更後はsshdサービスを再起動してください。設定の有効・無効はコメントアウト（#）で切り替えられます。',
        verifyCommand: 'rootログインが禁止されていることをSSH設定ファイルから確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: 'SSH設定ファイルでrootログインが明示的に禁止されていることが確認できていること。',
      },
      {
        id: 's1-7', sectionId: 's1', index: 6, number: '1-7',
        title: 'コマンド履歴設定',
        objective: '障害調査では「いつ・誰が・何をしたか」の追跡が重要です。コマンド履歴に日時が記録されていないと、問題のある操作を特定できません。historyコマンドで日時が表示され、十分な履歴が保存されるようにしてください。',
        hint: 'bashの履歴設定には HIST で始まる環境変数が使われます。日時フォーマット・保存件数に関する変数をそれぞれ調べてみてください。~/.bashrc への追記方法も確認してください。',
        verifyCommand: 'コマンド履歴の設定（件数・日時フォーマット）が有効になっていることを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: 'コマンド履歴に日時が記録されるよう設定されており、十分な件数が保存されるよう設定されていることが確認できていること。',
      },
      {
        id: 's1-8', sectionId: 's1', index: 7, number: '1-8',
        title: 'ufw有効化',
        objective: 'Linuxサーバーはサービスをインストールするたびに新しいポートが開きます。ufwで許可するポートを明示的に管理しなければ、意図せず外部に公開されたサービスが攻撃の入口になります。ufwを有効化し、SSH接続が許可されていることを確認してください。',
        hint: 'ufw コマンドでファイアウォールの状態と許可ルールを確認できます。まずSSHポートを許可してから有効化する順序が重要です（順序を誤ると締め出される可能性があります）。',
        verifyCommand: 'ufwの有効化状態と許可されているポートの一覧を確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: 'ufwが有効化されており、SSH（22番ポート）が許可された状態であることが確認できていること。',
      },
      {
        id: 's1-9', sectionId: 's1', index: 8, number: '1-9',
        title: 'AppArmor確認',
        objective: 'Ubuntuでは強制アクセス制御（MAC）としてAppArmorが標準で有効です。AppArmorを無効にするとプロセスの権限が過剰になりセキュリティリスクが高まります。AppArmorの状態と有効なプロファイル数を確認してください。',
        hint: 'AppArmorの状態確認にはいくつかのコマンドが使えます。有効なプロファイル数・強制モードのプロファイル数を確認できるコマンドを調べてみてください。',
        verifyCommand: 'AppArmorの動作状態と有効なプロファイル数を確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: 'AppArmorが動作しており、有効なプロファイルが設定されていることが確認できていること。',
      },
      {
        id: 's1-10', sectionId: 's1', index: 9, number: '1-10',
        title: 'システム再起動',
        objective: '設定変更の中には再起動しないと完全に適用されないものがあります。これまでの設定が再起動後も維持されているかを確認することは現場での基本手順です。サーバーを再起動し、正常に起動していることを確認してください。',
        hint: 'Linuxを再起動するコマンドを調べてください。再起動後、システムの稼働時間を表示するコマンドでいつ起動したかが確認できます。',
        verifyCommand: 'システムが正常に再起動していること・稼働時間・現在のロードアベレージを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: 'システムが正常に再起動しており、稼働時間が確認できていること。',
      },
      {
        id: 's1-11', sectionId: 's1', index: 10, number: '1-11',
        title: '【理解度確認】OS設定の手順書作成',
        objective: 'セクション1で実施したOS設定の手順書を作成し、Excelテンプレートに記入して提出してください。',
        isReview: true,
        hint: '手順書には目的・手順・確認の3点を必ず含めてください。コマンドを羅列するだけでなく、なぜその設定が必要かを説明してください。',
        reviewCriteria: 'OS設定（ユーザー作成、ホスト名、ネットワーク確認、SSH強化、ufw設定・AppArmor確認）の各手順が網羅されていること。各設定の目的が説明されていること。確認コマンドと期待する結果が記載されていること。',
        templateFile: 'os_setup_template.xlsx',
      },
    ],
  },

  // ──────────────────────────────────────────────
  // セクション2: ディスク追加（7項目）
  // ddコマンドで仮想ディスクファイルを作成し、losetupでLoopデバイスとして使用します。
  // LVMの操作手順は物理ディスク・EBSボリューム・Loopデバイスで完全に同じです。
  // ──────────────────────────────────────────────
  {
    id: 's2', number: 2, title: 'ディスク追加', clearedKey: INFRA5_PHASE2_CLEARED_KEY,
    tasks: [
      {
        id: 's2-0', sectionId: 's2', index: 11, number: '2-0',
        title: '仮想ディスクの作成',
        objective: 'LVM演習用の仮想ディスクを作成します。ddコマンドで1GBの仮想ディスクファイルを作成し、losetupでループデバイスとして認識させてください。以降のセクション2の演習はこのデバイスに対して行います。',
        hint: 'ddコマンドはif・of・bs・countオプションを使います。losetupコマンドで空きループデバイスを確認できます。lsblkでループデバイスとして認識されているか確認してみてください。',
        verifyCommand: '仮想ディスクファイルが作成されていること・Loopデバイスとして認識されていることの2点を確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: '仮想ディスクファイルが存在し、lsblkでLoopデバイスとして認識されていることが確認できていること。',
      },
      {
        id: 's2-1', sectionId: 's2', index: 12, number: '2-1',
        title: 'パーティション作成',
        objective: '本番環境ではディスク不足が発生してもLVMであればサービスを停止せずにオンラインで拡張できます。この3層構造（PV→VG→LV）を理解することが現場対応の基礎になります。作成したLoopデバイス（/dev/loop*）にパーティションを作成してください。',
        hint: 'ディスクの一覧を確認するコマンドでLoopデバイスのデバイス名を調べてください。fdisk または parted でパーティションを作成する方法を調べてみてください。',
        verifyCommand: '作成したLoopデバイスにパーティションが作成されていることを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: '作成したLoopデバイスにパーティションが認識されていることが確認できていること。',
      },
      {
        id: 's2-2', sectionId: 's2', index: 13, number: '2-2',
        title: 'PV作成',
        objective: '本番環境ではディスク不足が発生してもLVMであればサービスを停止せずにオンラインで拡張できます。この3層構造（PV→VG→LV）を理解することが現場対応の基礎になります。作成したパーティションでPhysical Volume（PV）を作成してください。',
        hint: 'LVMの3層構造（PV→VG→LV）を調べてください。PVを作成するコマンドを --help で確認し、作成後にPV一覧を表示するコマンドで確認してみてください。',
        verifyCommand: '作成したパーティションがPhysical Volumeとして登録されていることを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: '作成したパーティションがPVとして認識されていることが確認できていること。',
      },
      {
        id: 's2-3', sectionId: 's2', index: 14, number: '2-3',
        title: 'VG作成',
        objective: '本番環境ではディスク不足が発生してもLVMであればサービスを停止せずにオンラインで拡張できます。この3層構造（PV→VG→LV）を理解することが現場対応の基礎になります。PVを使用してVolume Group（VG）を作成してください。',
        hint: 'VGを作成するコマンドを調べてください。VGには任意の名前を付けることができます。作成後にVG一覧を表示するコマンドで確認してみてください。',
        verifyCommand: '作成したVolume Groupが登録されていることを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: '作成したVGが認識されており、PVの情報が紐付いていることが確認できていること。',
      },
      {
        id: 's2-4', sectionId: 's2', index: 15, number: '2-4',
        title: 'LV作成',
        objective: '本番環境ではディスク不足が発生してもLVMであればサービスを停止せずにオンラインで拡張できます。この3層構造（PV→VG→LV）を理解することが現場対応の基礎になります。VG内にLogical Volume（LV）を作成してください。',
        hint: 'LVを作成するコマンドを調べてください。VGの容量をすべて使用するオプションがあります。作成後にLV一覧を表示するコマンドで確認してみてください。',
        verifyCommand: '作成したLogical Volumeが登録されていることを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: '作成したLVが認識されており、VGに紐付いていることが確認できていること。',
      },
      {
        id: 's2-5', sectionId: 's2', index: 16, number: '2-5',
        title: 'マウント設定',
        objective: '本番環境ではディスク不足が発生してもLVMであればサービスを停止せずにオンラインで拡張できます。この3層構造（PV→VG→LV）を理解することが現場対応の基礎になります。LVをフォーマットし、マウントポイントを作成してマウントしてください。再起動後も自動マウントされるよう /etc/fstab にも設定してください。',
        hint: 'ファイルシステムを作成するコマンド（mkfs）と、マウントするコマンド（mount）を調べてください。/etc/fstab への追記方法も確認してください。',
        verifyCommand: 'マウントポイントに正しくマウントされていること・/etc/fstabに設定が記載されていることの2点を確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: 'マウントポイントが表示されており、/etc/fstab に永続化設定が記載されていることが確認できていること。',
      },
      {
        id: 's2-6', sectionId: 's2', index: 17, number: '2-6',
        title: '【理解度確認】ディスク追加の手順書作成',
        objective: 'セクション2で実施したディスク追加の手順書をExcelテンプレートに記入して提出してください。LVMの仕組み（PV→VG→LV の3層構造）の説明を含めてください。',
        isReview: true,
        hint: 'LVMを使うメリット（柔軟なサイズ変更など）も含めると良い手順書になります。',
        reviewCriteria: 'LVMの3層構造（PV→VG→LV）が正しく説明されていること。仮想ディスク作成からマウントまでの手順が順序通り記載されていること。/etc/fstab による永続化設定が含まれていること。各確認手順が記載されていること。',
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
        id: 's3-1', sectionId: 's3', index: 18, number: '3-1',
        title: 'apache2インストール',
        objective: 'WebサービスはHTTPサーバーなしには提供できません。現場ではLinuxサーバーにApacheをインストールしてWebサービスを構築する場面が多くあります。Ubuntu に Apache（apache2）をインストールしてください。',
        hint: 'Ubuntuのパッケージ管理コマンドを調べてください。パッケージ名は apache2 です。インストール後にパッケージの状態を確認するコマンドも調べてみてください。',
        verifyCommand: 'apache2パッケージがインストールされていることを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: 'apache2パッケージが正常にインストールされていることが確認できていること。',
      },
      {
        id: 's3-2', sectionId: 's3', index: 19, number: '3-2',
        title: 'apache2.conf設定',
        objective: '障害発生時にログがなければ原因調査ができません。「ログがないから原因不明」は現場では通用しません。ログの出力先・フォーマット・レベルは構築時に必ず設定します。/etc/apache2/apache2.conf を確認し、ログの出力先・フォーマットを把握・必要に応じて変更してください。',
        hint: 'apache2.conf の中で LogFormat、CustomLog、ErrorLog という設定項目を探してください。各設定の意味と役割を調べてみてください。',
        verifyCommand: 'apache2.confのログ設定（出力先・フォーマット）が設定されていることを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: 'apache2.confのログ関連設定（LogFormat・CustomLog・ErrorLog）が設定されていることが確認できていること。',
      },
      {
        id: 's3-3', sectionId: 's3', index: 20, number: '3-3',
        title: 'apache2起動',
        objective: 'Webサーバーをインストールしても起動しなければサービスを提供できません。現場では起動後に必ず動作中であることを確認します。Apacheサービスを起動してください。',
        hint: 'systemctl コマンドでサービスを起動する方法を調べてください。起動後はサービスの動作状態を確認するサブコマンドで状態を確認してみてください。',
        verifyCommand: 'apache2サービスが起動していること・プロセスが動作していることの2点を確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: 'apache2サービスが正常に起動しており、動作中であることが確認できていること。',
      },
      {
        id: 's3-4', sectionId: 's3', index: 21, number: '3-4',
        title: '自動起動設定',
        objective: '自動起動を設定しないと、サーバー再起動のたびにWebサーバーを手動で起動する必要が生じます。インフラの現場では「再起動後も自動でサービスが復旧すること」が当然の要件です。サーバー再起動時にApacheが自動起動するよう設定してください。',
        hint: 'systemctl でサービスの自動起動を有効化するサブコマンドを調べてください。設定後に自動起動が有効かどうかを確認するサブコマンドも確認してみてください。',
        verifyCommand: 'apache2の自動起動が有効に設定されていることを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: 'apache2の自動起動が有効に設定されていることが確認できていること。',
      },
      {
        id: 's3-5', sectionId: 's3', index: 22, number: '3-5',
        title: 'テストページ作成',
        objective: 'Webサーバーが正しくコンテンツを返せるかを確認するため、テスト用ページを作成します。現場でも構築直後に動作確認用コンテンツを配置してから本番コンテンツを置くことがあります。/var/www/html/index.html にテスト用のHTMLファイルを作成してください。',
        hint: 'Apacheのドキュメントルートのパスを apache2.conf で確認し、そこにHTMLファイルを作成してください。',
        verifyCommand: '/var/www/html/index.htmlが存在し、内容が書き込まれていることを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: '/var/www/html/index.html に内容が存在することが確認できていること。',
      },
      {
        id: 's3-6', sectionId: 's3', index: 23, number: '3-6',
        title: 'ブラウザ動作確認',
        objective: 'curlコマンドを使えばブラウザがない環境でもHTTPレスポンスを確認できます。SSHログインしたまま動作確認できることは現場での作業効率に直結します。curlコマンドを使ってApacheのテストページが表示されることを確認してください。',
        hint: 'curl コマンドを使ってローカルからHTTPリクエストを送る方法を調べてください。HTTPステータスコードを確認するオプションも調べてみてください。',
        verifyCommand: 'curlコマンドを使ってHTTPステータスコードとレスポンスボディを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。EC2上で完結できます。',
        successCriteria: 'ApacheへのHTTPリクエストが成功し、正常なレスポンスが返ってきていることが確認できていること。',
      },
      {
        id: 's3-7', sectionId: 's3', index: 24, number: '3-7',
        title: '【理解度確認】apache2設定の手順書作成',
        objective: 'セクション3で実施したapache2設定の手順書をExcelテンプレートに記入して提出してください。Apacheの役割と設定ファイルの構成を含めてください。',
        isReview: true,
        hint: 'なぜWebサーバーが必要か、apache2.conf のどの設定がどの動作を制御するかを説明してください。',
        reviewCriteria: 'インストールから動作確認までの手順が記載されていること。apache2.conf の主要設定（DocumentRoot、ログ設定）が説明されていること。systemctl での起動・自動起動設定が記載されていること。確認方法（curl）が含まれていること。',
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
        id: 's4-1', sectionId: 's4', index: 25, number: '4-1',
        title: 'AIDEインストール',
        objective: 'サーバーへの不正アクセスやマルウェア感染はファイルの改ざんを伴うことが多く、改ざん検知ツールは侵害を早期発見する手段の一つです。AIDE（Advanced Intrusion Detection Environment）をインストールしてください。',
        hint: 'apt でパッケージ名 aide を検索・インストールしてください。インストール後にパッケージの状態を確認するコマンドも調べてみてください。',
        verifyCommand: 'aideパッケージがインストールされていることを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: 'aideパッケージが正常にインストールされていることが確認できていること。',
      },
      {
        id: 's4-2', sectionId: 's4', index: 26, number: '4-2',
        title: 'aide.conf設定',
        objective: '監視対象の範囲が広すぎると初期化に時間がかかり運用負荷が増します。必要なディレクトリだけを監視するよう設定を理解することが重要です。/etc/aide.conf を確認し、監視対象ディレクトリの設定を理解してください。',
        hint: '/etc/aide.conf を開いて、どのディレクトリが監視対象になっているかを確認してください。コメント行（#）以外の行に注目してください。',
        verifyCommand: '/etc/aide.confの有効な設定行（コメント除く）を確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: 'aide.confの有効な設定行が確認でき、監視対象パスが含まれていることが確認できていること。',
      },
      {
        id: 's4-3', sectionId: 's4', index: 27, number: '4-3',
        title: 'データベース作成',
        objective: 'AIDEはファイルのハッシュ値をデータベースに記録し、後から変化を検知します。データベースが作成されていなければ改ざん検知は機能しません。aide --init コマンドで初期データベースを作成し、本番用にリネームしてください。',
        hint: 'aide --init を実行してデータベースファイルを生成します。生成されたファイル名と本番用ファイル名の違いを調べてください（aide.db.new.gz → aide.db.gz）。',
        verifyCommand: '/var/lib/aide/ディレクトリにデータベースファイルが存在することを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: '/var/lib/aide/ にデータベースファイル（aide.db.gz または aide.db）が存在していることが確認できていること。',
      },
      {
        id: 's4-4', sectionId: 's4', index: 28, number: '4-4',
        title: '動作確認',
        objective: '改ざん検知は「検知して終わり」ではありません。検知後に何をすべきか（影響範囲の特定・原因調査・復旧・再発防止）まで考えることが現場では求められます。テスト用にファイルを変更し、aide --check コマンドで改ざんが検知されることを確認してください。改ざんを検知した後の対応手順も合わせて記録してください。',
        hint: '監視対象ディレクトリ（/etc など）にテストファイルを作成・変更してから aide --check を実行してください。変更が報告される内容を確認してください。',
        verifyCommand: 'aide --checkを実行してファイル変更が検知されていること・検知された変更内容の末尾を確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: 'ファイルへの変更がAIDEによって検知されており、変更内容がレポートに表示されていることが確認できていること。',
      },
      {
        id: 's4-5', sectionId: 's4', index: 29, number: '4-5',
        title: 'cron自動実行設定',
        objective: '改ざん検知は定期的に実行して初めて意味があります。手動実行に頼るとチェックが漏れる場合があり、侵害の発見が遅れます。AIDE の定期チェックを cron に登録してください。',
        hint: 'crontab -e でcronジョブを編集する方法を調べてください。日次実行の cron 書式を確認してください。',
        verifyCommand: 'aideの定期実行がcronに登録されていることを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: 'aide --checkを実行するcronエントリが登録されていることが確認できていること。',
      },
      {
        id: 's4-6', sectionId: 's4', index: 30, number: '4-6',
        title: '【理解度確認】AIDE設定の手順書作成',
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
        id: 's5-1', sectionId: 's5', index: 31, number: '5-1',
        title: 'PostgreSQLインストール',
        objective: 'データを永続的に保存・管理するためのRDBMSは多くのシステムで必須のコンポーネントです。インストールと初期設定を正しく行わないと、後続のアプリケーション構築に支障をきたします。apt を使って PostgreSQL をインストールしてください。',
        hint: 'apt でパッケージ名 postgresql を調べてください。Ubuntuではインストールと同時にDBクラスターの初期化も行われます。インストール後にパッケージ状態を確認するコマンドを調べてみてください。',
        verifyCommand: 'postgresqlパッケージがインストールされていることを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: 'postgresqlパッケージが正常にインストールされていることが確認できていること。',
      },
      {
        id: 's5-2', sectionId: 's5', index: 32, number: '5-2',
        title: 'PostgreSQL設定確認',
        objective: 'PostgreSQLの設定ファイルの場所を把握していないと、後続の設定変更作業で迷います。現場ではインストール直後に設定ファイルの場所と構成を確認することが基本です。PostgreSQLの設定ファイルが存在することを確認してください。',
        hint: 'Ubuntuではapt installと同時にDBクラスターが初期化されます。ls コマンドで /etc/postgresql/ ディレクトリを確認してください。バージョンごとのサブディレクトリ構成になっています。',
        verifyCommand: '/etc/postgresql/配下の設定ファイルの構成を確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: '/etc/postgresql/ にバージョンディレクトリと設定ファイルが存在していることが確認できていること。',
      },
      {
        id: 's5-3', sectionId: 's5', index: 33, number: '5-3',
        title: 'PostgreSQL起動',
        objective: 'DBサービスが起動していなければアプリケーションはデータベースに接続できません。起動後に必ず動作中であることを確認するのが現場の基本手順です。PostgreSQL サービスを起動してください。',
        hint: 'systemctl でサービスを起動する方法は他のサービスと同じです。サービス名を確認し、起動後は動作状態を確認するサブコマンドで確認してみてください。',
        verifyCommand: 'PostgreSQLサービスが起動していること・ポートがリッスンされていることの2点を確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: 'PostgreSQLサービスが正常に起動しており、動作中であることが確認できていること。',
      },
      {
        id: 's5-4', sectionId: 's5', index: 34, number: '5-4',
        title: '自動起動設定',
        objective: '自動起動が設定されていないと、サーバー再起動のたびにDBサービスが停止した状態になります。アプリケーションが依存するDBサービスの自動起動設定は必須要件です。サーバー再起動時にPostgreSQLが自動起動するよう設定してください。',
        hint: 'systemctl enable コマンドを使います。他のセクションで実施した手順と同じです。設定後に自動起動が有効か確認するコマンドも確認してみてください。',
        verifyCommand: 'PostgreSQLの自動起動が有効に設定されていることを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: 'PostgreSQLの自動起動が有効に設定されていることが確認できていること。',
      },
      {
        id: 's5-5', sectionId: 's5', index: 35, number: '5-5',
        title: 'ユーザー作成',
        objective: '本番データベースではデフォルトの管理者アカウント（postgres）を直接使わず、用途に応じたユーザーを作成します。アクセス権限を適切に管理するためのユーザー管理は現場での基本です。psql コマンドで neos という名前のスーパーユーザーを作成し、パスワードを設定してください。',
        hint: 'postgres ユーザーとして psql を実行する方法を調べてください。SQL の CREATE USER 文の書き方も確認してください。',
        verifyCommand: 'neosユーザーが作成されており、Superuser権限が付与されていることを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: 'neosユーザーが作成されており、Superuser権限が付与されていることが確認できていること。',
      },
      {
        id: 's5-6', sectionId: 's5', index: 36, number: '5-6',
        title: 'DB作成',
        objective: 'DB名・ユーザー名の命名はプロジェクトの規約に従います。この演習では自分でDB名を決めて作成してください。以降のタスクはこの自分で決めたDB名を使い続けます。neos ユーザーが所有するデータベースを作成してください。',
        hint: 'createdb コマンドまたは SQL の CREATE DATABASE 文でデータベースを作成できます。オーナーを指定するオプションを調べてください。',
        verifyCommand: '作成したデータベースが存在し、Ownerがneosになっていることを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: '作成したデータベースが一覧に表示され、Owner が neos になっていることが確認できていること。',
      },
      {
        id: 's5-7', sectionId: 's5', index: 37, number: '5-7',
        title: 'テーブル作成',
        objective: 'テーブル設計はデータモデリングの基礎です。適切なテーブルがなければデータの保存も検索もできません。現場では必要なテーブルを定義してから開発を進めます。作成したデータベースに接続し、テスト用テーブルを作成してください。',
        hint: 'psqlで特定のDBに接続するには -d オプションを使います。CREATE TABLE 文の書き方も確認してください。作成後にテーブル一覧を表示するメタコマンドで確認してみてください。',
        verifyCommand: '自分で作成したデータベースに接続し、テーブルが作成されていることを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: '作成したデータベース内にテーブルが存在していることが確認できていること。',
      },
      {
        id: 's5-8', sectionId: 's5', index: 38, number: '5-8',
        title: 'テーブル削除',
        objective: '不要なテーブルを削除することはDB管理の基本操作です。誤ったテーブルを削除しないよう確認してから実行する習慣をつけることが重要です。作成したテーブルを削除してください。',
        hint: 'SQL の DROP TABLE 文の書き方を調べてください。削除後にテーブル一覧が空になることで確認できます。',
        verifyCommand: '自分で作成したデータベースに接続し、テーブルが削除されていることを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: '対象テーブルが削除されており、データベース内にテーブルが存在しないことが確認できていること。',
      },
      {
        id: 's5-9', sectionId: 's5', index: 39, number: '5-9',
        title: 'DB削除',
        objective: '不要なデータベースを削除することはリソース管理の基本です。削除後にデフォルトのDBのみが残っていることを確認することで、クリーンな状態を保てます。作成したデータベースを削除してください。',
        hint: 'dropdb コマンドまたは SQL の DROP DATABASE 文でデータベースを削除できます。削除後にデータベース一覧で確認してみてください。',
        verifyCommand: '作成したデータベースが削除されており、デフォルトのDBのみが残っていることを確認するコマンドを自分で考えて実行し、結果を貼り付けてください。',
        successCriteria: '作成したデータベースが削除され、デフォルトのDB（template0/template1/postgres）のみが残っていることが確認できていること。',
      },
      {
        id: 's5-10', sectionId: 's5', index: 40, number: '5-10',
        title: '【理解度確認】PostgreSQL設定の手順書作成',
        objective: 'セクション5で実施したPostgreSQL設定の手順書をExcelテンプレートに記入して提出してください。RDBMSの基本概念と運用手順を含めてください。',
        isReview: true,
        hint: 'PostgreSQLをインストールして使えるようにするまでの一連の流れを、「なぜその手順が必要か」を添えて説明してください。',
        reviewCriteria: 'インストールから基本操作（DB/ユーザー/テーブル作成・削除）までの手順が記載されていること。DBクラスター初期化の役割が説明されていること。ユーザー管理（SUPERUSER）が含まれていること。自動起動設定が記載されていること。',
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
