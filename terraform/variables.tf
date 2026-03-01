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
  default     = true
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

