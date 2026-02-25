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

