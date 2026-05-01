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
  { id: 'q04', prompt: 'apache2のアクセスログ（/var/log/apache2/access.log）をリアルタイムで追いかけるには？', choices: ['tail -f /var/log/apache2/access.log'], correctIndex: 0, alternatives: ['tail --follow /var/log/apache2/access.log'] },
  { id: 'q05', prompt: 'カレントディレクトリにあるerror.logからFATALを含む行だけ抽出するには？', choices: ['grep FATAL error.log'], correctIndex: 0 },
  { id: 'q06', prompt: 'deploy.sh に実行権限を付与するには？', choices: ['chmod +x deploy.sh'], correctIndex: 0, alternatives: ['chmod u+x deploy.sh', 'chmod a+x deploy.sh'] },
  { id: 'q07', prompt: '/var/www/html/index.html の所有者を user に変更するには？', choices: ['chown user /var/www/html/index.html'], correctIndex: 0 },
  { id: 'q08', prompt: 'ディスクの使用量を人が読みやすい形式で確認するには？', choices: ['df -h'], correctIndex: 0 },
  { id: 'q09', prompt: '/etc以下の.confファイルを全て検索するには？', choices: ['find /etc -name "*.conf"'], correctIndex: 0 },
  { id: 'q10', prompt: '定期実行の設定を編集するには？', choices: ['crontab -e'], correctIndex: 0 },

  // 第2部: サーバ構築必須 (q11–q20)
  { id: 'q11', prompt: 'apache2をインストールするには？（Ubuntu・sudo権限が必要）', choices: ['apt install apache2 -y'], correctIndex: 0, alternatives: ['apt install apache2'] },
  { id: 'q12', prompt: 'apache2を今すぐ起動するには？', choices: ['systemctl start apache2'], correctIndex: 0 },
  { id: 'q13', prompt: 'apache2をOS再起動後も自動起動するよう設定するには？', choices: ['systemctl enable apache2'], correctIndex: 0 },
  { id: 'q14', prompt: 'apache2が動いているか確認するには？', choices: ['systemctl status apache2'], correctIndex: 0 },
  { id: 'q15', prompt: 'apache2を停止するには？', choices: ['systemctl stop apache2'], correctIndex: 0 },
  { id: 'q16', prompt: 'ポート80で待ち受けているプロセスを確認するには？', choices: ['ss -tlnp | grep 80'], correctIndex: 0, alternatives: ['ss -ltnp | grep 80', 'ss -tlnp | grep :80', 'ss -ltnp | grep :80'] },
  { id: 'q17', prompt: 'ufwでポート80（http）を許可するには？（sudo権限が必要）', choices: ['ufw allow 80'], correctIndex: 0, alternatives: ['ufw allow http'] },
  { id: 'q18', prompt: 'ufwの設定を反映するには？（sudo権限が必要）', choices: ['ufw reload'], correctIndex: 0 },
  { id: 'q19', prompt: 'システムのエラーログをリアルタイムで確認するには？', choices: ['journalctl -f'], correctIndex: 0, alternatives: ['journalctl --follow'] },
  { id: 'q20', prompt: '動いているプロセスのCPU・メモリ使用率をリアルタイムで確認するには？', choices: ['top'], correctIndex: 0 },

  // 第3部: 実践問題 (q21–q30)
  { id: 'q21', prompt: 'apache2が起動している状態で、localhostにHTTPリクエストを送りレスポンスヘッダーのみを確認するには？', choices: ['curl -I http://localhost'], correctIndex: 0, alternatives: ['curl -I localhost'] },
  { id: 'q22', prompt: 'apache2が起動しない。ログを確認するには？', choices: ['journalctl -u apache2'], correctIndex: 0, alternatives: ['journalctl --unit=apache2', 'journalctl --unit apache2'] },
  { id: 'q23', prompt: '/etc/apache2/apache2.confをviで開くには？', choices: ['vi /etc/apache2/apache2.conf'], correctIndex: 0 },
  { id: 'q24', prompt: 'viで挿入モードに切り替えるには？', choices: ['i'], correctIndex: 0 },
  { id: 'q25', prompt: 'viで開いたファイルを保存して閉じるには？', choices: [':wq'], correctIndex: 0, alternatives: [':x', 'ZZ'] },
  { id: 'q26', prompt: 'viで編集中に保存せず強制終了するには？', choices: [':q!'], correctIndex: 0, alternatives: ['ZQ'] },
  { id: 'q27', prompt: 'viで開いたファイル内でListenという文字列を検索するには？', choices: ['/Listen'], correctIndex: 0 },
  { id: 'q28', prompt: 'ユーザー名neos-training、IP 203.0.113.1のサーバーへSSH接続するには？', choices: ['ssh neos-training@203.0.113.1'], correctIndex: 0, alternatives: ['ssh -l neos-training 203.0.113.1'] },
  { id: 'q29', prompt: 'ローカルのindex.htmlをIP 203.0.113.1のサーバーの/var/www/html/へ転送するには？', choices: ['scp index.html neos-training@203.0.113.1:/var/www/html/'], correctIndex: 0 },
  { id: 'q30', prompt: 'apache2を再起動して設定を反映するには？', choices: ['systemctl restart apache2'], correctIndex: 0 },
]

export const L1_CLEARED_KEY = 'kira-training-l1-cleared'
export const L1_PROGRESS_KEY = 'kira-training-l1-progress'
