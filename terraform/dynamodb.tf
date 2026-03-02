# 受講生進捗保存用。オンデマンド課金で無料枠内・最小コストを狙う
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
