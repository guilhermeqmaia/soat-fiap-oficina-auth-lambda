terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }

  # Backend parcial: os valores vem do `terraform init -backend-config=...`
  # (o workflow infra.yml usa os secrets TF_STATE_BUCKET / TF_STATE_KEY).
  # Para rodar so um plan local sem state remoto: terraform init -backend=false
  backend "s3" {}
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      Repository  = "software-architecture-tech-challenge-lambda"
    }
  }
}
