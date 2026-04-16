# デプロイ先と https://training-org.neos-nic.jp/

- **main に push** すると GitHub Actions がビルドし、**S3 (`kira-project-dev-web-static`)** にアップロードし、**CloudFront のキャッシュを無効化**します。
- **GitHub Actions で Terraform が失敗する場合**: リポジトリの **Settings → Secrets and variables → Actions** で `AWS_ACCESS_KEY_ID` と `AWS_SECRET_ACCESS_KEY` が設定されているか確認してください。講師（manager）としてログインするには、DynamoDB の accounts テーブルに role=manager のユーザーを作成してください。
- **https://training-org.neos-nic.jp/** に反映されるには、このドメインが**上記 CloudFront ディストリビューション**を指している（CNAME またはエイリアス）必要があります。同じ CloudFront を指していれば、push 後の CI 完了後、数分以内に同 URL に反映されます。
- **ローカルで S3 にだけデプロイした場合**（`aws s3 sync web/dist/ s3://kira-project-dev-web-static --delete` のみ実行した場合）:
  - CloudFront はキャッシュを持っているため、**キャッシュ無効化**を実行しないと本番 URL に反映されません。
  - 以下のコマンドで無効化してください（1〜3 分で反映されます）。
    ```bash
    aws cloudfront create-invalidation --distribution-id E3MP0X7N45428N --paths "/*"
    ```
- **kira-test でログインできない場合**（「ユーザー名かパスワードが間違っています」）: accounts テーブルに kira-test が未登録の可能性があります。以下を実行して kira-test（パスワード: `kira-test`）を登録してください。
  ```bash
  chmod +x scripts/seed-accounts.sh
  TABLE_NAME=kira-project-dev-accounts AWS_REGION=ap-northeast-1 ./scripts/seed-accounts.sh
  ```
- 反映されない場合:
  1. GitHub Actions の「Deploy Terraform」ワークフローが成功しているか確認する。
  2. **手動で再デプロイ**: リポジトリの Actions タブで「Deploy Terraform」を選び「Run workflow」で再実行すると、再ビルド・S3 同期・CloudFront 無効化が行われます。
  3. ローカルで S3 同期しただけの場合は、上記の `create-invalidation` を実行する。
  4. ブラウザでスーパーリロード（Ctrl+Shift+R / Cmd+Shift+R）またはキャッシュ削除を試す。
