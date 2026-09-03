# Function de auth por CPF: variaveis de entrada.

variable "aws_region" {
  description = "Regiao AWS. O Learner Lab da AWS Academy opera em us-east-1."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Prefixo de nomes."
  type        = string
  default     = "oficina-mecanica"
}

variable "lab_role_arn" {
  description = "ARN da LabRole do AWS Academy (o lab nao permite criar IAM roles). Ex.: arn:aws:iam::<conta>:role/LabRole"
  type        = string

  validation {
    condition     = startswith(var.lab_role_arn, "arn:aws:iam:")
    error_message = "lab_role_arn deve ser um ARN de IAM role."
  }
}

variable "jwt_secret_arn" {
  description = "ARN do secret (Secrets Manager) com o segredo de assinatura do JWT, compartilhado com o monolito."
  type        = string
}

variable "db_secret_arn" {
  description = "ARN do secret com a DATABASE_URL do RDS (contrato do repo soat-fiap-oficina-infra-db)."
  type        = string
}

variable "vpc_subnet_ids" {
  description = "Subnets privadas da VPC (US-F3-05) para a function alcancar o RDS. Vazio = fora de VPC (apenas testes iniciais, sem acesso ao banco)."
  type        = list(string)
  default     = []
}

variable "vpc_security_group_ids" {
  description = "Security groups da function (egress para RDS 5432 e para os endpoints da AWS)."
  type        = list(string)
  default     = []
}

variable "jwt_issuer" {
  description = "Claim iss dos tokens emitidos (mesmo valor configurado no monolito para validacao)."
  type        = string
  default     = "oficina-auth-lambda"
}

variable "jwt_ttl_seconds" {
  description = "Expiracao (exp) dos tokens, em segundos."
  type        = number
  default     = 3600
}

variable "log_retention_days" {
  description = "Retencao do log group da function."
  type        = number
  default     = 7
}
