# NIC プラットフォーム (kira-project)

## プロジェクト概要
NIC（Neos IT College）の研修管理プラットフォーム。
受講生の進捗管理・研修課題へのアクセスを提供する。

---

# 作業ルール

## 修正作業の報告形式
修正作業を行う際は、必ず以下の形式で進捗を報告すること。
1. 修正完了したファイルと変更内容
2. まだ修正していないファイルと残タスク
3. ビルドエラーや型エラーが出ていれば内容
報告後、続きの修正を進めること。

## デザイン制約（絶対遵守）
- 白ベースのカードUIデザインは変更禁止
- 既存コンポーネントを再利用すること
- 勝手なデザイン刷新禁止

## 非同期処理の厳格管理
- awaitの順序を厳守すること
- ストレージへの書き込み完了前に画面遷移しないこと
- postProgressは保存完了を確認してから次の処理に進むこと

## データ管理
- 正とするデータはDynamoDBのsnapshotとする
- localStorageは補助的な一時保存のみに使うこと
- localStorageのみに保存して終わりにしないこと

## アーキテクチャの大前提（最重要）

### データフローの正しい方向
```
ユーザーの操作
↓
① DynamoDBに即時保存（postProgress）
↓
② 画面の状態を更新
↓
③ localStorageはキャッシュとして書く（任意）
```

### 絶対にやってはいけないこと
- localStorageから読んでDynamoDBに書く
  （localStorageが空の端末では全データが失われる）
- getCurrentProgressSnapshot()をpostProgressの
  直前に呼ぶ
  （localStorageベースのsnapshotをDynamoDBに
  上書きしてしまう）

### 正しいpostProgressの呼び方
操作で変化した値を直接引数として渡す。
getCurrentProgressSnapshot()は使わない。

【悪い例】
```typescript
const snap = getCurrentProgressSnapshot()
await postProgress(username, snap)
```

【良い例】
```typescript
await postProgress(username, {
  ...serverSnapshot,
  l1CurrentPart: newPart,
  l1CurrentQuestion: newIndex,
  updatedAt: new Date().toISOString(),
})
```

### serverSnapshotの扱い
- 常にDynamoDBから取得した最新値を保持する
- 操作のたびにserverSnapshotをベースにして
  変化した値だけ上書きしてpostProgressに渡す
- localStorageは参照しない

## ビルド・デプロイ
- 修正後は必ずビルドエラーと型エラーがないことを確認する
- エラーがある場合は報告してから修正を続けること

## コマンド実行の許可
以下のコマンドは確認なしに自動実行してよい。
- npm run build
- npm run dev
- git add
- git commit
- git push origin main
- aws s3 sync
- aws cloudfront create-invalidation
- aws lambda
- mkdir / cp / mv / rm

---


## 技術スタック
- フロントエンド: React + TypeScript + Vite + Tailwind CSS
- バックエンド: AWS Lambda (Node.js)
- DB: DynamoDB
- インフラ: Terraform (kira-iac-terraform-state-2026 で状態管理)
- リージョン: ap-northeast-1 (東京)

## AWS リソース一覧

### S3
- フロントエンド: `kira-project-dev-web-static`

### CloudFront
- Distribution ID: `E3MP0X7N45428N` (d207ajp3bvbh1h.cloudfront.net) ← フロントエンド用

### Lambda 関数
- `kira-project-dev-progress-api` ← このプロジェクトのメイン
- `stop-ec2-kira`
- `start-ec2-kira`
- `chat-message-history`
- `neos-lambda-ec2stop-k-itou`
- `chat-room-management`
- `chat-websocket-connect`
- `chat-websocket-message`
- `chat-user-management`
- `Minecraft`
- `Minecraft-command`

## デプロイ手順

### フロントエンドのデプロイ
```bash
# 1. ビルド
npm run build

# 2. S3にアップロード
aws s3 sync dist/ s3://kira-project-dev-web-static --delete --region ap-northeast-1

# 3. CloudFrontキャッシュ削除
aws cloudfront create-invalidation \
  --distribution-id E3MP0X7N45428N \
  --paths "/*" \
  --region ap-northeast-1
```

### バックエンド（Lambda）のデプロイ
```bash
# 関数コードを更新する場合
cd lambda/kira-project-dev-progress-api
zip -r function.zip .
aws lambda update-function-code \
  --function-name kira-project-dev-progress-api \
  --zip-file fileb://function.zip \
  --region ap-northeast-1
```

### インフラ変更（Terraform）
```bash
cd terraform/
terraform plan
terraform apply
```

## 環境変数
```
VITE_PROGRESS_API_URL=https://wfhfqq0tjh.execute-api.ap-northeast-1.amazonaws.com
```
`.env` に記載。`.gitignore` に含めること。

## 開発ルール（絶対遵守）
1. **UIデザイン固定**: 白ベースのカードUI。デザイン変更禁止。
2. **非同期処理**: await の順序・ストレージ書き込み完了を確実に行う。
3. **現状維持**: 新機能追加時も既存コンポーネントを再利用する。

## 作業フロー（承認不要・自動実行）
修正完了後は以下を確認なしで自動実行すること:
1. ビルド（`vite build`）
2. S3 デプロイ（`aws s3 sync dist/ s3://kira-project-dev-web-static --delete`）
3. CloudFront キャッシュ削除（`aws cloudfront create-invalidation --distribution-id E3MP0X7N45428N --paths "/*"`）
4. git commit & push（`git push origin main`）
5. Lambda 更新が必要な場合も同様に承認なしで実行

途中で確認を求めない。完了後に結果だけ報告する。

## 主要ファイル
- `src/accountsApi.ts` - アカウント管理API
- `src/progressApi.ts` - 進捗API（DynamoDB連携）
- `src/auth.ts` - 認証ロジック
- `src/App.tsx` - メインコンポーネント
- `src/LoginPage.tsx` - ログイン画面
