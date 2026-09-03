# Function unica (US-F3-01): o mesmo codigo atende o POST /auth e o Lambda
# Authorizer do gateway — o handler despacha pelo formato do evento.

locals {
  function_name = "${var.project_name}-auth-cpf"
  # Artefato gerado por `npm run package` na raiz do repo.
  package_path = "${path.module}/../dist/lambda.zip"
}

resource "aws_lambda_function" "auth" {
  function_name = local.function_name
  description   = "Autenticacao por CPF (cliente e staff) + Lambda Authorizer de JWT"
  role          = var.lab_role_arn

  filename         = local.package_path
  source_code_hash = filebase64sha256(local.package_path)
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]

  memory_size = 256
  timeout     = 10

  environment {
    variables = {
      JWT_SECRET_ARN  = var.jwt_secret_arn
      DB_SECRET_ARN   = var.db_secret_arn
      JWT_ISSUER      = var.jwt_issuer
      JWT_TTL_SECONDS = tostring(var.jwt_ttl_seconds)
    }
  }

  # Dentro da VPC quando as subnets existirem (US-F3-05) — necessario para
  # alcancar o RDS. Sem subnets, a function sobe fora de VPC (smoke tests).
  dynamic "vpc_config" {
    for_each = length(var.vpc_subnet_ids) > 0 ? [1] : []
    content {
      subnet_ids         = var.vpc_subnet_ids
      security_group_ids = var.vpc_security_group_ids
    }
  }
}

resource "aws_cloudwatch_log_group" "auth" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = var.log_retention_days
}
