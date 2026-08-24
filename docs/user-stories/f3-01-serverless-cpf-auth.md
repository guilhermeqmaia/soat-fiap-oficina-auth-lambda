# US-F3-01: Function Serverless de Autenticacao por CPF

**User Story:** Como Cliente, quero me autenticar informando apenas o meu CPF, para receber um token JWT e consumir as APIs protegidas sem precisar de senha.

**Prioridade:** Alta
**Story Points:** 8
**Status:** To Do
**DDD Domain:** Autenticacao (Bounded Context)
**DDD Layer:** Infrastructure (funcao serverless externa ao monolito)
**Repositorio:** 1 — `soat-fiap-oficina-auth-lambda`

## Contexto

A Fase 3 substitui o login por e-mail/senha do monolito por uma **funcao
serverless** (AWS Lambda) que passa a ser o **unico emissor de JWT**. A Lambda
fica atras do API Gateway (ver [f3-02](f3-02-api-gateway.md)) e o monolito passa
a apenas validar o token (ver [f3-03](f3-03-app-resource-server.md)).

## Criterios de Aceite

- [ ] Function serverless (AWS Lambda, Node.js/TypeScript) num repositorio proprio
- [ ] Endpoint de autenticacao recebe o **CPF** no body (ex.: `POST /auth` com `{ "cpf": "..." }`)
- [ ] **Valida o formato do CPF** (digitos verificadores) antes de consultar a base
- [ ] **Consulta a existencia e o status do cliente** na base de dados (RDS)
- [ ] Regras de status: cliente inexistente -> `404`; cliente inativo/bloqueado -> `403`; CPF invalido -> `422`
- [ ] Gera e devolve um **JWT valido** (claims: `sub`=id do cliente, `cpf`, `role`, `iss`, `exp`) assinado com segredo/chave compartilhada com o monolito
- [ ] Segredo de assinatura via **AWS Secrets Manager** (nunca hardcoded)
- [ ] Decisao de auth de **staff** (ADMIN/ATENDENTE/MECANICO/ESTOQUISTA) resolvida conforme a RFC de autenticacao ([f3-doc-01](f3-doc-01-rfcs.md)) — a Lambda cobre esse caso ou expoe fluxo staff dedicado
- [ ] Cold start e timeout adequados; conexao ao RDS reaproveitada (connection pooling / RDS Proxy quando aplicavel)
- [ ] Logs estruturados (JSON) da funcao, sem vazar CPF completo (mascarar)
- [ ] Testes unitarios (validacao de CPF, geracao de JWT, cenarios de status) + teste de contrato do payload do token
- [ ] Dockerfile (se empacotada como imagem) ou artefato de deploy documentado
- [ ] README do repo: proposito, tecnologias, como testar/deployar, diagrama do fluxo

## Fora de escopo

- Roteamento e throttling do gateway — ver [f3-02](f3-02-api-gateway.md)
- Validacao do token no monolito — ver [f3-03](f3-03-app-resource-server.md)
