# US-F3-03: Aplicacao como Resource Server (validacao de JWT)

**User Story:** Como time de plataforma, quero que o monolito apenas valide o JWT emitido pela funcao serverless (sem emitir tokens), para ter uma unica fonte de verdade de autenticacao e reduzir a superficie de ataque.

**Prioridade:** Alta
**Story Points:** 5
**Status:** To Do
**DDD Domain:** Autenticacao (Bounded Context)
**DDD Layer:** Infrastructure + Interface
**Repositorio:** 4 — `soat-fiap-oficina-mecanica-app` (este repo)

## Contexto

Decisao da Fase 3: **substituir toda a autenticacao pela funcao serverless de
CPF**. O monolito deixa de emitir tokens e passa a ser **resource server**
(valida-apenas), confiando no emissor (`iss`) e na chave/segredo compartilhados
com a Lambda ([f3-01](f3-01-serverless-cpf-auth.md)).

## Criterios de Aceite

- [ ] **Remover** o `POST /auth/login` (e-mail/senha) e a logica de emissao de token do monolito
- [ ] Guard/estrategia JWT valida tokens emitidos pela Lambda (mesma chave/segredo, checagem de `iss` e `exp`)
- [ ] Rotas sensiveis exigem token valido; `@Public()` mantido para rotas publicas (ex.: consulta de status de OS)
- [ ] Autorizacao por **role/claim** derivada do token (ex.: `CLIENTE` so acessa as proprias OS)
- [ ] Remover/reaproveitar codigo morto de login (senha, hashing) sem quebrar `usuario`/dominio
- [ ] Migracao de dados/documentacao: como o staff passa a autenticar (conforme RFC de auth)
- [ ] `architecture.spec.ts` continua verde (regra de dependencia preservada)
- [ ] Atualizar Swagger (remover `/auth/login`, documentar o header `Authorization: Bearer` vindo do gateway)
- [ ] Testes unitarios/integracao do guard atualizado; testes do login removido ajustados
- [ ] Atualizar `docs/curls-usuario.md` e demais docs que referenciam o login antigo

## Riscos / Notas

- As UIs `web/admin` e `web/cliente` que usam `/auth/login` precisam apontar para o novo fluxo (gateway + CPF). Mapear impacto.
