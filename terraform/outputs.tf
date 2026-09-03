output "function_arn" {
  description = "ARN da function — entrada auth_lambda_arn do gateway (repo soat-fiap-oficina-infra-k8s)."
  value       = aws_lambda_function.auth.arn
}

output "function_name" {
  description = "Nome da function (aws lambda invoke / logs)."
  value       = aws_lambda_function.auth.function_name
}

output "log_group" {
  description = "Log group da function (logs JSON com CPF mascarado)."
  value       = aws_cloudwatch_log_group.auth.name
}
