# Changelog

Todas as mudanças relevantes do QA Truker serão registradas neste arquivo. O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não publicado]

### Adicionado

- Suítes reutilizáveis por projeto.
- Planos de teste associados a versão e objetivo.
- Ciclos de regressão com ambiente, navegador, progresso e execução em lote.
- Vínculo rastreável entre ciclo e execução Playwright.
- Tela detalhada do ciclo com atualização automática de progresso.
- Registro de resultados, observações e responsável por testes manuais.
- Fechamento automático de ciclos com resultados manuais e automatizados.
- Edição de planos, status, versões e suítes vinculadas.
- Biblioteca visual para manutenção de suítes reutilizáveis.
- Comparação entre ciclos com variação da taxa de aprovação.
- Classificação automática de regressões, melhorias e mudanças de cobertura.
- Duas rodadas históricas no seed para demonstração do comparativo.
- Agendamento e reagendamento de ciclos com opção de execução imediata.
- Agendador no worker com reivindicação atômica para evitar início duplicado.
- Papéis `OWNER`, `MANAGER` e `VIEWER` para membros de projetos.
- Filtro de projetos acessíveis e autorização por papel para manutenção de requisitos.
- Gestão de membros na interface com promoção, rebaixamento e remoção de acesso.
- Trilha de auditoria para criação de projeto, requisito e alterações da equipe.
- Testes de API cobrindo acesso permitido, negação, promoção e revogação.
- Chaves de integração por projeto armazenadas somente como hash, com expiração, último uso e revogação.
- API externa para disparar cenários e consultar o resultado de execuções em pipelines.
- Gestão visual das chaves com exibição única do segredo.
- Auditoria dos disparos externos com origem e commit associados.
- Guia de integração com `curl` e GitHub Actions.
- Configuração segura de repositório e token do GitHub por projeto, criptografado com AES-256-GCM.
- Publicação automática de status pendente e final no commit associado à execução.
- Contexto por cenário e link direto do status do GitHub para a evidência no QA Truker.
- Vínculo genérico de bugs com ocorrências externas, preparado para GitHub e Jira.
- Criação e atualização de GitHub Issues com rastreabilidade, reprodução, evidências e erro técnico.
- Sincronização do estado local resolvido/fechado com o estado fechado do GitHub.
- Controle visual para criar, abrir e sincronizar a issue pela tela do bug.
- Configuração segura do Jira Cloud por projeto com URL, conta, chave, tipo de issue e API token cifrado.
- Criação e atualização de issues no Jira REST API v3 usando Atlassian Document Format.
- Controle visual, RBAC e auditoria para a sincronização de bugs com Jira.

### Corrigido

- Geração concorrente de códigos de cenários em criações, duplicações e conversões de gravações.

### Planejado

- Ambiente público de demonstração.
- PostgreSQL, armazenamento de objetos e fila distribuída.

## [1.0.0] - 2026-07-30

### Adicionado

- Gestão de projetos, requisitos, cenários, execuções e bugs.
- Worker Playwright com fila persistida, cancelamento e reteste.
- Evidências com screenshots, vídeos, traces, console e rede.
- Relatórios PDF e CSV por execução.
- Extensão Chrome para gravação inicial de jornadas.
- Testes de API e E2E com Quality Gate no GitHub Actions.
- Documentação de arquitetura, riscos, cenários BDD e estratégia de automação.

[Não publicado]: https://github.com/mateuz03/QA-Bug-Tracker/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/mateuz03/QA-Bug-Tracker/releases/tag/v1.0.0
