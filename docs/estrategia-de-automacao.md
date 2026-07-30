# Estratégia de automação

A suíte principal usa Playwright com TypeScript. Os testes de API preparam e verificam o estado sem depender da interface; os testes E2E cobrem apenas jornadas importantes para manter a execução rápida e confiável.

## Princípios

- Seletores por papel, rótulo e texto visível.
- Page Objects para comportamentos reutilizáveis.
- Massa criada dinamicamente para evitar colisões.
- Sem esperas fixas; sincronização pelo estado observável.
- Screenshot somente em falha, vídeo retido em falha e trace na primeira repetição.
- Execução paralela em Chromium, Firefox e WebKit.

## Evolução planejada

1. Ampliar contratos e cenários negativos da API.
2. Criar fixture de autenticação por `storageState`.
3. Adicionar testes de acessibilidade com axe.
4. Criar uma suíte reduzida em Cypress.
5. Demonstrar casos keyword-driven em Robot Framework.
