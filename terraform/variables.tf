variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "ap-northeast-1"
}

variable "project_name" {
  description = "Project name used for tagging and naming"
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. dev, stg, prod)"
  type        = string
  default     = "dev"
}

variable "enable_basic_auth" {
  description = "Enable Basic Auth in CloudFront via Lambda@Edge"
  type        = bool
  # デフォルトは無効。必要な環境でのみ -var で true を指定する。
  default     = false
}

variable "basic_auth_username" {
  description = "Basic Auth username"
  type        = string
  sensitive   = true
  default     = null
}

variable "basic_auth_password" {
  description = "Basic Auth password"
  type        = string
  sensitive   = true
  default     = null
}

variable "cloudfront_aliases" {
  description = "Custom domain aliases for CloudFront (e.g. [\"training-org.neos-nic.jp\"]). Empty = default *.cloudfront.net only."
  type        = list(string)
  default     = []
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for CloudFront (must be in us-east-1). Required when cloudfront_aliases is non-empty."
  type        = string
  default     = null
}

