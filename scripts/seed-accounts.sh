#!/usr/bin/env bash
# accounts テーブルに kira-test を登録する（パスワード: kira-test）。
# 使用方法: TABLE_NAME=kira-project-dev-accounts AWS_REGION=ap-northeast-1 ./scripts/seed-accounts.sh

set -e
TABLE_NAME="${TABLE_NAME:-kira-project-dev-accounts}"
AWS_REGION="${AWS_REGION:-ap-northeast-1}"

# kira-test のパスワード "kira-test" の SHA-256
KIRA_TEST_HASH="2acecf104a1b74b2f3ed93c80986e88ee5022f08bc83f89081795a922cb49894"

aws dynamodb put-item \
  --region "$AWS_REGION" \
  --table-name "$TABLE_NAME" \
  --item "{
    \"username\": { \"S\": \"kira-test\" },
    \"passwordHash\": { \"S\": \"$KIRA_TEST_HASH\" },
    \"createdAt\": { \"S\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\" }
  }"

echo "Done: kira-test を登録しました（パスワード: kira-test）"
