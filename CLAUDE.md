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
