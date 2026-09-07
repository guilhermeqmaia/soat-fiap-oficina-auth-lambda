data "aws_caller_identity" "current" {}

locals {
  create_role     = var.lambda_role_arn == ""
  lambda_role_arn = local.create_role ? aws_iam_role.lambda[0].arn : var.lambda_role_arn

  # O secret pode ser informado por nome ou por ARN; a policy precisa de ARN.
  secret_arns = [
    for value in [local.jwt_secret_arn, local.db_secret_arn] :
    startswith(value, "arn:")
    ? value
    : "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:${value}-*"
  ]
}

# ---------------------------------------------------------------------------
# Role de execucao da function.
# No AWS Academy/Learner Lab nao ha permissao de IAM: informe
# lambda_role_arn = "arn:aws:iam::<conta>:role/LabRole" e nada abaixo e criado.
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  count              = local.create_role ? 1 : 0
  name               = "${local.function_name}-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  count      = local.create_role ? 1 : 0
  role       = aws_iam_role.lambda[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  count      = local.create_role && length(var.subnet_ids) > 0 ? 1 : 0
  role       = aws_iam_role.lambda[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

data "aws_iam_policy_document" "lambda_secrets" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = local.secret_arns
  }
}

resource "aws_iam_role_policy" "lambda_secrets" {
  count  = local.create_role ? 1 : 0
  name   = "read-secrets"
  role   = aws_iam_role.lambda[0].id
  policy = data.aws_iam_policy_document.lambda_secrets.json
}

# ---------------------------------------------------------------------------
# Role assumida pelo GitHub Actions via OIDC (deploy sem chave estatica).
# Saida `github_actions_role_arn` -> secret AWS_ROLE_ARN no GitHub.
# ---------------------------------------------------------------------------
resource "aws_iam_openid_connect_provider" "github" {
  count           = var.github_repository != "" && var.create_github_oidc_provider ? 1 : 0
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "github_assume" {
  count = var.github_repository != "" ? 1 : 0

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type = "Federated"
      identifiers = [
        var.create_github_oidc_provider
        ? aws_iam_openid_connect_provider.github[0].arn
        : "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
      ]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:*"]
    }
  }
}

data "aws_iam_policy_document" "github_deploy" {
  count = var.github_repository != "" ? 1 : 0

  # Deploy de codigo (cd.yml).
  statement {
    actions = [
      "lambda:GetFunction",
      "lambda:GetFunctionConfiguration",
      "lambda:UpdateFunctionCode",
      "lambda:PublishVersion",
      "lambda:GetAlias",
      "lambda:CreateAlias",
      "lambda:UpdateAlias",
      "lambda:InvokeFunction",
    ]
    resources = [
      aws_lambda_function.auth.arn,
      "${aws_lambda_function.auth.arn}:*",
    ]
  }
}

resource "aws_iam_role" "github_actions" {
  count              = var.github_repository != "" ? 1 : 0
  name               = "${local.function_name}-github-actions"
  assume_role_policy = data.aws_iam_policy_document.github_assume[0].json
}

resource "aws_iam_role_policy" "github_actions" {
  count  = var.github_repository != "" ? 1 : 0
  name   = "deploy-lambda"
  role   = aws_iam_role.github_actions[0].id
  policy = data.aws_iam_policy_document.github_deploy[0].json
}
