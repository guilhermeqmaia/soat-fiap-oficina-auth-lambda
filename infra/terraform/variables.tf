variable "aws_region" {
  description = "Regiao AWS onde a Lambda sera criada."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Prefixo dos recursos."
  type        = string
  default     = "oficina"
}

variable "environment" {
  description = "Ambiente logico (homolog | prod)."
  type        = string

  validation {
    condition     = contains(["homolog", "prod"], var.environment)
    error_message = "environment deve ser 'homolog' ou 'prod'."
  }
}

variable "package_path" {
  description = "Caminho do artefato .zip gerado por `npm run package`."
  type        = string
  default     = "../../lambda.zip"
}

variable "memory_size" {
  description = "Memoria da function em MB."
  type        = number
  default     = 512
}

variable "timeout" {
  description = "Timeout da function em segundos."
  type        = number
  default     = 15
}

variable "log_retention_days" {
  description = "Retencao dos logs no CloudWatch."
  type        = number
  default     = 14
}

# ---------------------------------------------------------------------------
# IAM: em conta propria o Terraform cria a role. No AWS Academy/Learner Lab nao
# ha permissao de IAM, entao informe a role existente (ex.: LabRole).
# ---------------------------------------------------------------------------
variable "lambda_role_arn" {
  description = "ARN de uma role existente. Vazio => o Terraform cria a role."
  type        = string
  default     = ""
}

variable "github_repository" {
  description = "owner/repo autorizado a assumir a role de deploy via OIDC. Vazio => nao cria role de deploy."
  type        = string
  default     = ""
}

variable "create_github_oidc_provider" {
  description = "Cria o provider OIDC do GitHub na conta (deixe false se ja existir)."
  type        = bool
  default     = false
}

# ---------------------------------------------------------------------------
# Rede: necessario apenas se o RDS estiver em subnets privadas.
# ---------------------------------------------------------------------------
variable "subnet_ids" {
  description = "Subnets privadas com rota para o RDS. Vazio => function sem VPC."
  type        = list(string)
  default     = []
}

variable "security_group_ids" {
  description = "Security groups da function (precisam de saida para a porta do RDS)."
  type        = list(string)
  default     = []
}

# ---------------------------------------------------------------------------
# Segredos e configuracao da aplicacao
# ---------------------------------------------------------------------------
variable "jwt_secret_id" {
  description = "Nome/ARN do secret com o JWT_SECRET. Vazio => o Terraform cria a partir de jwt_secret_value."
  type        = string
  default     = ""
}

variable "jwt_secret_value" {
  description = "Valor do JWT_SECRET (o MESMO usado pelo monolito). Usado apenas quando jwt_secret_id for vazio."
  type        = string
  default     = ""
  sensitive   = true
}

variable "db_secret_id" {
  description = "Nome/ARN do secret com a conexao do banco (DATABASE_URL ou JSON do RDS). Vazio => o Terraform cria a partir de database_url."
  type        = string
  default     = ""
}

variable "database_url" {
  description = "URL de conexao postgres. Usada apenas quando db_secret_id for vazio."
  type        = string
  default     = ""
  sensitive   = true
}

variable "jwt_issuer" {
  description = "Claim iss dos tokens emitidos."
  type        = string
  default     = "oficina-auth-lambda"
}

variable "jwt_audience" {
  description = "Claim aud (opcional)."
  type        = string
  default     = ""
}

variable "jwt_expires_in" {
  description = "Validade do token (formato do jsonwebtoken, ex.: 1h)."
  type        = string
  default     = "1h"
}

variable "cliente_table" {
  description = "Tabela de clientes."
  type        = string
  default     = "cliente"
}

variable "cliente_cpf_column" {
  description = "Coluna do CPF."
  type        = string
  default     = "cpf_cnpj"
}

variable "cliente_status_column" {
  description = "Coluna de status/ativo. Vazio => todo cliente encontrado e considerado ativo."
  type        = string
  default     = ""
}

variable "cliente_status_ativo_values" {
  description = "Valores da coluna de status que representam cliente ativo."
  type        = string
  default     = "true,t,1,ativo,active"
}

variable "log_level" {
  description = "Nivel de log (debug | info | warn | error)."
  type        = string
  default     = "info"
}

variable "extra_environment" {
  description = "Variaveis de ambiente adicionais da function."
  type        = map(string)
  default     = {}
}
