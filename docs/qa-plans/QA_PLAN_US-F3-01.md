# QA Plan — US-F3-01: Function Serverless de Autenticação por CPF

## Sumário

Valida a function Lambda que autentica por CPF (fluxos **cliente** e
**staff**), emite o JWT da solução e atua como **Lambda Authorizer** do API
Gateway. Cobre validação de CPF, regras de status (400/403/404/422), contrato
do token, mascaramento em logs e o despacho do handler único.

## Pré-requisitos

- **Local (unitários):** Node 20+, `npm ci`, `npm test`. Sem AWS — segredo via
  `JWT_SECRET`, banco mockado.
- **Local completo:** `docker compose up` + `npm run invoke:local` (ver README
  §4.2, usa `local/init.sql` com clientes de exemplo).
- **Nuvem (integração):** function aplicada (`npm run package` + workflow
  Infra/Terraform), secrets no Secrets Manager, RDS acessível (VPC da
  US-F3-05) e, para o fluxo staff, a migration `usuario.cpf` (US-F3-03).
- Dados de teste: CPF válido `529.982.247-25`; inválido `529.982.247-24`.

## Cenários

### C1 — Validação de CPF (critério: valida formato antes de consultar a base)

| #    | Passo                                       | Esperado                   |
| ---- | ------------------------------------------- | -------------------------- |
| C1.1 | `POST /auth` `{"cpf":"529.982.247-24"}`     | `422 CPF_INVALIDO`         |
| C1.2 | `{"cpf":"11111111111"}` (dígitos repetidos) | `422 CPF_INVALIDO`         |
| C1.3 | body sem `cpf` ou JSON malformado           | `400 CPF_AUSENTE`          |
| C1.4 | nenhuma query ao banco nos casos acima      | coberto por teste unitário |

### C2 — Fluxo cliente (critérios: existência/status; 404/403; JWT)

| #    | Passo                                                 | Esperado                                                       |
| ---- | ----------------------------------------------------- | -------------------------------------------------------------- |
| C2.1 | `{"cpf":"<cliente cadastrado>"}`                      | `200 {accessToken, tokenType, expiresAt, cliente}`             |
| C2.2 | decodificar o token                                   | claims `sub`, `cpf`, `nome`, `role=CLIENTE`, `iss`, `exp` (1h) |
| C2.3 | `{"cpf":"<válido não cadastrado>"}`                   | `404 CLIENTE_NAO_ENCONTRADO`                                   |
| C2.4 | cliente inativo (`CLIENTE_STATUS_COLUMN` configurada) | `403 CLIENTE_INATIVO`                                          |

### C3 — Fluxo staff (RFC-0003: CPF + senha)

| #    | Passo                                          | Esperado                                        |
| ---- | ---------------------------------------------- | ----------------------------------------------- |
| C3.1 | `{"cpf":"<staff>","senha":"<correta>"}`        | `200`, token com a role do usuário              |
| C3.2 | senha incorreta                                | `403 CREDENCIAIS_INVALIDAS` (mensagem genérica) |
| C3.3 | usuário `ativo=false`                          | `403 USUARIO_INATIVO`                           |
| C3.4 | CPF válido sem usuário associado               | `404 USUARIO_NAO_ENCONTRADO`                    |
| C3.5 | senha vazia/não-string                         | `400 SENHA_AUSENTE`                             |
| C3.6 | usuário inativo **não** tem a senha verificada | coberto por teste unitário                      |

### C4 — Lambda Authorizer (critério: valida o JWT nas rotas sensíveis)

| #    | Passo                                              | Esperado                                                |
| ---- | -------------------------------------------------- | ------------------------------------------------------- |
| C4.1 | rota protegida com `Authorization: Bearer <C2.1>`  | `isAuthorized=true`, contexto `clienteId/role/cpf/nome` |
| C4.2 | sem header / esquema não-Bearer                    | `isAuthorized=false` (gateway devolve 401)              |
| C4.3 | token expirado, segredo errado ou `iss` divergente | `isAuthorized=false`, sem exceção                       |
| C4.4 | falha de bootstrap (secret inexistente)            | nega **e loga** via fallback logger (não fica mudo)     |

### C5 — Segurança e operação

| #    | Passo                                      | Esperado                                                         |
| ---- | ------------------------------------------ | ---------------------------------------------------------------- |
| C5.1 | inspecionar logs após C1–C3                | JSON de linha única; CPF sempre `***.***.***-NN`                 |
| C5.2 | falha de infra (RDS fora)                  | `500 ERRO_INTERNO`, detalhe só no log                            |
| C5.3 | segredos                                   | assinatura via Secrets Manager (`JWT_SECRET_ID`), nada em código |
| C5.4 | invocações consecutivas no mesmo container | pool/secrets reaproveitados (cache de módulo)                    |
| C5.5 | `JWT_EXPIRES_IN=3600` (string numérica)    | token de **1h** (convertido para segundos, não ms)               |

## Rastreabilidade (critério de aceite → cenários)

| Critério                             | Cenários                               |
| ------------------------------------ | -------------------------------------- |
| Valida formato do CPF antes da base  | C1.\*                                  |
| Consulta existência/status na base   | C2.1–C2.4, C3.3                        |
| 404 / 403 / 422                      | C1.1, C2.3–C2.4, C3.2–C3.4             |
| JWT com claims sub/cpf/role/iss/exp  | C2.2, `tests/jwt-token-issuer.spec.ts` |
| Segredo via Secrets Manager          | C5.3                                   |
| Decisão staff conforme RFC           | C3.\*                                  |
| Conexão RDS reaproveitada            | C5.4                                   |
| Logs JSON sem CPF completo           | C5.1, `tests/cpf.spec.ts` (maskCpf)    |
| Testes unitários + contrato do token | `npm run test:cov` (102 testes, ≥80%)  |
| Artefato de deploy documentado       | README §5–7 + `infra/terraform/`       |

## Checklist de validação

- [ ] `npm run lint && npm run format && npm run test:cov` verdes
- [ ] `terraform -chdir=infra/terraform validate` verde
- [ ] C1–C4 executados via gateway após o apply (curls do README §4.5)
- [ ] C5.1 conferido no CloudWatch
- [ ] Migration `usuario.cpf` aplicada antes de liberar o fluxo staff (US-F3-03)
