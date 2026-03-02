terraform {
  required_version = ">= 1.6.0"

  backend "s3" {
    bucket = "kira-iac-terraform-state-2026" # 事前に手動作成が必要
    key    = "react-ui/terraform.tfstate"
    region = "ap-northeast-1"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

locals {
  app_name            = "${var.project_name}-${var.environment}"
  s3_suffix           = "web-static"
  basic_auth_expected = base64encode("${coalesce(var.basic_auth_username, "kira")}:${coalesce(var.basic_auth_password, "change-me")}")
  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "local_file" "basic_auth_handler" {
  count    = var.enable_basic_auth ? 1 : 0
  filename = "${path.module}/lambda/basic-auth/index.js"
  content  = templatefile("${path.module}/lambda/basic-auth/index.js.tftpl", { expected = local.basic_auth_expected })
}

data "archive_file" "basic_auth_zip" {
  count       = var.enable_basic_auth ? 1 : 0
  type        = "zip"
  source_dir  = "${path.module}/lambda/basic-auth"
  output_path = "${path.module}/lambda/basic-auth.zip"
  depends_on  = [local_file.basic_auth_handler]
}

resource "aws_iam_role" "lambda_edge" {
  count = var.enable_basic_auth ? 1 : 0
  name  = "${local.app_name}-basic-auth-edge"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = ["lambda.amazonaws.com", "edgelambda.amazonaws.com"]
        }
        Action = "sts:AssumeRole"
      },
    ]
  })
  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "lambda_edge_basic_execution" {
  count      = var.enable_basic_auth ? 1 : 0
  role       = aws_iam_role.lambda_edge[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "basic_auth_edge" {
  count    = var.enable_basic_auth ? 1 : 0
  provider = aws.us_east_1

  function_name = "${local.app_name}-basic-auth-edge"
  description   = "Basic Auth for CloudFront (viewer-request)"

  role    = aws_iam_role.lambda_edge[0].arn
  runtime = "nodejs20.x"
  handler = "index.handler"

  filename         = data.archive_file.basic_auth_zip[0].output_path
  source_code_hash = data.archive_file.basic_auth_zip[0].output_base64sha256

  publish = true
  tags    = local.tags
}

resource "aws_s3_bucket" "web" {
  bucket = "${local.app_name}-${local.s3_suffix}"

  tags = local.tags
}

resource "aws_s3_bucket_ownership_controls" "web" {
  bucket = aws_s3_bucket.web.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket = aws_s3_bucket.web.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "${local.app_name}-oac"
  description                       = "OAC for ${aws_s3_bucket.web.bucket}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_iam_policy_document" "web_bucket_policy" {
  statement {
    sid    = "AllowCloudFrontServicePrincipalReadOnly"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions = [
      "s3:GetObject",
      "s3:ListBucket",
    ]

    resources = [
      aws_s3_bucket.web.arn,
      "${aws_s3_bucket.web.arn}/*",
    ]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values = [
        aws_cloudfront_distribution.web.arn,
      ]
    }
  }
}

resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id
  policy = data.aws_iam_policy_document.web_bucket_policy.json
}

# Basic Auth 利用時: キャッシュキーに Authorization を含め、認証あり/なしで別キャッシュにする
# これがないと「認証なし」のリクエストが「認証あり」でキャッシュされた 200 を貰ってしまう
resource "aws_cloudfront_cache_policy" "web" {
  count       = var.enable_basic_auth ? 1 : 0
  name        = "${local.app_name}-web-cache-auth"
  comment     = "Cache key includes Authorization for Basic Auth"
  default_ttl = 3600
  max_ttl     = 86400
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Authorization"]
      }
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
  }
}

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  comment             = "React SPA for ${local.app_name}"
  default_root_object = "index.html"
  aliases             = length(var.cloudfront_aliases) > 0 ? var.cloudfront_aliases : null

  price_class = "PriceClass_100"

  origin {
    domain_name = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id   = aws_s3_bucket.web.id

    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = aws_s3_bucket.web.id

    dynamic "lambda_function_association" {
      for_each = var.enable_basic_auth ? [1] : []
      content {
        event_type   = "viewer-request"
        lambda_arn   = aws_lambda_function.basic_auth_edge[0].qualified_arn
        include_body = false
      }
    }

    # 常に cache_policy_id を使用（Basic Auth 時は Authorization をキャッシュキーに含める独自ポリシー、それ以外は AWS 管理）
    cache_policy_id = var.enable_basic_auth ? aws_cloudfront_cache_policy.web[0].id : "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized

    viewer_protocol_policy = "redirect-to-https"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn            = length(var.cloudfront_aliases) > 0 ? var.acm_certificate_arn : null
    cloudfront_default_certificate = length(var.cloudfront_aliases) == 0
    ssl_support_method             = length(var.cloudfront_aliases) > 0 ? "sni-only" : null
    minimum_protocol_version       = length(var.cloudfront_aliases) > 0 ? "TLSv1.2_2021" : null
  }

  tags = local.tags
}

