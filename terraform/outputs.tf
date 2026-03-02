output "s3_bucket_name" {
  description = "Name of the S3 bucket hosting the React app"
  value       = aws_s3_bucket.web.bucket
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.web.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.web.id
}

output "progress_api_url" {
  description = "Progress API base URL (for VITE_PROGRESS_API_URL)"
  value       = "${aws_apigatewayv2_stage.progress.invoke_url}"
}

