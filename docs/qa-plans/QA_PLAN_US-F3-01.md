# QA Plan — US-F3-01: Function Serverless de Autenticação por CPF

## Sumário

Valida a function Lambda que autentica por CPF (fluxos **cliente** e
**staff**), emite o JWT da solução e atua como **Lambda Authorizer** do API
Gateway. Cobre validação de CPF, regras de status (404/403/422), contrato do
token e o despacho do handler único.

## Pré-requisitos

- **Local (unitários):** Node 20+, `npm install`. Nenhuma AWS necessária —
  segredo via env `JWT_SECRET`, banco mockado.
- **Nuvem (integração):** function aplicada (`npm run package` +
  `terraform apply`), secrets no Secrets Manager, RDS acessível (VPC da
  US-F3-05) e, para o fluxo staff, a migration `usuario.cpf` (US-F3-03).
- Dado de teste: CPF válido `111.444.777-35`; inválido `111.444.777-34`.

## Cenários

### C1 — Validação de CPF (critério: valida formato antes de consultar a base)

| # | Passo | Esperado |
|---|---|---|
| C1.1 | `POST /auth` com `{"cpf":"111.444.777-34"}` | `422 {"erro":"CPF inválido"}` |
| C1.2 | `{"cpf":"11111111111"}` (dígitos iguais) | `422` |
| C1.3 | corpo sem `cpf` ou JSON malformado | `400` |
| C1.4 | verificação: nenhuma query ao banco nos casos acima | coberto por teste unitário |

### C2 — Fluxo cliente (critérios: consulta existência/status; 404; JWT)

| # | Passo | Esperado |
|---|---|---|
| C2.1 | `{"cpf":"<cpf de cliente cadastrado>"}` | `200 {"token": ...}` |
| C2.2 | decodificar o token | claims `sub`, `cpf`, `role=CLIENTE`, `iss`, `exp` (TTL 3600s) |
| C2.3 | `{"cpf":"<cpf válido não cadastrado>"}` | `404` |
| C2.4 | cliente bloqueado | **reservado** — o schema atual não tem status de cliente (nota no README) |

### C3 — Fluxo staff (critério da RFC-0003: CPF + senha)

| # | Passo | Esperado |
|---|---|---|
| C3.1 | `{"cpf":"<cpf do staff>","senha":"<correta>"}` | `200`, token com `role` do usuário |
| C3.2 | senha incorreta | `403 {"erro":"Credenciais inválidas"}` (sem revelar qual credencial) |
| C3.3 | usuário `ativo=false` | `403` |
| C3.4 | CPF válido sem usuário associado | `404` |
| C3.5 | senha vazia | `400` |

### C4 — Lambda Authorizer (critério: valida o JWT nas rotas sensíveis)

| # | Passo | Esperado |
|---|---|---|
| C4.1 | rota protegida com `Authorization: Bearer <token de C2.1>` | `isAuthorized=true`, contexto `sub/role/cpf` chega ao backend |
| C4.2 | sem header / esquema não-Bearer | `isAuthorized=false` (gateway devolve 401) |
| C4.3 | token expirado, segredo errado ou `iss` divergente | `isAuthorized=false`, sem exceção |

### C5 — Segurança e operação

| # | Passo | Esperado |
|---|---|---|
| C5.1 | inspecionar logs (CloudWatch) após C1–C3 | JSON estruturado; CPF sempre `***.***.***-NN` |
| C5.2 | falha de infra (RDS fora) | `500 {"erro":"Erro interno"}`, detalhe só no log |
| C5.3 | segredos | assinatura via Secrets Manager (`JWT_SECRET_ARN`), nada hardcoded |
| C5.4 | invocações consecutivas no mesmo container | conexão RDS reaproveitada (pool em escopo de módulo) |

## Rastreabilidade (critério → cenários)

| Critério de aceite | Cenários |
|---|---|
| Valida formato do CPF antes da base | C1.* |
| Consulta existência/status na base | C2.1–C2.4, C3.3 |
| 404 / 403 / 422 | C2.3, C3.2–C3.4, C1.1 |
| JWT com claims sub/cpf/role/iss/exp | C2.2, testes `jwt.spec.ts` |
| Segredo via Secrets Manager | C5.3 |
| Decisão staff conforme RFC | C3.* |
| Conexão RDS reaproveitada | C5.4 |
| Logs JSON com CPF mascarado | C5.1, teste "nunca loga o CPF completo" |
| Testes unitários + contrato do token | suíte `npm test` (47 testes, cobertura ≥ 80%) |
| Artefato de deploy documentado | README "Como testar e deployar" + `terraform/` |

## Checklist de validação

- [ ] `npm test` e `npm run test:cov` verdes
- [ ] `terraform validate` verde
- [ ] C1–C4 executados via gateway após o apply (curls do README do gateway)
- [ ] C5.1 conferido no CloudWatch
- [ ] Migration `usuario.cpf` aplicada antes de liberar o fluxo staff (US-F3-03)
