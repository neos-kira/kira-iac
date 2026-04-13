const ExcelJS = require('exceljs');
const path = require('path');

async function createProfessionalTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NIC Platform';
  workbook.created = new Date();

  // 共通スタイル
  const headerGreen = { argb: 'FF4CAF50' };
  const lightGreen = { argb: 'FFC8E6C9' };
  const veryLightGreen = { argb: 'FFE8F5E9' };
  const headerRed = { argb: 'FFF44336' };
  const white = { argb: 'FFFFFFFF' };

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  // =====================================
  // シート1: 表紙
  // =====================================
  const coverSheet = workbook.addWorksheet('表紙', {
    pageSetup: { orientation: 'portrait', paperSize: 9 },
  });

  // 列幅設定
  coverSheet.columns = [
    { width: 5 },   // A
    { width: 20 },  // B
    { width: 35 },  // C
    { width: 5 },   // D
    { width: 5 },   // E
    { width: 5 },   // F
    { width: 5 },   // G
    { width: 5 },   // H
    { width: 5 },   // I
    { width: 5 },   // J
    { width: 5 },   // K
  ];

  // タイトル
  coverSheet.mergeCells('A4:K4');
  const titleCell = coverSheet.getCell('A4');
  titleCell.value = 'EC2サーバー構築手順書';
  titleCell.font = { size: 20, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // ドキュメント情報テーブル
  const docInfo = [
    ['ドキュメントID', ''],
    ['バージョン', '1.0'],
    ['作成日', ''],
    ['作成者', ''],
    ['対象システム', 'EC2サーバー構築演習'],
    ['対象サーバー', ''],
  ];

  let row = 6;
  docInfo.forEach(([label, value]) => {
    const labelCell = coverSheet.getCell(`B${row}`);
    const valueCell = coverSheet.getCell(`C${row}`);

    labelCell.value = label;
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: veryLightGreen };
    labelCell.border = thinBorder;
    labelCell.font = { bold: true };
    labelCell.alignment = { vertical: 'middle' };

    valueCell.value = value;
    valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: white };
    valueCell.border = thinBorder;
    valueCell.alignment = { vertical: 'middle' };

    row++;
  });

  // 承認欄テーブル
  row = 14;
  coverSheet.getCell(`B${row}`).value = '承認欄';
  coverSheet.getCell(`B${row}`).font = { bold: true };
  row++;

  const approvalHeaders = ['役割', '氏名', '日付'];
  approvalHeaders.forEach((header, i) => {
    const col = String.fromCharCode(66 + i); // B, C, D
    const cell = coverSheet.getCell(`${col}${row}`);
    cell.value = header;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: headerGreen };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    cell.border = thinBorder;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  // D列の幅を調整
  coverSheet.getColumn('D').width = 15;

  row++;
  const approvalRoles = ['作成', '確認', '承認'];
  approvalRoles.forEach((role) => {
    ['B', 'C', 'D'].forEach((col, i) => {
      const cell = coverSheet.getCell(`${col}${row}`);
      cell.value = i === 0 ? role : '';
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle' };
      if (i === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: veryLightGreen };
      }
    });
    row++;
  });

  // =====================================
  // シート2: 改訂履歴
  // =====================================
  const historySheet = workbook.addWorksheet('改訂履歴', {
    pageSetup: { orientation: 'portrait', paperSize: 9 },
  });

  historySheet.columns = [
    { width: 10, key: 'version' },
    { width: 15, key: 'date' },
    { width: 15, key: 'author' },
    { width: 60, key: 'content' },
  ];

  // ヘッダー
  const historyHeaders = ['版数', '改訂日', '改訂者', '改訂内容'];
  historyHeaders.forEach((header, i) => {
    const cell = historySheet.getCell(1, i + 1);
    cell.value = header;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: headerGreen };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    cell.border = thinBorder;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // サンプルデータ
  const historyData = [
    ['1.0', '', '', '初版作成'],
    ['', '', '', ''],
    ['', '', '', ''],
  ];
  historyData.forEach((rowData, rowIndex) => {
    rowData.forEach((value, colIndex) => {
      const cell = historySheet.getCell(rowIndex + 2, colIndex + 1);
      cell.value = value;
      cell.border = thinBorder;
    });
  });

  // =====================================
  // シート3: 前提条件
  // =====================================
  const prereqSheet = workbook.addWorksheet('前提条件', {
    pageSetup: { orientation: 'portrait', paperSize: 9 },
  });

  prereqSheet.columns = [
    { width: 5, key: 'no' },
    { width: 20, key: 'category' },
    { width: 50, key: 'item' },
    { width: 40, key: 'note' },
  ];

  // タイトル
  prereqSheet.getCell('A1').value = '前提条件';
  prereqSheet.getCell('A1').font = { size: 14, bold: true };

  // ヘッダー
  const prereqHeaders = ['No.', '分類', '項目', '備考'];
  prereqHeaders.forEach((header, i) => {
    const cell = prereqSheet.getCell(3, i + 1);
    cell.value = header;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: headerGreen };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    cell.border = thinBorder;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // サンプルデータ
  const prereqData = [
    ['1', '作業環境', 'OS: Amazon Linux 2023', ''],
    ['2', '作業環境', 'インスタンスタイプ: t2.micro以上', ''],
    ['3', '必要権限', 'SSH接続権限', '秘密鍵を事前に取得'],
    ['4', '必要権限', 'sudo権限', ''],
    ['5', '事前準備', 'EC2インスタンスが起動していること', ''],
    ['6', '事前準備', 'セキュリティグループでSSH(22)、HTTP(80)が許可されていること', ''],
    ['7', '確認事項', '対象サーバーのパブリックIPアドレス', ''],
    ['8', '確認事項', 'SSH接続ユーザー名', '通常は ec2-user'],
  ];
  prereqData.forEach((rowData, rowIndex) => {
    rowData.forEach((value, colIndex) => {
      const cell = prereqSheet.getCell(rowIndex + 4, colIndex + 1);
      cell.value = value;
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
  });

  // =====================================
  // シート4: 手順書（メイン）
  // =====================================
  const mainSheet = workbook.addWorksheet('手順書', {
    pageSetup: { orientation: 'landscape', paperSize: 9 },
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  mainSheet.columns = [
    { width: 15, key: 'section' },     // A: 項目
    { width: 8, key: 'stepNo' },       // B: 手順番号
    { width: 25, key: 'summary' },     // C: 概要
    { width: 15, key: 'target' },      // D: 対象
    { width: 55, key: 'procedure' },   // E: 手順
    { width: 12, key: 'person' },      // F: 担当
    { width: 14, key: 'startPlan' },   // G: 開始時間(予定)
    { width: 14, key: 'endPlan' },     // H: 完了時間(予定)
    { width: 14, key: 'startActual' }, // I: 開始時間(実施)
    { width: 14, key: 'endActual' },   // J: 完了時間(実施)
    { width: 25, key: 'note' },        // K: 備考
  ];

  // ヘッダー
  const mainHeaders = ['項目', '手順番号', '概要', '対象', '手順（コマンド＋確認項目）', '担当', '開始時間(予定)', '完了時間(予定)', '開始時間(実施)', '完了時間(実施)', '備考'];
  mainHeaders.forEach((header, i) => {
    const cell = mainSheet.getCell(1, i + 1);
    cell.value = header;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: headerGreen };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    cell.border = thinBorder;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  mainSheet.getRow(1).height = 30;

  // 大項目と手順データ
  const sections = [
    {
      title: '1. ログイン',
      steps: [
        {
          stepNo: '1-1',
          summary: 'サーバーログイン',
          target: 'web_server',
          procedure: '1. 対象サーバにSSHログインする\n\nssh ec2-user@【IPアドレス】\n\n【確認】ログインできること',
          note: '',
        },
      ],
    },
    {
      title: '2. Webサーバー構築',
      steps: [
        {
          stepNo: '2-1',
          summary: 'Apacheインストール',
          target: 'web_server',
          procedure: '1. Apacheをインストールする\n\n# sudo dnf install httpd -y\n\n【確認】Complete! と表示されること',
          note: '',
        },
        {
          stepNo: '2-2',
          summary: 'Apache起動',
          target: 'web_server',
          procedure: '1. Apacheを起動する\n\n# sudo systemctl start httpd\n\n【確認】エラーが出ないこと',
          note: '',
        },
        {
          stepNo: '2-3',
          summary: '自動起動設定',
          target: 'web_server',
          procedure: '1. 自動起動を有効にする\n\n# sudo systemctl enable httpd\n\n【確認】Created symlink... と表示される',
          note: '',
        },
        {
          stepNo: '2-4',
          summary: '動作確認',
          target: 'web_server',
          procedure: '1. Apacheの動作を確認する\n\n# curl http://localhost\n\n【確認】HTMLが表示されること',
          note: '',
        },
      ],
    },
    {
      title: '3. データベース構築',
      steps: [
        {
          stepNo: '3-1',
          summary: 'MySQLインストール',
          target: 'web_server',
          procedure: '1. MySQLをインストールする\n\n# sudo dnf install mysql-server -y\n\n【確認】Complete! と表示されること',
          note: '',
        },
        {
          stepNo: '3-2',
          summary: 'MySQL起動',
          target: 'web_server',
          procedure: '1. MySQLを起動する\n\n# sudo systemctl start mysqld\n\n【確認】エラーが出ないこと',
          note: '',
        },
        {
          stepNo: '3-3',
          summary: '自動起動設定',
          target: 'web_server',
          procedure: '1. 自動起動を有効にする\n\n# sudo systemctl enable mysqld\n\n【確認】Created symlink... と表示される',
          note: '',
        },
        {
          stepNo: '3-4',
          summary: '初期設定',
          target: 'web_server',
          procedure: '1. MySQL初期設定を実行する\n\n# sudo mysql_secure_installation\n\n【確認】All done! と表示されること',
          note: 'パスワードを設定',
        },
      ],
    },
    {
      title: '4. 最終確認',
      steps: [
        {
          stepNo: '4-1',
          summary: 'サービス状態確認',
          target: 'web_server',
          procedure: '1. 各サービスの状態を確認する\n\n# systemctl status httpd\n# systemctl status mysqld\n\n【確認】両方 active (running) であること',
          note: '',
        },
      ],
    },
  ];

  let currentRow = 2;
  sections.forEach((section) => {
    // 大項目行（セル結合）
    mainSheet.mergeCells(`A${currentRow}:K${currentRow}`);
    const sectionCell = mainSheet.getCell(`A${currentRow}`);
    sectionCell.value = section.title;
    sectionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: lightGreen };
    sectionCell.font = { bold: true };
    sectionCell.border = thinBorder;
    sectionCell.alignment = { vertical: 'middle' };
    mainSheet.getRow(currentRow).height = 25;
    currentRow++;

    // 手順行
    section.steps.forEach((step) => {
      const row = mainSheet.getRow(currentRow);
      row.values = ['', step.stepNo, step.summary, step.target, step.procedure, '', '', '', '', '', step.note];

      // 各セルにボーダーと折り返し設定
      for (let col = 1; col <= 11; col++) {
        const cell = row.getCell(col);
        cell.border = thinBorder;
        cell.alignment = { vertical: 'top', wrapText: true };
      }

      // 手順列の行の高さを調整（改行数に応じて）
      const lineCount = (step.procedure.match(/\n/g) || []).length + 1;
      row.height = Math.max(60, lineCount * 15);

      currentRow++;
    });
  });

  // =====================================
  // シート5: 切り戻し手順
  // =====================================
  const rollbackSheet = workbook.addWorksheet('切り戻し手順', {
    pageSetup: { orientation: 'portrait', paperSize: 9 },
  });

  rollbackSheet.columns = [
    { width: 10, key: 'stepNo' },
    { width: 25, key: 'summary' },
    { width: 50, key: 'procedure' },
    { width: 30, key: 'note' },
  ];

  // タイトル
  rollbackSheet.getCell('A1').value = '切り戻し手順';
  rollbackSheet.getCell('A1').font = { size: 14, bold: true };

  // 注意書き
  rollbackSheet.getCell('A2').value = '※作業に失敗した場合、以下の手順で元の状態に戻してください';
  rollbackSheet.getCell('A2').font = { color: { argb: 'FFFF0000' } };

  // ヘッダー
  const rollbackHeaders = ['手順番号', '概要', '手順', '備考'];
  rollbackHeaders.forEach((header, i) => {
    const cell = rollbackSheet.getCell(4, i + 1);
    cell.value = header;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: headerRed };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    cell.border = thinBorder;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // サンプルデータ
  const rollbackData = [
    ['R-1', 'Apacheの停止', '# sudo systemctl stop httpd', ''],
    ['R-2', 'Apache自動起動の無効化', '# sudo systemctl disable httpd', ''],
    ['R-3', 'Apacheのアンインストール', '# sudo dnf remove httpd -y', '必要に応じて'],
    ['R-4', 'MySQLの停止', '# sudo systemctl stop mysqld', ''],
    ['R-5', 'MySQL自動起動の無効化', '# sudo systemctl disable mysqld', ''],
    ['R-6', 'MySQLのアンインストール', '# sudo dnf remove mysql-server -y', '必要に応じて'],
  ];
  rollbackData.forEach((rowData, rowIndex) => {
    rowData.forEach((value, colIndex) => {
      const cell = rollbackSheet.getCell(rowIndex + 5, colIndex + 1);
      cell.value = value;
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
  });

  // ファイル出力
  const outputPath = path.join(__dirname, '..', 'public', 'server_setup_template.xlsx');
  await workbook.xlsx.writeFile(outputPath);
  console.log(`Template created: ${outputPath}`);
}

createProfessionalTemplate().catch(console.error);
