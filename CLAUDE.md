# NIC (NeOS IT College) - Project Rules

## 絶対厳守ルール
1. デプロイは必ず以下のコマンドをこの順序で実行
2. DynamoDBが唯一の信頼できるデータソース。localStorageはキャッシュのみ
3. 全修正は全ユーザーに普遍的に適用。特定アカウント専用ロジック禁止
4. ブランドカラー: #14b8a6（変更禁止）

## デプロイコマンド

### フロントエンド（必須）
```bash
cd web && npm run build && aws s3 sync dist s3://kira-project-dev-web-static --delete && aws cloudfront create-invalidation --distribution-id E3MP0X7N45428N --paths "/*"
```

### Lambda（バックエンド修正時）
```bash
cd terraform/lambda/progress-api && rm -f /tmp/progress-api.zip && zip -qr /tmp/progress-api.zip . -x "*.zip" && aws lambda update-function-code --function-name kira-project-dev-progress-api --zip-file fileb:///tmp/progress-api.zip --region ap-northeast-1 2>&1 | tail -3
```

### Terraform（インフラ修正時）
```bash
cd terraform && terraform apply
```

## AWSリソース
- URL: training-org.neos-nic.jp
- CloudFront ID: E3MP0X7N45428N
- S3: kira-project-dev-web-static
- Lambda: kira-project-dev-progress-api
- Region: ap-northeast-1
- DynamoDB: progress, accounts, sessions

## プロジェクト構成
- フロントエンド: /Users/ryosukekira/Desktop/dev/web/
- インフラ: /Users/ryosukekira/Desktop/dev/terraform/

## 変更禁止
- ブランドカラー #14b8a6
- デプロイコマンドの順序
- DynamoDBテーブル構造の破壊的変更

---

# NIC標準デプロイ&検証テンプレ v1.0

すべてのデプロイ作業は本テンプレに準拠すること。違反した完了報告は受理しない。

## 確定3原則

1. **Invalidation完了を必ず待つ** — フロントデプロイは `aws cloudfront wait invalidation-completed` を必須化し、`InProgress` の状態で完了報告しない
2. **ビルド成果物に対する検証grepを必ず実行** — 修正対象クラス/値が `dist/` に残っていないことを機械的に確認してから報告する
3. **完了報告には実機確認の根拠を必ず添付** — Invalidation ID、grep結果、git commit hash の3点セット必須

---

## テンプレA: フロントエンド修正

```bash
cd web && \
npm run build && \
echo "=== 検証grep ===" && \
grep -rE "【検証パターン】" dist/ | head -20 && \
aws s3 sync dist s3://kira-project-dev-web-static --delete && \
INVALIDATION_ID=$(aws cloudfront create-invalidation --distribution-id E3MP0X7N45428N --paths "/*" --query 'Invalidation.Id' --output text) && \
echo "Invalidation ID: $INVALIDATION_ID" && \
aws cloudfront wait invalidation-completed --distribution-id E3MP0X7N45428N --id $INVALIDATION_ID && \
echo "=== Invalidation Completed ===" && \
cd .. && \
git add -A && \
git commit -m "【コミットメッセージ】" && \
git push origin main && \
echo "=== Commit Hash ===" && \
git rev-parse --short HEAD
```

## テンプレB: Lambda修正

```bash
cd terraform/lambda/progress-api && \
rm -f /tmp/progress-api.zip && \
zip -qr /tmp/progress-api.zip . -x "*.zip" && \
aws lambda update-function-code \
  --function-name kira-project-dev-progress-api \
  --zip-file fileb:///tmp/progress-api.zip \
  --region ap-northeast-1 \
  --query 'LastUpdateStatus' --output text && \
echo "=== Lambda Updated, waiting for Active state ===" && \
aws lambda wait function-updated \
  --function-name kira-project-dev-progress-api \
  --region ap-northeast-1 && \
echo "=== Lambda Active ===" && \
echo "=== 疎通確認 ===" && \
【curl疎通確認コマンド】 && \
cd ../../../ && \
git add -A && \
git commit -m "【コミットメッセージ】" && \
git push origin main && \
git rev-parse --short HEAD
```

## テンプレC: Terraform + Lambda(IAM変更等)

```bash
cd terraform && \
terraform plan -out=/tmp/tfplan 2>&1 | tail -20 && \
echo "=== Plan確認、適用します ===" && \
terraform apply -auto-approve /tmp/tfplan 2>&1 | tail -10 && \
cd lambda/progress-api && \
rm -f /tmp/progress-api.zip && \
zip -qr /tmp/progress-api.zip . -x "*.zip" && \
aws lambda update-function-code \
  --function-name kira-project-dev-progress-api \
  --zip-file fileb:///tmp/progress-api.zip \
  --region ap-northeast-1 \
  --query 'LastUpdateStatus' --output text && \
aws lambda wait function-updated \
  --function-name kira-project-dev-progress-api \
  --region ap-northeast-1 && \
echo "=== 疎通確認 ===" && \
【curl疎通確認コマンド】 && \
cd ../../../ && \
git add -A && \
git commit -m "【コミットメッセージ】" && \
git push origin main && \
git rev-parse --short HEAD
```

---

## 完了報告フォーマット(必須)

以下の形式で報告すること。項目欠落は不可。

```
完了報告

1. 修正サマリ
   - 【何をなぜ修正したか1〜2行】

2. 修正ファイル一覧
   - path/to/file1.tsx : 【変更内容】
   - path/to/file2.ts  : 【変更内容】

3. 検証grep結果(修正前後)
   修正前:
     【grep出力】
   修正後:
     【grep出力 → 0件 or 許可された残留のみ】

4. ビルド・デプロイ結果
   - ビルド: 成功 (XXXs)
   - 検証grep on dist/: 残留0件
   - S3 sync: 完了
   - CloudFront Invalidation ID: XXXXXXX
   - Invalidation status: Completed
   - Lambda update: Active(該当時)
   - 疎通確認: 200 OK / 期待レスポンス取得(該当時)

5. Git
   - Commit hash: xxxxxxx
   - Branch: main (pushed)

6. 残課題・申し送り
   - 【あれば。なければ「なし」】
```

---

## 禁止事項(違反時は作業差戻し)

- CloudFront Invalidation が `InProgress` の状態で完了報告すること
- Lambda update後に `LastUpdateStatus` が `Successful`/`Active` になる前に完了報告すること
- 検証grepを実行せずに完了報告すること
- ビルド成果物(`dist/`)ではなくソースコードに対してのみgrepして「残留なし」と報告すること
- 「修正した」と「画面/APIに反映された」を混同した報告
- 1メッセージに収まる作業を複数メッセージに分割すること

---

## 進捗フィールド追加時の3層チェックリスト(必須)

新しいフィールドを TraineeProgressSnapshot に追加する時は、
必ず以下の3層全てに反映すること。どれか1つでも抜けると
「保存したはずが反映されない」バグになる。

1. フロント: 型定義 (web/src/traineeProgressStorage.ts)
2. フロント: 書き込み側(各課題の中断保存ハンドラ)
3. **Lambda: PUT /progress ハンドラのホワイトリスト(忘れやすい)**
4. フロント: 読み取り側(ダッシュボード表示など)

## EC2構成(2026-04-23時点)

- AMI: Rocky Linux 9.7 ARM64 (ami-ID: index.js L1224にハードコード)
- インスタンスタイプ: t4g.nano
- リージョン: ap-northeast-1
- デフォルトSSHユーザー: rocky
- UserDataで研修生ユーザー自動作成(useradd + SSH鍵配置 + sudo権限)
- EventBridgeでstate-change→running時にDynamoDB IP自動更新
- firewalld / bind-utils / lvm2 をUserDataで自動インストール

## 権限モデル(2026-04-23時点)

- manager / student の2階層(admin完全廃止)
- 予約語: admin, root, system (POST /admin/users, POST /accounts で作成不可)
- manager アカウント: kira-koushi

## AI講師プロンプト設計原則

- 直接答えは教えない、ただし「調べましょう」だけは禁止
- manコマンドを最初の手段にしない
- 必ず3要素を含める: ①具体的な調べ方 ②何が見つかるかの予告 ③次の1アクション
- ターミナルとブラウザ検索の両方を提示する
- 「〇〇なので実行しても問題ありません」と理由付きで安心感を与える
- 「演習サーバーにログインした状態で」と実行場所を明示する
- エラー報告には「普通のこと」と受け止め、否定語を使わない
- 名称は「AI講師」で統一(「コーチ」禁止)

## Linuxコマンド30問 採点設計原則

normalize処理(全問共通):
- trim + 全角スペース変換 + 複数スペース圧縮
- toLowerCase
- sudo 除去
- -y 除去
- chown user:group → chown user (グループ部除去)
- クォート除去(シングル/ダブル)
- 末尾スラッシュ除去
- vim → vi 統一
- curl --head → curl -I 統一

問題ごとの alternatives で吸収:
- オプション順序の揺れ(ls -lt / ls -tl)
- chmod の数字/記号表記
- firewall-cmd のオプション逆順
- vi のコマンドモード表記
- yum / dnf の互換

問題文は具体的なファイル名/パス/ユーザー名を明記し、
プレースホルダー(「ファイル名」等)を使わない。

不正解時はその場リトライ可能(再出題キュー廃止)。

## 調査→修正の順序厳守

推測での修正を禁止する。
以下の順序を必ず守ること:
1. 静的コード解析で原因を特定
2. DynamoDB実データ / CloudWatch Logs / AWS実態で裏付け
3. 原因が確定してから最小差分で修正
4. 修正後、dist/ と実APIの両方で検証

特に「以前動いていたのに今壊れた」系のバグは、
git log で壊れたコミットを特定してから修正する。

## 並列タスク投入の禁止

同一ファイルを触る可能性があるタスクは直列で処理する。
並列投入はマージコンフリクトの原因になる。
1タスク → 完了報告確認 → 次タスク の順序を守ること。

## PEM運用

- PEMはサーバー作成時に1回のみダウンロード
- 再DLボタンは廃止済み
- 紛失した場合はサーバー再作成(研修進捗は保持)

## カリキュラム遷移仕様(暫定)

現在、全モジュールは前提条件なしで自由遷移可能。
ロック機能/前提条件チェックは要件定義書作成フェーズで再検討予定。

## フロントエンド文言ルール

- 開発者用語(ステッパー、閲覧モード、コンポーネント等)をUIテキストに使わない
- 研修生(IT未経験者)が読んで分かる平易な表現を使う
