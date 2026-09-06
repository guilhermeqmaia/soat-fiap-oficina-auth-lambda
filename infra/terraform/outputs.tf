output "function_name" {
  description = "Use este valor na variavel LAMBDA_FUNCTION_NAME do GitHub Environment."
  value       = aws_lambda_function.auth.function_name
}

output "function_arn" {
  description = "ARN da function (usado pelo API Gateway no repo da infra/app)."
  value       = aws_lambda_function.auth.arn
}

output "function_alias_arn" {
  description = "ARN do alias do ambiente."
  value       = aws_lambda_alias.environment.arn
}

output "function_role_arn" {
  description = "Role de execucao efetiva."
  value       = local.lambda_role_arn
}

output "jwt_secret_arn" {
  description = "Secret com o JWT_SECRET (deve ser o mesmo consumido pelo monolito)."
  value       = local.jwt_secret_arn
}

output "db_secret_arn" {
  description = "Secret com a conexao do banco."
  value       = local.db_secret_arn
}

output "github_actions_role_arn" {
  description = "Role OIDC do GitHub Actions -> secret AWS_ROLE_ARN do repositorio."
  value       = var.github_repository != "" ? aws_iam_role.github_actions[0].arn : null
}

output "log_group" {
  description = "Log group do CloudWatch."
  value       = aws_cloudwatch_log_group.lambda.name
}
