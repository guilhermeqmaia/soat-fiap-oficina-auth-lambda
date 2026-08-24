# Auth Lambda — Oficina Mecânica (Tech Challenge FIAP Fase 3)

## About this repo

Repo **1/4** of the solution: the serverless CPF authentication function
(AWS Lambda, Node.js/TypeScript). It is the **only JWT issuer** in the system
and also serves as the **Lambda Authorizer** for the API Gateway
(repo 2, `soat-fiap-oficina-infra-k8s/gateway`). The NestJS monolith
(repo 4, `soat-fiap-oficina-mecanica-app`) is a resource server: it only
validates the tokens issued here.

**Story:** implement via `docs/user-stories/f3-01-serverless-cpf-auth.md`
(use the `/implement-story` skill). Related context: f3-02 (gateway routes)
and f3-03 (monolith contract) in the same folder.

## Non-negotiable decisions

- **Single Lambda, two handlers**: `POST /auth` (issue JWT) and the gateway
  REQUEST authorizer (payload format **2.0**, `enableSimpleResponses` — return
  `{ isAuthorized: boolean }`). Do not split into two functions.
- **Auth rules** (professor-sanctioned on the forum):
  - Cliente: CPF only → validate check digits → query client existence/status
    in RDS → issue JWT. `422` invalid CPF, `404` unknown, `403` blocked.
  - Staff (ADMIN/ATENDENTE/MECANICO/ESTOQUISTA): CPF **+ senha**, with the CPF
    validated and associated to the user record.
- **JWT**: HS256, claims `sub`, `cpf`, `role`, `iss`, `exp`. Signing secret in
  **AWS Secrets Manager** — never hardcoded, never in env files. The same
  secret is read by the monolith to validate.
- **Logs**: structured JSON, CPF always masked (e.g. `***.***.***-35`).
- **DB access**: RDS PostgreSQL (repo 3). Reuse connections across
  invocations (module-scope client); consider RDS Proxy if pooling becomes an
  issue.

## AWS Academy constraints (always apply)

- Region **us-east-1**; credentials are short-lived session credentials.
- **Cannot create IAM roles** — use the existing `LabRole` for the function.
- CI/CD credentials only via **GitHub Actions Secrets**
  (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`).

## Conventions

- English identifiers; Portuguese strings and domain terms (Cliente, Usuario,
  OrdemDeServico — ubiquitous language from the main repo).
- CPF validation (check digits) is domain logic — pure, unit-tested, no AWS
  SDK imports in it.
- Tests required: CPF validation, JWT issuing, status scenarios (404/403/422),
  token payload contract test.
- Every implemented story gets a QA plan in `docs/qa-plans/` (skill `/qa-plan`).
- `main` is protected: work on branches + PR (solo merges use
  `gh pr merge --admin`). Draft PRs by default; ask before commit/push.
