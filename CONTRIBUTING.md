# Contribuindo com o QA Truker

Obrigado por considerar uma contribuição. Este projeto prioriza mudanças pequenas, rastreáveis e acompanhadas de evidências.

## Preparar o ambiente

```powershell
nvm use 24.11.0
Copy-Item backend\.env.example backend\.env -Force
npm install
npm run db:setup
npm run dev
```

## Fluxo recomendado

1. Crie ou selecione uma issue que descreva o problema ou melhoria.
2. Abra uma branch a partir de `main` usando `feat/`, `fix/`, `test/` ou `docs/`.
3. Faça commits pequenos e com mensagens objetivas.
4. Atualize testes e documentação afetados.
5. Abra um Pull Request explicando contexto, solução e evidências.

## Quality Gate local

Antes do Pull Request, execute:

```powershell
npm run lint
npm run build
npm run test:api
npm run test:e2e
```

O Pull Request deve permanecer pequeno o bastante para uma revisão segura e não deve incluir `.env`, bancos locais, tokens ou evidências com dados sensíveis.

## Relatando bugs

Use o template de bug do GitHub e informe comportamento observado, resultado esperado, passos de reprodução, ambiente e evidências sanitizadas.
