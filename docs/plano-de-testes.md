# Plano de testes

## Objetivo

Validar os fluxos críticos do QA Bug Tracker e reduzir o risco de falhas em autenticação, permissões e persistência de ocorrências.

## Escopo

- Login, logout e proteção de rotas.
- Cadastro, consulta, edição, mudança de status e exclusão de bugs.
- Filtros, pesquisa e paginação.
- Perfis `ADMIN` e `ANALYST`.
- Contratos e códigos HTTP da API.
- Compatibilidade em Chromium, Firefox e WebKit.

## Fora do escopo inicial

- Recuperação de senha por e-mail.
- Upload binário de evidências.
- Testes de carga e acessibilidade completos.

## Tipos de teste

| Camada | Cobertura | Ferramenta |
|---|---|---|
| API | autenticação, contratos, validações e CRUD | Playwright APIRequestContext |
| E2E | fluxos críticos e permissões | Playwright |
| Estática | tipos, lint e build | TypeScript, ESLint e Vite |

## Critérios de saída

- Nenhum defeito crítico ou alto em aberto.
- 100% dos cenários críticos aprovados.
- Pipeline verde nos três navegadores.
- Evidências disponíveis no relatório HTML.
