export type QuizQuestion = {
  id: string
  prompt: string
  choices: string[]   // choices[correctIndex] が正解コマンド
  correctIndex: number
  alternatives?: string[]  // 追加の正解パターン（採点時にいずれかにマッチすれば正解）
}

export const LINUX_LEVEL1_QUESTIONS: QuizQuestion[] = [
  // 第1部: 基本操作 (q01–q10)
  { id: 'q01', prompt: '現在いるディレクトリの絶対パスを確認するには？', choices: ['pwd'], correctIndex: 0 },
  { id: 'q02', prompt: '/var/log以下のファイルを更新日時順（新しい順）で表示するには？', choices: ['ls -lt /var/log'], correctIndex: 0, alternatives: ['ls -tl /var/log'] },
  { id: 'q03', prompt: '/tmp/workディレクトリを絶対パスで作成するには？', choices: ['mkdir /tmp/work'], correctIndex: 0 },
  { id: 'q04', prompt: 'httpdのアクセスログ（/var/log/httpd/access_log）をリアルタイムで追いかけるには？', choices: ['tail -f /var/log/httpd/access_log'], correctIndex: 0, alternatives: ['tail --follow /var/log/httpd/access_log'] },
  { id: 'q05', prompt: 'error.logからFATALを含む行だけ抽出するには？', choices: ['grep FATAL error.log'], correctIndex: 0 },
  { id: 'q06', prompt: 'deploy.sh に実行権限を付与するには？', choices: ['chmod +x deploy.sh'], correctIndex: 0, alternatives: ['chmod u+x deploy.sh', 'chmod a+x deploy.sh'] },
  { id: 'q07', prompt: '/var/www/html/index.html の所有者を user に変更するには？', choices: ['chown user /var/www/html/index.html'], correctIndex: 0 },
  { id: 'q08', prompt: 'ディスクの使用量を人が読みやすい形式で確認するには？', choices: ['df -h'], correctIndex: 0 },
  { id: 'q09', prompt: '/etc以下の.confファイルを全て検索するには？', choices: ['find /etc -name "*.conf"'], correctIndex: 0 },
  { id: 'q10', prompt: '定期実行の設定を編集するには？', choices: ['crontab -e'], correctIndex: 0 },

  // 第2部: サーバ構築必須 (q11–q20)
  { id: 'q11', prompt: 'httpdをインストールするには？（Rocky Linux 9）', choices: ['dnf install httpd -y'], correctIndex: 0, alternatives: ['yum install httpd', 'yum install httpd -y'] },
  { id: 'q12', prompt: 'httpdを今すぐ起動するには？', choices: ['systemctl start httpd'], correctIndex: 0 },
  { id: 'q13', prompt: 'httpdをOS再起動後も自動起動するよう設定するには？', choices: ['systemctl enable httpd'], correctIndex: 0 },
  { id: 'q14', prompt: 'httpdが動いているか確認するには？', choices: ['systemctl status httpd'], correctIndex: 0 },
  { id: 'q15', prompt: 'httpdを停止するには？', choices: ['systemctl stop httpd'], correctIndex: 0 },
  { id: 'q16', prompt: 'ポート80で待ち受けているプロセスを確認するには？', choices: ['ss -tlnp | grep 80'], correctIndex: 0, alternatives: ['ss -ltnp | grep 80', 'ss -tlnp | grep :80', 'ss -ltnp | grep :80'] },
  { id: 'q17', prompt: 'firewalldでhttpを許可するには？', choices: ['firewall-cmd --add-service=http --permanent'], correctIndex: 0, alternatives: ['firewall-cmd --permanent --add-service=http'] },
  { id: 'q18', prompt: 'firewalldの設定を反映するには？', choices: ['firewall-cmd --reload'], correctIndex: 0 },
  { id: 'q19', prompt: 'システムのエラーログをリアルタイムで確認するには？', choices: ['journalctl -f'], correctIndex: 0, alternatives: ['journalctl --follow'] },
  { id: 'q20', prompt: '動いているプロセスの一覧をCPU使用率順に確認するには？', choices: ['ps aux --sort=-%cpu'], correctIndex: 0, alternatives: ['ps -aux --sort=-%cpu', 'ps aux --sort -%cpu'] },

  // 第3部: 実践問題 (q21–q30)
  { id: 'q21', prompt: '演習サーバー（localhost）にHTTPリクエストを送って応答を確認するには？', choices: ['curl -I http://localhost'], correctIndex: 0, alternatives: ['curl http://localhost'] },
  { id: 'q22', prompt: 'httpdが起動しない。ログを確認するには？', choices: ['journalctl -u httpd'], correctIndex: 0, alternatives: ['journalctl --unit=httpd', 'journalctl --unit httpd'] },
  { id: 'q23', prompt: '/etc/httpd/conf/httpd.confをviで開くには？', choices: ['vi /etc/httpd/conf/httpd.conf'], correctIndex: 0 },
  { id: 'q24', prompt: 'viで開いたファイルを保存して閉じるには？', choices: [':wq'], correctIndex: 0, alternatives: [':x', 'ZZ'] },
  { id: 'q25', prompt: 'viで編集中に保存せず強制終了するには？', choices: [':q!'], correctIndex: 0, alternatives: ['ZQ'] },
  { id: 'q26', prompt: 'httpd.conf内でListenという文字列が含まれる行を確認するには？', choices: ['grep Listen /etc/httpd/conf/httpd.conf'], correctIndex: 0 },
  { id: 'q27', prompt: 'viで挿入モードに切り替えるには？', choices: ['i'], correctIndex: 0 },
  { id: 'q28', prompt: 'ユーザー名neos-training、IP 192.168.1.1のサーバへSSH接続するには？', choices: ['ssh neos-training@192.168.1.1'], correctIndex: 0, alternatives: ['ssh -l neos-training 192.168.1.1'] },
  { id: 'q29', prompt: 'ローカルのindex.htmlをサーバの/var/www/html/へ転送するには？', choices: ['scp index.html neos-training@192.168.1.1:/var/www/html/'], correctIndex: 0 },
  { id: 'q30', prompt: 'httpdを再起動して設定を反映するには？', choices: ['systemctl restart httpd'], correctIndex: 0 },
]

export const L1_CLEARED_KEY = 'kira-training-l1-cleared'
export const L1_PROGRESS_KEY = 'kira-training-l1-progress'
