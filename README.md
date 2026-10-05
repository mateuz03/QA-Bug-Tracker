# QA Truker

[![Quality Gate](https://github.com/mateuz03/QA-Bug-Tracker/actions/workflows/quality.yml/badge.svg)](https://github.com/mateuz03/QA-Bug-Tracker/actions/workflows/quality.yml)
![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111)
![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?logo=playwright&logoColor=white)

**QA Truker** é uma plataforma full stack de gestão e automação de qualidade. O produto conecta requisitos, cenários, gravações, execuções Playwright, evidências e bugs em uma única cadeia rastreável.

> Projeto pessoal criado para demonstrar engenharia de qualidade, automação de testes e desenvolvimento full stack aplicados a um produto completo.

```text
Projeto → Requisito → Cenário → Execução → Evidência → Bug → Reteste
```

## Destaques técnicos

- Arquitetura monorepo com frontend React, API Express e worker Node independente.
- Fila persistida com recuperação de execuções interrompidas, cancelamento e proteção contra duplicidade.
- Executor Playwright multi-browser com timeout global e por etapa.
- Catálogo de evidências com screenshots, vídeo, trace, console, rede, retenção e anexos manuais.
- Extensão Chrome própria que grava jornadas e converte eventos em cenários automatizáveis.
- Rastreabilidade ponta a ponta entre projeto, requisito, cenário, execução, evidência e bug.
- Quality Gate com lint, build e testes automatizados no GitHub Actions.

## Demonstração em 3 minutos

1. Entre com o usuário administrador de demonstração.
2. Abra o projeto **QA Truker** e confira requisitos e cobertura.
3. Execute o cenário `CT-001 — Login com usuário válido`.
4. Acompanhe o worker, os passos e as evidências produzidas.
5. A partir de uma execução reprovada, gere um bug já preenchido e rastreável.

O roteiro completo está em [Roteiro de demonstração](docs/roteiro-demonstracao.md). As decisões que orientam a arquitetura estão registradas em [Decisões técnicas](docs/decisoes-tecnicas.md).

## MVP implementado

- Login, proteção de rotas e perfis administrador/analista.
- Projetos com responsável, repositório e múltiplos ambientes.
- Requisitos com indicador de cobertura.
- Cenários manuais ou automatizados com passos neutros.
- Suítes reutilizáveis, planos por versão e ciclos de regressão.
- Execuções em lote vinculadas ao ciclo que as originou.
- Painel detalhado do ciclo com resultados automáticos e manuais.
- Fechamento automático quando todos os cenários recebem resultado final.
- Edição de planos e suítes com preservação dos ciclos já criados.
- Comparação entre ciclos com taxa de aprovação, regressões e melhorias.
- Agendamento, reagendamento e início automático de ciclos pelo worker.
- Controle de acesso por projeto com papéis de proprietário, gestor e leitor.
- Trilha de auditoria para criação de projetos, requisitos e alterações de membros.
- Ações de navegação, preenchimento, clique, seleção e validação.
- Worker Playwright com Chromium, Firefox e WebKit.
- Fila persistida no banco com worker executado em processo separado.
- Progresso automático, cancelamento e reexecução.
- Timeout configurável por cenário e por passo.
- Proteção contra execuções duplicadas e log detalhado.
- Resultado, duração e comparação esperado × encontrado por passo.
- Screenshots configuráveis por falha ou por passo.
- Vídeo WebM, trace Playwright, console e tráfego de rede.
- Central de evidências com anexos manuais e política de retenção.
- Relatório individual exportável em PDF e CSV.
- Criação de bug preenchido a partir de execução reprovada.
- Vínculo entre projeto, cenário, execução e bug.
- Extensão Chrome Manifest V3 para gravação inicial de jornadas.
- Dashboard, filtros, pesquisa, paginação e API REST.
- Testes E2E/API e pipeline GitHub Actions.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Interface | React 19, TypeScript e Vite |
| API | Node.js, Express e Zod |
| Persistência local | SQLite e Prisma |
| Executor | Playwright e Node.js |
| Gravador | Extensão Chrome Manifest V3 |
| Qualidade | Playwright Test, ESLint e GitHub Actions |

SQLite mantém a demonstração local simples. A evolução planejada para ambiente compartilhado usa PostgreSQL/Supabase, Storage para evidências e um worker isolado em container.

## Arquitetura

```mermaid
flowchart LR
    WEB["Frontend React"] --> API["API Express"]
    EXT["Extensão Chrome"] --> API
    API --> DB[("SQLite / Prisma")]
    WORKER["Worker Playwright"] --> DB
    WORKER --> BROWSERS["Chromium · Firefox · WebKit"]
    BROWSERS --> FILES["Screenshots · Vídeos · Traces · Logs"]
    FILES --> API
```

O frontend cria e acompanha execuções pela API. O worker reivindica itens da fila pelo banco, executa os passos no navegador e persiste resultados e metadados das evidências. Essa separação evita que testes demorados bloqueiem requisições HTTP.

## Estrutura

```text
qa-truker/
├── frontend/                    # SPA React
├── backend/                     # API, Prisma e worker Playwright
├── apps/
│   └── recorder-extension/      # extensão Chrome do gravador
├── tests/
│   ├── api/
│   ├── e2e/
│   ├── fixtures/
│   └── pages/
├── docs/                        # estratégia e artefatos de QA
└── .github/                     # pipeline e template de bugs
```

## Executar no VS Code

Pré-requisitos: Node.js 22.13 ou superior e npm. O projeto foi validado com Node 24.11.

```powershell
nvm use 24.11.0
Copy-Item backend\.env.example backend\.env -Force
npm install
npm run db:setup
npm run dev
```

- Aplicação: `http://localhost:5173`
- API: `http://localhost:3001`
- Saúde da API: `http://localhost:3001/api/health`

### Usuários de demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | admin@qatracker.dev | Qa@123456 |
| Analista | analista@qatracker.dev | Qa@123456 |

## Fluxo do MVP

1. Abra **Projetos** e cadastre o produto e o ambiente.
2. Registre requisitos e crie cenários com passos.
3. Execute um cenário no ambiente escolhido.
4. Acompanhe fila, progresso, logs, comparações e duração de cada passo.
5. Consulte screenshots, vídeo, trace, console e rede na central de evidências.
6. Em uma falha, revise as evidências e clique em **Criar bug**.
7. O bug será vinculado ao cenário e à execução que o originaram.

O cenário `CT-001 — Login com usuário válido` já vem configurado para executar contra a própria aplicação local.

## Gravador Chrome

1. Execute a aplicação.
2. Abra `chrome://extensions`.
3. Ative **Modo do desenvolvedor**.
4. Selecione **Carregar sem compactação**.
5. Escolha `apps/recorder-extension`.
6. Configure API, token, projeto e nome do cenário no popup.

A extensão mascara senhas, captura eventos e os envia para a API. Ao finalizar, os eventos são convertidos em passos de cenário. Consulte [as instruções do gravador](apps/recorder-extension/README.md).

## Testes

```powershell
npx playwright install chromium
npm run lint
npm run build
npm run test:api
npm run test:e2e
```

Relatórios, screenshots, vídeos e traces ficam em `playwright-report/` e `test-results/`.

## Endpoints principais

| Método | Endpoint | Função |
|---|---|---|
| POST | `/api/auth/login` | Autenticar |
| GET/POST | `/api/projects` | Projetos |
| POST | `/api/projects/:id/requirements` | Requisitos |
| GET | `/api/projects/:id/members` | Listar equipe e papéis do projeto |
| PUT/DELETE | `/api/projects/:id/members/:userId` | Conceder, alterar ou remover acesso |
| GET | `/api/projects/:id/audit` | Consultar trilha de auditoria |
| GET/POST | `/api/projects/:id/api-keys` | Listar ou criar chaves de integração |
| DELETE | `/api/projects/:id/api-keys/:keyId` | Revogar uma chave de integração |
| POST | `/api/pipeline/executions` | Disparar cenário por pipeline externo |
| GET | `/api/pipeline/executions/:code` | Consultar resultado com chave do projeto |
| GET/POST | `/api/scenarios` | Cenários e passos |
| GET/POST | `/api/test-plans` | Planos de teste por projeto e versão |
| GET/POST | `/api/test-plans/suites` | Suítes reutilizáveis |
| PUT | `/api/test-plans/:id` | Atualizar plano, status e suítes vinculadas |
| PUT | `/api/test-plans/suites/:id` | Atualizar suíte e seus cenários |
| GET | `/api/test-plans/:id/comparison` | Comparar resultados de dois ciclos |
| POST | `/api/test-plans/:id/cycles` | Criar ciclo de regressão |
| GET | `/api/test-plans/cycles/:id` | Acompanhar progresso e resultados do ciclo |
| POST | `/api/test-plans/cycles/:id/start` | Executar cenários automatizados do ciclo |
| PATCH | `/api/test-plans/cycles/:id/schedule` | Agendar, reagendar ou remover o agendamento |
| PATCH | `/api/test-plans/cycles/:id/scenarios/:scenarioId` | Registrar resultado manual |
| POST | `/api/executions` | Adicionar cenário à fila |
| GET | `/api/executions/:id` | Resultado e evidências |
| POST | `/api/executions/:id/cancel` | Cancelar execução |
| POST | `/api/executions/:id/retry` | Executar novamente |
| POST | `/api/executions/:id/evidences` | Anexar evidência |
| DELETE | `/api/executions/:id/evidences/:evidenceId` | Remover evidência |
| PATCH | `/api/executions/:id/retention` | Alterar retenção |
| GET | `/api/executions/:id/report.pdf` | Relatório PDF |
| GET | `/api/executions/:id/report.csv` | Exportação CSV |
| POST | `/api/executions/:id/bugs` | Criar bug da falha |
| POST | `/api/recordings` | Iniciar gravação |
| POST | `/api/recordings/:id/events` | Receber evento |
| PATCH | `/api/recordings/:id/finish` | Converter gravação em cenário |
| GET/POST | `/api/bugs` | Gestão de bugs |
| POST | `/api/bugs/:id/github-sync` | Criar ou atualizar o GitHub Issue vinculado |
| POST | `/api/bugs/:id/jira-sync` | Criar ou atualizar a issue vinculada no Jira Cloud |

## Documentação

- [Arquitetura do MVP](docs/arquitetura-qa-truker.md)
- [Plano de testes](docs/plano-de-testes.md)
- [Matriz de riscos](docs/matriz-de-riscos.md)
- [Cenários BDD](docs/cenarios-bdd.md)
- [Estratégia de automação](docs/estrategia-de-automacao.md)
- [Relatório de execução](docs/relatorio-de-execucao.md)
- [Roteiro de demonstração](docs/roteiro-demonstracao.md)
- [Decisões técnicas](docs/decisoes-tecnicas.md)
- [Plano de publicação](docs/plano-de-publicacao.md)
- [Integração com pipelines](docs/integracao-pipelines.md)

## Como contribuir

Consulte o [guia de contribuição](CONTRIBUTING.md) para preparar o ambiente, criar uma branch e validar uma alteração. A evolução do produto é registrada no [changelog](CHANGELOG.md).

## Limites conscientes do MVP

- A fila usa SQLite e processa uma execução por worker; escala horizontal exige PostgreSQL e um broker como Redis.
- Evidências ficam no filesystem local com metadados no banco; a evolução indicada é Storage compatível com S3.
- A extensão usa um token inserido pelo usuário; uma versão publicada deve usar autenticação dedicada e restringir o ID da extensão.
- Atualizações em tempo real ainda usam polling; WebSocket ou SSE é a evolução indicada para produção.

## Roadmap

- [x] Gestão de projetos, requisitos, cenários e bugs
- [x] Fila assíncrona e worker Playwright
- [x] Evidências avançadas e relatórios PDF/CSV
- [x] Gravador inicial para Chrome
- [x] Planos, ciclos e suítes de regressão
- [x] Resultados manuais e painel consolidado do ciclo
- [x] Edição de planos e suítes reutilizáveis
- [x] Comparação entre ciclos e detecção de regressões
- [x] Agendamento de ciclos de regressão
- [ ] PostgreSQL, object storage e execução distribuída
- [ ] RBAC por projeto e trilha de auditoria
  - [x] Papéis de proprietário, gestor e leitor
  - [x] Isolamento da listagem, detalhe e requisitos por projeto
  - [x] Gestão visual de membros e histórico administrativo
  - [ ] Aplicar as permissões aos cenários, execuções, bugs, gravações e planos
  - [ ] Ampliar a auditoria para todas as mutações do produto
- [ ] Integrações com GitHub, Jira e pipelines externos
  - [x] Chaves de integração por projeto com hash, expiração e revogação
  - [x] Disparo e consulta de execuções por pipeline externo
  - [x] Exemplo documentado para GitHub Actions
  - [x] Publicar o resultado como status de commit no GitHub
  - [x] Criar e sincronizar issues no GitHub
  - [x] Criar e sincronizar issues no Jira
  - [ ] Webhooks assinados para eventos externos

## Autor

Projeto pessoal desenvolvido por [Mateus](https://github.com/mateuz03) para demonstrar práticas de QA, automação de testes, desenvolvimento full stack e desenho de uma plataforma de qualidade.
