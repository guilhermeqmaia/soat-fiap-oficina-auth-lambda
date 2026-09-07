locals {
  function_name = "${var.project}-auth-${var.environment}"

  # Secrets: usa os informados ou cria a partir dos valores das variaveis.
  jwt_secret_arn = var.jwt_secret_id != "" ? var.jwt_secret_id : one(aws_secretsmanager_secret.jwt[*].arn)
  db_secret_arn  = var.db_secret_id != "" ? var.db_secret_id : one(aws_secretsmanager_secret.db[*].arn)

  environment = merge(
    {
      JWT_SECRET_ID  = local.jwt_secret_arn
      JWT_ISSUER     = var.jwt_issuer
      JWT_EXPIRES_IN = var.jwt_expires_in

      DB_SECRET_ID = local.db_secret_arn
      DB_SSL       = "true"

      CLIENTE_TABLE               = var.cliente_table
      CLIENTE_CPF_COLUMN          = var.cliente_cpf_column
      CLIENTE_STATUS_ATIVO_VALUES = var.cliente_status_ativo_values

      LOG_LEVEL = var.log_level
    },
    var.jwt_audience != "" ? { JWT_AUDIENCE = var.jwt_audience } : {},
    var.cliente_status_column != "" ? { CLIENTE_STATUS_COLUMN = var.cliente_status_column } : {},
    var.extra_environment,
  )
}

# ---------------------------------------------------------------------------
# Secrets (criados so quando o *_secret_id nao e informado)
# ---------------------------------------------------------------------------
resource "aws_secretsmanager_secret" "jwt" {
  count = var.jwt_secret_id == "" ? 1 : 0
  name  = "${local.function_name}/jwt"
}

resource "aws_secretsmanager_secret_version" "jwt" {
  count         = var.jwt_secret_id == "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.jwt[0].id
  secret_string = jsonencode({ JWT_SECRET = var.jwt_secret_value })

  lifecycle {
    precondition {
      condition     = length(var.jwt_secret_value) >= 32
      error_message = "Informe jwt_secret_id (secret existente) ou jwt_secret_value com pelo menos 32 caracteres."
    }
  }
}

resource "aws_secretsmanager_secret" "db" {
  count = var.db_secret_id == "" ? 1 : 0
  name  = "${local.function_name}/db"
}

resource "aws_secretsmanager_secret_version" "db" {
  count         = var.db_secret_id == "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.db[0].id
  secret_string = jsonencode({ DATABASE_URL = var.database_url })

  lifecycle {
    precondition {
      condition     = startswith(var.database_url, "postgres")
      error_message = "Informe db_secret_id (secret existente) ou database_url (postgresql://...)."
    }
  }
}

# ---------------------------------------------------------------------------
# Function
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "auth" {
  function_name = local.function_name
  description   = "Autenticacao por CPF (emite JWT) + authorizer do API Gateway"
  role          = local.lambda_role_arn

  filename         = var.package_path
  source_code_hash = filebase64sha256(var.package_path)
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  architectures    = ["x86_64"]

  memory_size = var.memory_size
  timeout     = var.timeout
  publish     = true

  environment {
    variables = local.environment
  }

  dynamic "vpc_config" {
    for_each = length(var.subnet_ids) > 0 ? [1] : []
    content {
      subnet_ids         = var.subnet_ids
      security_group_ids = var.security_group_ids
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda]

  # O deploy de codigo e feito pelo workflow cd.yml (update-function-code +
  # publish-version + alias), entao o Terraform nao deve reverter o artefato.
  lifecycle {
    ignore_changes = [filename, source_code_hash, layers]
  }
}

resource "aws_lambda_alias" "environment" {
  name             = var.environment
  function_name    = aws_lambda_function.auth.function_name
  function_version = aws_lambda_function.auth.version

  lifecycle {
    ignore_changes = [function_version]
  }
}
