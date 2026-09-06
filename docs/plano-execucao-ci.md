# Plano de execucao — destravar o pipeline `ci.yml`

## Contexto

O projeto correto e o TypeScript introduzido no commit `8c0bdfe6`: entrypoint em
`src/index.ts`, handlers em `src/handlers/*.ts`, configuracao em `src/config/env.ts`,
caso de uso em `src/application/*.ts`, testes em `tests/*.spec.ts` com `jest.config.js`
usando o preset `ts-jest`, e build/empacotamento via `scripts/build.mjs` + `scripts/zip.mjs`.

O commit `17876915` ("versao inicial") adicionou por cima uma implementacao em
JavaScript puro (`src/handler.js` e `tests/handler.test.js`), alem de alterar o
`Dockerfile`. Esses arquivos nao pertencem ao projeto TypeScript e quebraram o
pipeline `ci.yml` no GitHub Actions.

## Causa da falha no GitHub Actions

O job `quality` do `ci.yml` roda exatamente `npm ci`, `npm run format`, `npm run lint`,
`npm run typecheck`, `npm run test:cov` e `npm run package`. Os arquivos JS reprovavam em
tres pontos:

1. `npm run format` (prettier `--check` em `**/*.{ts,js,mjs,json,md,yml}`) reprovava os
   arquivos JS adicionados, por nao estarem no estilo do projeto.
2. `npm run lint` (`eslint . --max-warnings=0`) acusava problemas em `src/handler.js` e
   `tests/handler.test.js`, que fogem das regras/tipagem configuradas para o projeto TS.
3. `npm run test:cov` falhava com `Cannot find module 'dotenv'`: o `tests/handler.test.js`
   e coletado pelo Jest (ts-jest) e importa `../src/handler`, que por sua vez faz
   `require('dotenv')` — dependencia que nao existe mais no `package.json`. A cobertura
   tambem ficava comprometida, derrubando o gate de `coverageThreshold`.

## Correcao aplicada

- Removido `src/handler.js` (handler JS paralelo ao `src/handlers/auth.handler.ts`).
- Removido `tests/handler.test.js` (teste JS que dependia de `dotenv`).
- Revertido o `Dockerfile` ao estado do commit `8c0bdfe6`: removidas as linhas
  `ARG BUILD_DEV=0` e `ENV BUILD_DEV=$BUILD_DEV` inseridas antes de `RUN npm run build`
  (a imagem volta a fazer sempre o build de producao, minificado e sem sourcemap).

Estrutura TypeScript conferida e intacta: `src/index.ts`, `src/handlers/*.ts`,
`src/config/env.ts`, `src/application/*.ts`, `src/domain/*.ts`, `src/infra/*.ts`,
`jest.config.js` (preset `ts-jest`) e `package.json` com os scripts `build`, `package`,
`typecheck`, `lint`, `format`, `test:cov` e as dependencias TS, incluindo
`@aws-sdk/client-secrets-manager`.

## Como validar localmente

Na raiz do repositorio (mesma sequencia do job `quality`):

```bash
npm ci
npm run format
npm run lint
npm run typecheck
npm run test:cov
npm run package
```

Espelhando os outros jobs do `ci.yml`:

```bash
# job "Build da imagem"
docker build -t oficina-auth-lambda:ci .

# job "Terraform fmt/validate"
terraform -chdir=infra/terraform fmt -check -recursive
terraform -chdir=infra/terraform init -backend=false
terraform -chdir=infra/terraform validate
```

Resultado obtido localmente: prettier, eslint e tsc sem erros; 79 testes passando com
cobertura global de ~98% de statements (acima dos limiares de `jest.config.js`);
`lambda.zip` gerado; `npm audit --omit=dev --audit-level=high` sem vulnerabilidades;
terraform `fmt`/`validate` OK.

## Proximos passos (deploy AWS — pendente)

Nada relacionado a credenciais ou deploy foi configurado nesta etapa. Fica registrado
para uma etapa posterior:

- Definir o tipo de conta AWS a ser usada: conta propria com OIDC (`AWS_ROLE_ARN`) ou
  AWS Academy Learner Lab (credenciais estaticas temporarias:
  `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`).
- Criar os secrets/variables no GitHub (por ambiente `homolog`/`production`):
  `TF_STATE_BUCKET`, `JWT_SECRET`, `DATABASE_URL`, `AWS_REGION` e
  `LAMBDA_FUNCTION_NAME`.
- Definir a rede: VPC, subnets e security groups para a Lambda acessar o PostgreSQL.
- Somente depois disso rodar os workflows `infra.yml` (Terraform apply) e `cd.yml`
  (publicacao do codigo e movimentacao do alias).
