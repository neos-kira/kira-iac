export type QuizQuestion = {
  id: string
  prompt: string
  choices: string[]
  correctIndex: number
}

export const LINUX_LEVEL1_QUESTIONS: QuizQuestion[] = [
  { id: 'q01', prompt: '現在の作業ディレクトリを表示するコマンドはどれ？', choices: ['ls', 'pwd', 'cd', 'whoami'], correctIndex: 1 },
  { id: 'q02', prompt: 'ディレクトリ内のファイル一覧を表示する基本コマンドは？', choices: ['cat', 'ls', 'mv', 'touch'], correctIndex: 1 },
  { id: 'q03', prompt: 'ホームディレクトリへ移動するコマンドは？', choices: ['cd ~', 'cd /', 'cd ..', 'cd ./home'], correctIndex: 0 },
  { id: 'q04', prompt: '1つ上のディレクトリへ移動するコマンドは？', choices: ['cd /', 'cd ..', 'cd -', 'cd .'], correctIndex: 1 },
  { id: 'q05', prompt: '空のファイル memo.txt を作成するコマンドは？', choices: ['mkdir memo.txt', 'touch memo.txt', 'cat memo.txt', 'cp memo.txt'], correctIndex: 1 },
  { id: 'q06', prompt: 'ディレクトリ logs を作成するコマンドは？', choices: ['touch logs', 'mkdir logs', 'mk logs', 'newdir logs'], correctIndex: 1 },
  { id: 'q07', prompt: 'ファイルを別名でコピーするコマンドは？（a.txt → b.txt）', choices: ['mv a.txt b.txt', 'cp a.txt b.txt', 'ln a.txt b.txt', 'cat a.txt > b.txt'], correctIndex: 1 },
  { id: 'q08', prompt: 'ファイル名を変更（リネーム）するコマンドは？（a.txt → b.txt）', choices: ['cp a.txt b.txt', 'mv a.txt b.txt', 'rm a.txt b.txt', 'rename a.txt b.txt'], correctIndex: 1 },
  { id: 'q09', prompt: 'ファイルを削除するコマンドは？', choices: ['rm', 'rmdir', 'del', 'erase'], correctIndex: 0 },
  { id: 'q10', prompt: '空のディレクトリ tmp を削除するコマンドは？', choices: ['rm tmp', 'rmdir tmp', 'delete tmp', 'mv tmp /dev/null'], correctIndex: 1 },
  { id: 'q11', prompt: 'ファイルの内容を表示するコマンドは？（短いファイル想定）', choices: ['cat', 'ls', 'pwd', 'echo'], correctIndex: 0 },
  { id: 'q12', prompt: 'ファイルをページャで表示する代表的コマンドは？', choices: ['less', 'more', 'page', 'show'], correctIndex: 0 },
  { id: 'q13', prompt: 'ファイルの先頭10行を表示するコマンドは？', choices: ['head', 'tail', 'top', 'first'], correctIndex: 0 },
  { id: 'q14', prompt: 'ファイルの末尾10行を表示するコマンドは？', choices: ['head', 'tail', 'end', 'last'], correctIndex: 1 },
  { id: 'q15', prompt: 'tail -f の主な用途は？', choices: ['ファイルを削除する', 'ファイルを圧縮する', 'ログなどの追記をリアルタイムに追いかける', '権限を変更する'], correctIndex: 2 },
  { id: 'q16', prompt: 'コマンドのマニュアルを見るコマンドは？', choices: ['help', 'man', 'manual', 'info'], correctIndex: 1 },
  { id: 'q17', prompt: '管理者権限でコマンドを実行するときによく使うのは？', choices: ['root', 'sudo', 'admin', 'su -p'], correctIndex: 1 },
  { id: 'q18', prompt: '現在のユーザー名を表示するコマンドは？', choices: ['whoami', 'id', 'user', 'uname'], correctIndex: 0 },
  { id: 'q19', prompt: 'ファイルの権限を変更するコマンドは？', choices: ['chown', 'chmod', 'chgrp', 'umask'], correctIndex: 1 },
  { id: 'q20', prompt: 'ファイルの所有者を変更するコマンドは？', choices: ['chmod', 'chown', 'chgrp', 'own'], correctIndex: 1 },
  { id: 'q21', prompt: 'ファイル内から文字列を検索する代表コマンドは？', choices: ['find', 'grep', 'search', 'locate'], correctIndex: 1 },
  { id: 'q22', prompt: 'ファイルを検索するコマンドとして代表的なのは？（パス配下）', choices: ['find', 'grep', 'where', 'scan'], correctIndex: 0 },
  { id: 'q23', prompt: '標準出力をファイルに上書きリダイレクトする演算子は？', choices: ['>>', '>', '<', '|'], correctIndex: 1 },
  { id: 'q24', prompt: '標準出力をファイルに追記する演算子は？', choices: ['>>', '>', '<', '||'], correctIndex: 0 },
  { id: 'q25', prompt: 'コマンド同士をパイプでつなぐ演算子は？', choices: ['|', '>', '&&', '::'], correctIndex: 0 },
  { id: 'q26', prompt: 'プロセス一覧を表示する代表コマンドは？', choices: ['ps', 'proc', 'top', 'jobs'], correctIndex: 0 },
  { id: 'q27', prompt: '動いているプロセスを PID 指定で終了する代表コマンドは？', choices: ['stop', 'kill', 'end', 'terminate'], correctIndex: 1 },
  { id: 'q28', prompt: 'ネットワーク疎通確認（ICMP）で使う代表コマンドは？', choices: ['ping', 'curl', 'ssh', 'telnet'], correctIndex: 0 },
  { id: 'q29', prompt: 'HTTP リクエストを送ってレスポンスを確認する代表コマンドは？', choices: ['curl', 'ping', 'ps', 'cat'], correctIndex: 0 },
  { id: 'q30', prompt: '環境変数を表示するコマンドとして代表的なのは？', choices: ['env', 'var', 'export -l', 'setenv'], correctIndex: 0 },
]

export const L1_CLEARED_KEY = 'kira-training-l1-cleared'
export const L1_PROGRESS_KEY = 'kira-training-l1-progress'
