// 受講生進捗保存用。オンデマンド課金で無料枠内・最小コストを狙う
resource "aws_dynamodb_table" "progress" {
  name         = "${local.app_name}-progress"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "traineeId"

  attribute {
    name = "traineeId"
    type = "S"
  }

  tags = local.tags
}

// ログイン可能な受講生アカウント一覧。username を主キーとして最小限の情報のみ保存。
resource "aws_dynamodb_table" "accounts" {
  name         = "${local.app_name}-accounts"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "username"

  attribute {
    name = "username"
    type = "S"
  }

  tags = local.tags
}

// AI講師の会話履歴（userId + messageId でキー、GSI で日付範囲取得）
resource "aws_dynamodb_table" "ai_chat_history" {
  name         = "${local.app_name}-ai-chat-history"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "messageId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "messageId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  global_secondary_index {
    name            = "createdAt-index"
    hash_key        = "userId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  tags = local.tags
}

// セッション保存用（sessionId をキー、TTL で自動削除）
resource "aws_dynamodb_table" "sessions" {
  name         = "${local.app_name}-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sessionId"

  attribute {
    name = "sessionId"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  tags = local.tags
}
