# Oficina Mecânica — Lambda de autenticação por CPF (Fase 3)

[![CI](https://github.com/guilhermeqmaia/soat-fiap-oficina-auth-lambda/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/guilhermeqmaia/soat-fiap-oficina-auth-lambda/actions/workflows/ci.yml) [![CD](https://github.com/guilhermeqmaia/soat-fiap-oficina-auth-lambda/actions/workflows/cd.yml/badge.svg?branch=main)](https://github.com/guilhermeqmaia/soat-fiap-oficina-auth-lambda/actions/workflows/cd.yml) [![Infra](https://github.com/guilhermeqmaia/soat-fiap-oficina-auth-lambda/actions/workflows/infra.yml/badge.svg?branch=main)](https://github.com/guilhermeqmaia/soat-fiap-oficina-auth-lambda/actions/workflows/infra.yml)

Função serverless que **autentica o cliente pelo CPF** e devolve um **JWT** usado
para consumir as APIs protegidas da aplicação (monólito NestJS da Fase 2, exposto
via API Gateway). A mesma função também atua como **Lambda Authorizer** do API
Gateway, validando o token nas rotas protegidas.

- Repositório da aplicação: https://github.com/guilhermeqmaia/soat-fiap-oficina-mecanica-app
- Runtime: Node.js 20 + TypeScript · Banco: PostgreSQL (RDS) · Segredos: AWS Secrets Manager

---

## Onde este repositório entra

```mermaid
flowchart LR
    C["Cliente / Staff"] --> GW["API Gateway<br/>(repo 2)"]
    GW -->|POST /auth| L["**Lambda de CPF**<br/>(este repo)"]
    GW -->|VPC Link| APP["Aplicação NestJS<br/>(repo 4)"]
    APP --> DB[("RDS PostgreSQL<br/>(repo 3)")]
    L --> DB
    style L fill:#e3f2fd,stroke:#1565c0,stroke-width:3px
```

**Papel deste repositório:** único emissor de JWT da solução — fluxo cliente
(só CPF) e staff (CPF + senha) — e **Lambda Authorizer** que valida o token
nas rotas protegidas do gateway.

| Repositório                                                                          | Papel                                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------ |
| **1 · este repo**                                                                    | **emite o JWT (CPF) e valida no gateway**  |
| [2 · infra-k8s](https://github.com/guilhermeqmaia/soat-fiap-oficina-infra-k8s)       | API Gateway, cluster EKS e observabilidade |
| [3 · infra-db](https://github.com/guilhermeqmaia/soat-fiap-oficina-infra-db)         | RDS PostgreSQL gerenciado                  |
| [4 · mecanica-app](https://github.com/guilhermeqmaia/soat-fiap-oficina-mecanica-app) | API NestJS, manifestos K8s e documentação  |

**Contrato da API:** por ser uma function, não há Swagger próprio — o contrato
de `POST /auth` e o do authorizer estão na seção _Contrato_ abaixo. O Swagger
das APIs protegidas fica no
[repo da aplicação](https://github.com/guilhermeqmaia/soat-fiap-oficina-mecanica-app#collection-das-apis).

## 1. O que a função faz

| #   | Passo                                                                                 | Resultado            |
| --- | ------------------------------------------------------------------------------------- | -------------------- |
| 1   | Recebe `POST /auth` com `{ "cpf": "..." }` (com ou sem máscara)                       | —                    |
| 2   | Valida o CPF pelo algoritmo dos **dígitos verificadores** (não é regex)               | CPF inválido → `422` |
| 3   | Consulta o cliente no Postgres pelo CPF normalizado (ignora máscara gravada no banco) | não existe → `404`   |
| 4   | Verifica o **status** do cliente (coluna configurável)                                | inativo → `403`      |
| 5   | Assina e devolve um **JWT HS256** com as claims do cliente                            | `200`                |

**Fluxo staff (RFC-0003, sancionado pelo professor no fórum):** com
`{ "cpf": "...", "senha": "..." }` no body, a mesma rota autentica o staff
(ADMIN/ATENDENTE/MECANICO/ESTOQUISTA) — consulta `usuario` pelo CPF, confere a
senha (bcrypt, mesmo hash `$2b$` do monólito) e emite o token com a **role do
usuário**. A presença de `senha` seleciona o fluxo.

> Dependência de schema: a coluna `usuario.cpf` (CPF único, normalizado,
> associado ao usuário) nasce na **migration da US-F3-03** no repo da
> aplicação — dono do schema. Até lá o fluxo staff responde `404`.

```
Cliente ──POST /auth──► API Gateway (HTTP API) ──► Lambda (handler `auth`)
                                                     │  valida CPF
                                                     │  SELECT cliente
                                                     │  Secrets Manager (JWT_SECRET, DB)
                                                     ▼
                                              { accessToken (JWT) }

Cliente ──GET /ordens (Authorization: Bearer …)──► API Gateway
                                                     │
                                            Lambda Authorizer (mesma function)
                                                     │ valida assinatura/iss/exp
                                                     ▼
                                              Aplicação (EKS) — resource server
```

### Contrato HTTP

`POST /auth`

```json
{ "cpf": "529.982.247-25" }
```

**200**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresAt": "2026-01-01T12:00:00.000Z",
  "cliente": { "id": "uuid", "nome": "Ana Souza", "cpf": "***.***.***-25", "role": "CLIENTE" }
}
```

Erros: `{ "error": "<code>", "message": "...", "requestId": "..." }`.

| Status | `error`                  | Quando                                                        |
| ------ | ------------------------ | ------------------------------------------------------------- |
| 400    | `CPF_AUSENTE`            | body ausente/inválido ou sem `cpf`                            |
| 400    | `SENHA_AUSENTE`          | fluxo staff com `senha` vazia/não-string                      |
| 422    | `CPF_INVALIDO`           | CPF com dígitos verificadores inválidos ou sequência repetida |
| 404    | `CLIENTE_NAO_ENCONTRADO` | CPF válido, sem cliente cadastrado (fluxo cliente)            |
| 404    | `USUARIO_NAO_ENCONTRADO` | CPF válido, sem usuário associado (fluxo staff)               |
| 403    | `CLIENTE_INATIVO`        | cliente encontrado, mas inativo/bloqueado                     |
| 403    | `USUARIO_INATIVO`        | usuário do staff desativado                                   |
| 403    | `CREDENCIAIS_INVALIDAS`  | senha incorreta (mensagem genérica de propósito)              |
| 500    | `ERRO_INTERNO`           | falha de banco/secret (detalhe só no log)                     |

No fluxo staff o `200` devolve `usuario` no lugar de `cliente`, com a role do
usuário. O CPF **nunca** aparece completo na resposta nem nos logs — apenas
mascarado (`***.***.***-25`, mesmo formato do monólito). Todos os logs são
JSON de linha única com `requestId` para correlação no CloudWatch.

### Claims do token (HS256)

```json
{
  "sub": "<id do cliente>",
  "cpf": "52998224725",
  "nome": "Ana Souza",
  "role": "CLIENTE",
  "iss": "oficina-auth-lambda",
  "iat": 1735732800,
  "exp": 1735736400
}
```

> O `JWT_SECRET` **precisa ser o mesmo** configurado na aplicação (que valida o
> token como resource server). Em produção os dois leem o mesmo secret do
> Secrets Manager.

---

## 2. Estrutura

```
src/
  domain/        cpf.ts (normaliza/valida/mascara), errors.ts (erros com status HTTP)
  application/   autenticar-cliente.use-case.ts, autenticar-staff.use-case.ts, ports.ts
  infra/         postgres-cliente.repository.ts, postgres-usuario.repository.ts,
                 bcrypt-password-verifier.ts, jwt-token-issuer.ts, secrets.ts
  handlers/      auth.handler.ts, authorizer.handler.ts
  config/env.ts  toda a configuração vem de variável de ambiente
  container.ts   composição + cache entre invocações (pool e secrets)
  index.ts       entrypoint único: despacha /auth ou authorizer
infra/terraform/  function, IAM, secrets, alias por ambiente
local/init.sql    banco de teste local com clientes de exemplo
.github/          CI (lint/testes/build), CD (deploy) e Infra (terraform)
```

Decisões relevantes:

- **Uma function, dois handlers**: é o que o módulo `03-gateway` do repo da
  aplicação já espera, e evita duplicar segredo/VPC em duas functions.
- **Pool Postgres e segredos ficam em cache no escopo do módulo**, reaproveitados
  entre invocações (warm start). `max: 1` conexão por container para não estourar
  o limite do RDS em escala.
- Nome de tabela/coluna vêm do ambiente e são **validados como identificador SQL**
  antes de entrar na query; o CPF sempre vai como parâmetro (`$1`).

---

## 3. Variáveis de ambiente

Referência completa e comentada em [`.env.example`](.env.example).

| Variável                                           | Obrigatória | Default                 | Descrição                                                                                        |
| -------------------------------------------------- | ----------- | ----------------------- | ------------------------------------------------------------------------------------------------ |
| `JWT_SECRET`                                       | local       | —                       | Segredo HS256 em texto (uso local/teste)                                                         |
| `JWT_SECRET_ID`                                    | produção    | —                       | Secret do Secrets Manager com o segredo (precede `JWT_SECRET`)                                   |
| `JWT_SECRET_JSON_KEY`                              | não         | `JWT_SECRET`            | Chave a extrair quando o secret é um JSON                                                        |
| `JWT_ISSUER`                                       | não         | `oficina-auth-lambda`   | Claim `iss`                                                                                      |
| `JWT_AUDIENCE`                                     | não         | —                       | Claim `aud` (validada se definida)                                                               |
| `JWT_EXPIRES_IN`                                   | não         | `1h`                    | Validade do token                                                                                |
| `DATABASE_URL`                                     | local       | —                       | `postgresql://user:pass@host:5432/db`                                                            |
| `DB_SECRET_ID`                                     | produção    | —                       | Secret com a connection string **ou** JSON do RDS (`username`,`password`,`host`,`port`,`dbname`) |
| `DB_SSL`                                           | não         | `true`                  | `false` apenas no Postgres local                                                                 |
| `DB_CONNECTION_TIMEOUT_MS` / `DB_QUERY_TIMEOUT_MS` | não         | `5000`                  | Timeouts                                                                                         |
| `CLIENTE_TABLE`                                    | não         | `cliente`               | Tabela de clientes                                                                               |
| `CLIENTE_CPF_COLUMN`                               | não         | `cpf_cnpj`              | Coluna do CPF                                                                                    |
| `CLIENTE_ID_COLUMN` / `CLIENTE_NOME_COLUMN`        | não         | `id` / `nome`           | Colunas mapeadas                                                                                 |
| `CLIENTE_STATUS_COLUMN`                            | não         | —                       | Coluna de status. **Vazio ⇒ todo cliente encontrado é ativo**                                    |
| `CLIENTE_STATUS_ATIVO_VALUES`                      | não         | `true,t,1,ativo,active` | Valores que significam "ativo"                                                                   |
| `CLIENTE_ROLE`                                     | não         | `CLIENTE`               | Claim `role`                                                                                     |
| `LOG_LEVEL`                                        | não         | `info`                  | `debug`/`info`/`warn`/`error`                                                                    |

> **Limitação conhecida:** a tabela `cliente` da Fase 2 ainda não tem coluna de
> status, então o `403` só passa a ocorrer depois que a coluna existir (ex.:
> `ALTER TABLE cliente ADD COLUMN ativo boolean NOT NULL DEFAULT true;`) e
> `CLIENTE_STATUS_COLUMN=ativo` for configurada.

---

## 4. Como testar

### 4.1 Testes unitários

```bash
npm ci
npm test            # ou: npm run test:cov  (com gate de cobertura)
npm run lint && npm run typecheck && npm run format
```

### 4.2 Local completo (Lambda + Postgres via Docker)

Sobe a função no **Runtime Interface Emulator** (mesmo contrato da AWS) e um
Postgres já populado por [`local/init.sql`](local/init.sql):

```bash
docker compose up --build -d
```

Clientes de exemplo: `529.982.247-25` (ativo), `11144477735` (ativo),
`98765432100` (inativo, `ativo=false`).

```bash
# 200 — token emitido
curl -s localhost:9000/2015-03-31/functions/function/invocations \
  -d '{"body":"{\"cpf\":\"529.982.247-25\"}"}' | jq

# 422 — CPF inválido
curl -s localhost:9000/2015-03-31/functions/function/invocations \
  -d '{"body":"{\"cpf\":\"11111111111\"}"}' | jq

# 404 — CPF válido sem cliente
curl -s localhost:9000/2015-03-31/functions/function/invocations \
  -d '{"body":"{\"cpf\":\"12345678909\"}"}' | jq

# 403 — cliente inativo
curl -s localhost:9000/2015-03-31/functions/function/invocations \
  -d '{"body":"{\"cpf\":\"98765432100\"}"}' | jq
```

Testando o **authorizer** com o token obtido acima:

```bash
TOKEN=$(curl -s localhost:9000/2015-03-31/functions/function/invocations \
  -d '{"body":"{\"cpf\":\"529.982.247-25\"}"}' | jq -r '.body | fromjson.accessToken')

curl -s localhost:9000/2015-03-31/functions/function/invocations \
  -d "{\"type\":\"REQUEST\",\"routeArn\":\"arn:aws:execute-api:::/GET/ordens\",\"headers\":{\"authorization\":\"Bearer $TOKEN\"}}" | jq
# => { "isAuthorized": true, "context": { "clienteId": "...", "role": "CLIENTE", ... } }
```

Logs e encerramento:

```bash
docker compose logs -f lambda
docker compose down -v
```

### 4.3 Sem Docker (Node direto)

```bash
cp .env.example .env    # ajuste DATABASE_URL/JWT_SECRET (e CLIENTE_STATUS_COLUMN, se existir)
npm run build

set -a && . ./.env && set +a
node -e "require('./dist/index.js').auth({body:JSON.stringify({cpf:'52998224725'})}).then(r=>console.log(r))"
```

### 4.4 Debug com breakpoints no VS Code

Há duas configurações prontas em `.vscode/launch.json` (aba **Run and Debug**,
`F5`) — em ambas os breakpoints são colocados direto nos arquivos `.ts`:

| Configuração                         | Para que serve                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `Debug: testes Jest (arquivo atual)` | depurar o teste aberto no editor (ou `Debug: todos os testes Jest`)                        |
| `Debug: handler local (POST /auth)`  | executa `POST /auth` de verdade contra o Postgres do compose, parando nos seus breakpoints |

O handler local precisa do banco em pé e do `.env` (o launch usa `envFile`):

```bash
docker compose up -d postgres
cp .env.example .env    # DB_SSL=false, CLIENTE_STATUS_COLUMN=ativo
```

Mude o CPF em `args` do launch, ou rode sem debugger:
`npm run invoke:local 11144477735`.

> O `build:dev` (usado automaticamente antes do debug) gera sourcemap e não
> minifica; o `build` de produção continua minificado e sem sourcemap.

### 4.5 Na AWS

```bash
aws lambda invoke --function-name oficina-auth-homolog:homolog \
  --cli-binary-format raw-in-base64-out \
  --payload '{"body":"{\"cpf\":\"52998224725\"}"}' out.json && cat out.json

# via API Gateway (URL do módulo 03-gateway do repo de infra)
curl -i -X POST "$API_URL/auth" -H 'content-type: application/json' \
  -d '{"cpf":"52998224725"}'

# rota protegida com o token
curl -i "$API_URL/clientes/me" -H "Authorization: Bearer $TOKEN"
```

Logs: `aws logs tail /aws/lambda/oficina-auth-homolog --follow`.

---

## 5. Build e empacotamento

| Comando                | O que faz                                            |
| ---------------------- | ---------------------------------------------------- |
| `npm run build`        | esbuild → `dist/index.js` (bundle CommonJS, Node 20) |
| `npm run package`      | build + `lambda.zip` (artefato de deploy)            |
| `npm run docker:build` | imagem baseada em `public.ecr.aws/lambda/nodejs:20`  |
| `npm run docker:run`   | roda a imagem no RIE com o `.env` local              |

O deploy usa o **ZIP** (mais rápido e sem ECR); o Dockerfile existe para teste
local fiel ao runtime e permite migrar para deploy por imagem quando quiser.

---

## 6. CI/CD (GitHub Actions)

| Workflow                                   | Disparo                                                    | Faz                                                                                                            |
| ------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [`ci.yml`](.github/workflows/ci.yml)       | PR e push em `main`/`homolog`                              | prettier, eslint, tsc, jest + cobertura, `lambda.zip`, `docker build`, `npm audit`, `terraform fmt/validate`   |
| [`infra.yml`](.github/workflows/infra.yml) | push em `infra/**` e manual                                | `terraform apply` (push) / `plan`/`apply`/`destroy` (manual)                                                   |
| [`cd.yml`](.github/workflows/cd.yml)       | push em `homolog` → homologação; push em `main` → produção | testes, `lambda.zip`, `update-function-code`, `publish-version`, move o **alias**, **smoke test** (espera 422) |

O CD publica uma versão nova e move o alias do ambiente — rollback é apontar o
alias para a versão anterior:

```bash
aws lambda update-alias --function-name oficina-auth-prod --name prod --function-version 7
```

### 6.1 Autenticação na AWS (dois modelos suportados)

A action [`.github/actions/aws-credentials`](.github/actions/aws-credentials/action.yml)
aceita os dois — configure **um** deles nos secrets do GitHub Environment:

- **Conta AWS própria (recomendado):** OIDC, sem chave estática. O
  `infra.yml` cria a role (`github_repository`); use o output
  `github_actions_role_arn` no secret `AWS_ROLE_ARN`.
- **AWS Academy / Learner Lab:** não permite criar IAM role, então use as
  credenciais temporárias da sessão do lab em `AWS_ACCESS_KEY_ID`,
  `AWS_SECRET_ACCESS_KEY` e `AWS_SESSION_TOKEN` (expiram — precisam ser
  renovadas a cada sessão) e informe `LAMBDA_ROLE_ARN` = `.../LabRole`.

### 6.2 Secrets e variables por ambiente

Crie os GitHub Environments **`homolog`** e **`production`**
(_Settings → Environments_):

**Secrets**

| Secret                                                            | Uso                                                      |
| ----------------------------------------------------------------- | -------------------------------------------------------- |
| `AWS_ROLE_ARN`                                                    | OIDC (conta própria)                                     |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` | alternativa ao OIDC (Learner Lab)                        |
| `AWS_TERRAFORM_ROLE_ARN`                                          | opcional: role mais permissiva só para o `infra.yml`     |
| `TF_STATE_BUCKET`                                                 | bucket S3 do state do Terraform                          |
| `JWT_SECRET_VALUE`                                                | usado só se o secret do JWT ainda não existir na conta   |
| `DATABASE_URL`                                                    | usado só se o secret do banco ainda não existir na conta |

**Variables**

| Variable                                                                    | Default               | Uso                                                  |
| --------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------- |
| `AWS_REGION`                                                                | `us-east-1`           | região                                               |
| `LAMBDA_FUNCTION_NAME`                                                      | —                     | **obrigatória no CD**; vem do output `function_name` |
| `LAMBDA_ROLE_ARN`                                                           | —                     | role existente (Learner Lab)                         |
| `TF_GITHUB_REPOSITORY`                                                      | —                     | `owner/repo` autorizado no OIDC                      |
| `CREATE_GITHUB_OIDC_PROVIDER`                                               | `false`               | `true` se a conta ainda não tem o provider           |
| `JWT_SECRET_ID`, `DB_SECRET_ID`                                             | —                     | secrets já existentes na conta                       |
| `SUBNET_IDS`, `SECURITY_GROUP_IDS`                                          | `[]`                  | obrigatórias se o RDS está em subnet privada — outputs `private_subnet_ids` e `auth_lambda_security_group_id` do stage `cluster/` (repo infra-k8s); o `aws-deploy-all.sh` grava sozinho |
| `CLIENTE_STATUS_COLUMN`                                                     | —                     | ex.: `ativo`                                         |
| `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_EXPIRES_IN`, `LOG_LEVEL`, `PROJECT_NAME` | ver tabela da seção 3 | ajustes finos                                        |

---

## 7. Levar para outra conta GitHub / AWS

1. **Fork/clone** do repositório na outra conta GitHub.
2. **AWS**: crie o bucket S3 do state
   (`aws s3 mb s3://<bucket>-tfstate --region us-east-1`).
3. Configure os Environments `homolog`/`production` com os secrets/variables da
   seção 6.2 (no mínimo: credenciais AWS + `TF_STATE_BUCKET`).
4. Rode o workflow **Infra - Terraform** (`workflow_dispatch` → `apply`,
   ambiente `homolog`). Ele cria function, role, secrets e alias.
5. Copie do resumo do job: `function_name` → variable `LAMBDA_FUNCTION_NAME`;
   `github_actions_role_arn` → secret `AWS_ROLE_ARN`.
6. Faça um PR para `homolog`; ao mergear, o **CD** publica e roda o smoke test.
7. Aplique a proteção da branch `main` (seção 8) e configure o mesmo
   `JWT_SECRET` na aplicação.

Nenhuma credencial fica no código: tudo vem de GitHub secrets/variables e do
AWS Secrets Manager.

---

## 8. Proteção da branch `main`

Regras exigidas: sem commit direto, merge **somente via Pull Request** e CI
verde. Configure em _Settings → Branches → Add rule_ ou via CLI:

```bash
gh api -X PUT repos/:owner/:repo/branches/main/protection \
  --input .github/branch-protection.json
```

O arquivo [`.github/branch-protection.json`](.github/branch-protection.json)
versiona exatamente a regra aplicada (1 aprovação, checks obrigatórios
`Lint, testes e build` / `Build da imagem` / `Terraform fmt/validate`, sem
force-push, sem deleção, conversas resolvidas), o que torna a réplica em outra
organização um único comando.

---

## 9. Troubleshooting

| Sintoma                                         | Causa provável                                                  |
| ----------------------------------------------- | --------------------------------------------------------------- |
| `Defina JWT_SECRET_ID ... ou JWT_SECRET`        | variável de ambiente faltando na function                       |
| `Task timed out` no primeiro acesso ao banco    | Lambda sem VPC/SG correto ou SG do RDS sem ingress da Lambda    |
| `no pg_hba.conf entry ... SSL off`              | `DB_SSL=false` contra RDS — use `true`                          |
| `401` na rota protegida com token recém-emitido | `JWT_SECRET`/`JWT_ISSUER` diferentes entre Lambda e aplicação   |
| `403 CLIENTE_INATIVO` inesperado                | valor da coluna de status fora de `CLIENTE_STATUS_ATIVO_VALUES` |
| CD falha em "Conferir a function"               | rode o workflow de Infra antes do primeiro deploy               |
| Smoke test do CD falhando                       | veja `aws logs tail /aws/lambda/<function> --since 10m`         |
