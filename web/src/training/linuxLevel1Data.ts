export type QuizQuestion = {
  id: string
  prompt: string
  choices: string[]   // choices[correctIndex] が正解コマンド
  correctIndex: number
}

export const LINUX_LEVEL1_QUESTIONS: QuizQuestion[] = [
  // 第1部: 基本操作 (q01–q10)
  { id: 'q01', prompt: 'ホームディレクトリの絶対パスを1コマンドで確認するには？', choices: ['echo $HOME'], correctIndex: 0 },
  { id: 'q02', prompt: '/var/log以下のファイルを更新日時順（新しい順）で表示するには？', choices: ['ls -lt /var/log'], correctIndex: 0 },
  { id: 'q03', prompt: '/tmp/workディレクトリを絶対パスで作成するには？', choices: ['mkdir /tmp/work'], correctIndex: 0 },
  { id: 'q04', prompt: 'access.logの最後100行をリアルタイムで追いかけるには？', choices: ['tail -f -n 100 access.log'], correctIndex: 0 },
  { id: 'q05', prompt: 'error.logからFATALを含む行だけ抽出するには？', choices: ['grep FATAL error.log'], correctIndex: 0 },
  { id: 'q06', prompt: 'config.confのバックアップをconfig.conf.bakとして同じディレクトリに作るには？', choices: ['cp config.conf config.conf.bak'], correctIndex: 0 },
  { id: 'q07', prompt: '現在ログイン中のユーザーと所属グループを確認するには？', choices: ['id'], correctIndex: 0 },
  { id: 'q08', prompt: '/etc/hostsの内容をページをめくって確認するには？', choices: ['less /etc/hosts'], correctIndex: 0 },
  { id: 'q09', prompt: '/etc以下の.confファイルを全て検索するには？', choices: ['find /etc -name "*.conf"'], correctIndex: 0 },
  { id: 'q10', prompt: 'コマンドの実行結果とエラーを両方out.logに書き出すには？', choices: ['コマンド > out.log 2>&1'], correctIndex: 0 },

  // 第2部: サーバ構築必須 (q11–q20)
  { id: 'q11', prompt: 'httpdをインストールするには？（Amazon Linux 2023）', choices: ['dnf install httpd -y'], correctIndex: 0 },
  { id: 'q12', prompt: 'httpdを今すぐ起動するには？', choices: ['systemctl start httpd'], correctIndex: 0 },
  { id: 'q13', prompt: 'httpdをOS再起動後も自動起動するよう設定するには？', choices: ['systemctl enable httpd'], correctIndex: 0 },
  { id: 'q14', prompt: 'httpdが動いているか確認するには？', choices: ['systemctl status httpd'], correctIndex: 0 },
  { id: 'q15', prompt: 'httpdを停止するには？', choices: ['systemctl stop httpd'], correctIndex: 0 },
  { id: 'q16', prompt: 'ポート80で待ち受けているプロセスを確認するには？', choices: ['ss -tlnp | grep 80'], correctIndex: 0 },
  { id: 'q17', prompt: 'firewalldでhttpを許可するには？', choices: ['firewall-cmd --add-service=http --permanent'], correctIndex: 0 },
  { id: 'q18', prompt: 'firewalldの設定を反映するには？', choices: ['firewall-cmd --reload'], correctIndex: 0 },
  { id: 'q19', prompt: 'システムのエラーログをリアルタイムで確認するには？', choices: ['journalctl -f'], correctIndex: 0 },
  { id: 'q20', prompt: '現在のファイアウォールの許可サービス一覧を確認するには？', choices: ['firewall-cmd --list-services'], correctIndex: 0 },

  // 第3部: 実践問題 (q21–q30)
  { id: 'q21', prompt: 'Webサーバを構築したがブラウザから繋がらない。ポートが開いているか確認するには？', choices: ['ss -tlnp | grep 80'], correctIndex: 0 },
  { id: 'q22', prompt: 'httpdが起動しない。ログを確認するには？', choices: ['journalctl -u httpd'], correctIndex: 0 },
  { id: 'q23', prompt: '/etc/httpd/conf/httpd.confをviで開くには？', choices: ['vi /etc/httpd/conf/httpd.conf'], correctIndex: 0 },
  { id: 'q24', prompt: 'viで開いたファイルを保存して閉じるには？', choices: [':wq'], correctIndex: 0 },
  { id: 'q25', prompt: 'viで編集中に保存せず強制終了するには？', choices: [':q!'], correctIndex: 0 },
  { id: 'q26', prompt: 'httpd.conf内でListenという文字列が含まれる行を確認するには？', choices: ['grep Listen /etc/httpd/conf/httpd.conf'], correctIndex: 0 },
  { id: 'q27', prompt: 'サーバ再起動後にhttpdが自動起動するか確認するには？', choices: ['systemctl is-enabled httpd'], correctIndex: 0 },
  { id: 'q28', prompt: 'ユーザー名neos-training、IP 192.168.1.1のサーバへSSH接続するには？', choices: ['ssh neos-training@192.168.1.1'], correctIndex: 0 },
  { id: 'q29', prompt: 'ローカルのindex.htmlをサーバの/var/www/html/へ転送するには？', choices: ['scp index.html neos-training@192.168.1.1:/var/www/html/'], correctIndex: 0 },
  { id: 'q30', prompt: 'httpdを再起動して設定を反映するには？', choices: ['systemctl restart httpd'], correctIndex: 0 },
]

export const L1_CLEARED_KEY = 'kira-training-l1-cleared'
export const L1_PROGRESS_KEY = 'kira-training-l1-progress'
