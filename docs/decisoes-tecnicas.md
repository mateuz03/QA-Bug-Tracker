# Decisões técnicas

Este documento resume as escolhas do MVP e demonstra os trade-offs considerados durante o desenvolvimento.

## Monorepo com workspaces npm

Frontend e backend compartilham scripts e dependências de desenvolvimento sem exigir uma ferramenta adicional de orquestração. A estrutura mantém a demonstração simples e permite evoluir para Turborepo caso o número de pacotes aumente.

## React e Vite no frontend

React oferece composição de interface e ecossistema amplo. Vite reduz o tempo de inicialização e mantém o build de produção direto. O MVP usa uma SPA porque não possui requisito de indexação pública.

## Express e Zod na API

Express torna explícito o fluxo HTTP e Zod concentra validação na fronteira da aplicação. A escolha favorece leitura em um projeto de portfólio e permite migrar serviços de domínio sem acoplar o produto a um framework maior.

## Prisma e SQLite no MVP

SQLite elimina dependências externas e deixa a avaliação local reproduzível. A limitação é consciente: colaboração, concorrência e múltiplos workers exigirão PostgreSQL e migrations adequadas.

## Worker Playwright separado da API

Execuções de navegador podem ser demoradas e consumir muitos recursos. A API apenas cria itens na fila persistida; um processo independente reivindica e executa o trabalho. Assim, requisições HTTP não ficam bloqueadas pela automação.

## Evidências no filesystem

O MVP grava arquivos localmente e mantém metadados no banco. Isso simplifica a execução local, mas a versão hospedada deverá usar armazenamento de objetos, URLs assinadas e políticas de retenção.

## Polling no acompanhamento

O frontend consulta o progresso periodicamente porque é uma solução previsível para o MVP. SSE ou WebSocket será adotado quando a infraestrutura compartilhada estiver pronta.

## Quality Gate

Cada mudança relevante deve passar por lint, build e testes automatizados. Relatórios Playwright são publicados como artefatos para facilitar diagnóstico e apresentação de evidências.
