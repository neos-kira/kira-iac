# 進捗 API: Lambda + API Gateway HTTP API（最小枠・無料枠狙い）

resource "null_resource" "progress_api_npm" {
  triggers = {
    package = filemd5("${path.module}/lambda/progress-api/package.json")
    code   = filemd5("${path.module}/lambda/progress-api/index.js")
  }
  provisioner "local-exec" {
    command     = "npm ci --omit=dev"
    working_dir = "${path.module}/lambda/progress-api"
  }
}

data "archive_file" "progress_api_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/progress-api"
  output_path = "${path.module}/lambda/progress-api.zip"
  excludes    = ["package-lock.json", "*.zip"]
  depends_on  = [null_resource.progress_api_npm]
}

resource "aws_iam_role" "progress_api" {
  name = "${local.app_name}-progress-api"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "progress_api_dynamodb" {
  name   = "dynamodb"
  role   = aws_iam_role.progress_api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Scan"
      ]
      Resource = [
        aws_dynamodb_table.progress.arn,
        aws_dynamodb_table.accounts.arn,
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "progress_api_logs" {
  role       = aws_iam_role.progress_api.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "progress_api" {
  function_name = "${local.app_name}-progress-api"
  role          = aws_iam_role.progress_api.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = data.archive_file.progress_api_zip.output_path
  source_code_hash = data.archive_file.progress_api_zip.output_base64sha256

  environment {
    variables = {
      TABLE_NAME          = aws_dynamodb_table.progress.name
      ACCOUNTS_TABLE_NAME = aws_dynamodb_table.accounts.name
    }
  }
  tags = local.tags
}

resource "aws_apigatewayv2_api" "progress" {
  name          = "${local.app_name}-progress"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "PUT", "POST", "OPTIONS"]
    allow_headers = ["Content-Type"]
  }
  tags = local.tags
}

resource "aws_apigatewayv2_integration" "progress" {
  api_id           = aws_apigatewayv2_api.progress.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.progress_api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "progress_put" {
  api_id    = aws_apigatewayv2_api.progress.id
  route_key = "PUT /progress"
  target    = "integrations/${aws_apigatewayv2_integration.progress.id}"
}

resource "aws_apigatewayv2_route" "progress_get" {
  api_id    = aws_apigatewayv2_api.progress.id
  route_key = "GET /progress"
  target    = "integrations/${aws_apigatewayv2_integration.progress.id}"
}

resource "aws_apigatewayv2_route" "progress_options" {
  api_id    = aws_apigatewayv2_api.progress.id
  route_key = "OPTIONS /progress"
  target    = "integrations/${aws_apigatewayv2_integration.progress.id}"
}

# アカウント作成・一覧・認証チェック用のルート
resource "aws_apigatewayv2_route" "accounts_post" {
  api_id    = aws_apigatewayv2_api.progress.id
  route_key = "POST /accounts"
  target    = "integrations/${aws_apigatewayv2_integration.progress.id}"
}

resource "aws_apigatewayv2_route" "accounts_get" {
  api_id    = aws_apigatewayv2_api.progress.id
  route_key = "GET /accounts"
  target    = "integrations/${aws_apigatewayv2_integration.progress.id}"
}

resource "aws_apigatewayv2_route" "accounts_options" {
  api_id    = aws_apigatewayv2_api.progress.id
  route_key = "OPTIONS /accounts"
  target    = "integrations/${aws_apigatewayv2_integration.progress.id}"
}

resource "aws_apigatewayv2_route" "auth_check_post" {
  api_id    = aws_apigatewayv2_api.progress.id
  route_key = "POST /auth/check"
  target    = "integrations/${aws_apigatewayv2_integration.progress.id}"
}

resource "aws_apigatewayv2_route" "auth_check_options" {
  api_id    = aws_apigatewayv2_api.progress.id
  route_key = "OPTIONS /auth/check"
  target    = "integrations/${aws_apigatewayv2_integration.progress.id}"
}

resource "aws_apigatewayv2_stage" "progress" {
  api_id      = aws_apigatewayv2_api.progress.id
  name        = "$default"
  auto_deploy = true
  tags        = local.tags
}

resource "aws_lambda_permission" "progress_apigw" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.progress_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.progress.execution_arn}/*/*"
}
