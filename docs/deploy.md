# デプロイ先と https://training-org.neos-nic.jp/

- **main に push** すると GitHub Actions がビルドし、**S3 (`kira-project-dev-web-static`)** にアップロードし、**CloudFront のキャッシュを無効化**します。
- **https://training-org.neos-nic.jp/** に反映されるには、このドメインが**上記 CloudFront ディストリビューション**を指している（CNAME またはエイリアス）必要があります。同じ CloudFront を指していれば、push 後の CI 完了後、数分以内に同 URL に反映されます。
- 反映されない場合:
  1. GitHub Actions の「Deploy Terraform」ワークフローが成功しているか確認する。
  2. **手動で再デプロイ**: リポジトリの Actions タブで「Deploy Terraform」を選び「Run workflow」で再実行すると、再ビルド・S3 同期・CloudFront 無効化が行われます。
  3. ブラウザでスーパーリロード（Ctrl+Shift+R / Cmd+Shift+R）またはキャッシュ削除を試す。
