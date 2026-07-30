# QA Truker Recorder

Extensão Chrome Manifest V3 do MVP. Ela captura navegação, cliques, preenchimentos, seleções e checkboxes e envia os eventos para a API local.

## Instalação local

1. Execute a aplicação com `npm run dev`.
2. Abra `chrome://extensions`.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação**.
5. Selecione esta pasta: `apps/recorder-extension`.
6. Faça login no QA Truker e copie o token JWT do armazenamento local do navegador (`qa-token`) para a extensão.

Senhas são substituídas por `[MASKED]` antes de serem enviadas. Em produção, a origem da extensão deverá ser limitada ao ID publicado na Chrome Web Store.
