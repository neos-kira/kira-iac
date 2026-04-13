/**
 * 課題5 セクション別 Excel テンプレート生成スクリプト
 * 使い方: node scripts/createSectionTemplates.cjs
 */

const ExcelJS = require('exceljs')
const path = require('path')
const fs = require('fs')

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4CAF50' } }
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
const THIN_BORDER = {
  top: { style: 'thin' }, left: { style: 'thin' },
  bottom: { style: 'thin' }, right: { style: 'thin' },
}

const SECTIONS = [
  {
    filename: 'os_setup_template.xlsx',
    title: 'OS設定 手順書',
    tasks: [
      'リモートユーザー作成',
      'ホスト名設定',
      'ネットワーク設定確認',
      '名前解決設定',
      '外部疎通確認',
      'SSH設定（rootログイン禁止）',
      'コマンド履歴設定',
      'firewalld停止',
      'SELinux停止',
      'システム再起動・確認',
    ],
  },
  {
    filename: 'disk_setup_template.xlsx',
    title: 'ディスク追加 手順書',
    tasks: [
      'パーティション作成',
      'PV作成（pvcreate）',
      'VG作成（vgcreate）',
      'LV作成（lvcreate）',
      'マウント設定（mkfs / mount / fstab）',
    ],
  },
  {
    filename: 'httpd_setup_template.xlsx',
    title: 'httpd基本設定 手順書',
    tasks: [
      'httpdインストール',
      'httpd.conf設定',
      'httpd起動',
      '自動起動設定',
      'テストページ作成',
      'ブラウザ動作確認',
    ],
  },
  {
    filename: 'aide_setup_template.xlsx',
    title: '改ざん検知 AIDE 手順書',
    tasks: [
      'AIDEインストール',
      'aide.conf設定',
      'データベース作成（aide --init）',
      '動作確認（改ざん検知テスト）',
      'cron自動実行設定',
    ],
  },
  {
    filename: 'postgresql_setup_template.xlsx',
    title: 'PostgreSQL基本設定 手順書',
    tasks: [
      'PostgreSQL 16インストール',
      'DB初期化（postgresql-setup --initdb）',
      'PostgreSQL起動',
      '自動起動設定',
      'ユーザー作成（CREATE USER）',
      'DB作成（createdb）',
      'テーブル作成（CREATE TABLE）',
      'テーブル削除（DROP TABLE）',
      'DB削除（dropdb）',
    ],
  },
]

function styleCell(cell, options = {}) {
  if (options.fill) cell.fill = options.fill
  if (options.font) cell.font = options.font
  if (options.border !== false) cell.border = THIN_BORDER
  if (options.alignment) cell.alignment = options.alignment
}

async function createTemplate(section, outputDir) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'NIC Platform'
  wb.created = new Date()

  // ─── シート1: 表紙 ───
  const cover = wb.addWorksheet('表紙')
  cover.getColumn('A').width = 30
  cover.getColumn('B').width = 50

  cover.mergeCells('A1:B1')
  const titleCell = cover.getCell('A1')
  titleCell.value = section.title
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF1A5C2E' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  cover.getRow(1).height = 40

  const coverRows = [
    ['作成者', ''],
    ['作成日', new Date().toLocaleDateString('ja-JP')],
    ['更新日', ''],
    ['バージョン', '1.0'],
    ['研修期間', ''],
    ['サーバーIP', ''],
  ]
  coverRows.forEach((row, i) => {
    const r = cover.getRow(i + 3)
    r.getCell(1).value = row[0]
    r.getCell(2).value = row[1]
    styleCell(r.getCell(1), { font: { bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } } })
    styleCell(r.getCell(2))
    r.height = 22
  })

  // ─── シート2: 手順書 ───
  const proc = wb.addWorksheet('手順書')
  const procHeaders = ['手順番号', '作業区分', '作業概要', '詳細手順（コマンド含む）', '確認コマンド', '確認結果（期待値）', '備考']
  const procWidths = [12, 18, 30, 50, 30, 30, 20]

  procHeaders.forEach((h, i) => {
    proc.getColumn(i + 1).width = procWidths[i]
    const cell = proc.getRow(1).getCell(i + 1)
    cell.value = h
    styleCell(cell, { fill: HEADER_FILL, font: HEADER_FONT, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } })
  })
  proc.getRow(1).height = 30

  section.tasks.forEach((taskName, idx) => {
    const r = proc.addRow([
      idx + 1,
      taskName,
      '',
      '',
      '',
      '',
      '',
    ])
    r.eachCell((cell) => {
      styleCell(cell, { alignment: { wrapText: true, vertical: 'top' } })
    })
    r.height = 60
  })

  // ─── シート3: 確認チェックリスト ───
  const check = wb.addWorksheet('確認チェックリスト')
  const checkHeaders = ['No.', '確認項目', '確認結果（OK/NG）', '備考']
  const checkWidths = [8, 50, 20, 30]

  checkHeaders.forEach((h, i) => {
    check.getColumn(i + 1).width = checkWidths[i]
    const cell = check.getRow(1).getCell(i + 1)
    cell.value = h
    styleCell(cell, { fill: HEADER_FILL, font: HEADER_FONT, alignment: { horizontal: 'center', vertical: 'middle' } })
  })
  check.getRow(1).height = 25

  section.tasks.forEach((taskName, idx) => {
    const r = check.addRow([idx + 1, `${taskName} が完了していること`, '', ''])
    r.eachCell((cell) => {
      styleCell(cell, { alignment: { wrapText: true, vertical: 'middle' } })
    })
    r.height = 25
  })

  const filepath = path.join(outputDir, section.filename)
  await wb.xlsx.writeFile(filepath)
  console.log(`✓ ${section.filename}`)
}

async function main() {
  const outputDir = path.join(__dirname, '..', 'public', 'templates')
  fs.mkdirSync(outputDir, { recursive: true })

  for (const section of SECTIONS) {
    await createTemplate(section, outputDir)
  }
  console.log('\n全テンプレート生成完了 → public/templates/')
}

main().catch((err) => { console.error(err); process.exit(1) })
