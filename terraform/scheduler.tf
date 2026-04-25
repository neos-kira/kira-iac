# ============================================================
# EventBridge Scheduler: EC2 自動停止（起動から8時間後）
# ============================================================

resource "aws_iam_role" "scheduler_auto_stop" {
  name = "${local.app_name}-scheduler-auto-stop"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy" "scheduler_auto_stop_invoke" {
  name   = "invoke-lambda"
  role   = aws_iam_role.scheduler_auto_stop.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = aws_lambda_function.progress_api.arn
    }]
  })
}

resource "aws_scheduler_schedule" "auto_stop_ec2" {
  name       = "${local.app_name}-auto-stop-ec2"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression          = "rate(1 hour)"
  schedule_expression_timezone = "Asia/Tokyo"

  target {
    arn      = aws_lambda_function.progress_api.arn
    role_arn = aws_iam_role.scheduler_auto_stop.arn
    input    = jsonencode({ action = "autoStopEc2" })
  }
}

resource "aws_lambda_permission" "scheduler_auto_stop" {
  statement_id  = "AllowSchedulerAutoStop"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.progress_api.function_name
  principal     = "scheduler.amazonaws.com"
  source_arn    = aws_scheduler_schedule.auto_stop_ec2.arn
}
