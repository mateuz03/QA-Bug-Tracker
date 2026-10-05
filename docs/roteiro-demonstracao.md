# Roteiro de demonstração do QA Truker

## Objetivo

Apresentar, em até quatro minutos, como o QA Truker conecta planejamento, automação, evidências e gestão de bugs em um fluxo rastreável.

## Preparação

```powershell
nvm use 24.11.0
Copy-Item backend\.env.example backend\.env -Force
npm install
npm run db:setup
npm run dev
```

Confirme antes da apresentação:

- aplicação em `http://localhost:5173`;
- API saudável em `http://localhost:3001/api/health`;
- login `admin@qatracker.dev` com a senha `Qa@123456`;
- Chromium instalado pelo Playwright;
- cenário `CT-001` disponível.

## Apresentação

### 1. Contexto — 30 segundos

“O QA Truker resolve a fragmentação entre requisitos, cenários, automação, evidências e bugs. Cada falha mantém o vínculo com o teste e a execução que a originaram.”

Mostre o dashboard e destaque os indicadores de projetos, cenários, execuções e ocorrências.

### 2. Rastreabilidade — 45 segundos

Abra o projeto de demonstração e mostre:

- ambientes configurados;
- requisito relacionado;
- cenários e indicador de cobertura;
- passos neutros que podem ser criados pela interface ou pelo gravador Chrome.

### 3. Automação — 60 segundos

Abra `CT-001 — Login com usuário válido`, escolha o ambiente e inicie a execução. Explique que a API apenas adiciona o trabalho à fila e que um worker Playwright independente processa o cenário.

Na execução, destaque status, progresso, duração, resultado por passo, logs e navegador utilizado.

### 4. Evidências e bug — 60 segundos

Abra uma execução reprovada e mostre screenshot, vídeo, trace, console ou rede. Use **Criar bug** e destaque o preenchimento automático de reprodução, resultado esperado, erro técnico, cenário e execução.

### 5. Engenharia — 30 segundos

Mostre rapidamente o GitHub Actions e explique que lint, build e testes de API/E2E formam o Quality Gate. Encerre citando a separação entre React, API Express, banco e worker Playwright.

## Plano de contingência

- Mantenha dados de demonstração previamente carregados.
- Após gerar as capturas oficiais, mantenha screenshots no README caso o navegador ou worker não possa ser executado.
- Deixe uma execução aprovada e outra reprovada já registradas.
- Não dependa de serviços externos durante a apresentação local.
