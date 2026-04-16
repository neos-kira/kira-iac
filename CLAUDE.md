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
