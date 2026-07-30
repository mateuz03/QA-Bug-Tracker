# Arquitetura do QA Truker

## Visão do produto

O QA Truker usa um modelo neutro de cenário. A interface e a extensão produzem os mesmos tipos de passos, enquanto o worker é responsável por interpretá-los com Playwright.

```text
Interface React ─┐
                 ├─→ API Express → SQLite/Prisma ← Worker
Extensão Chrome ─┘                     │
                                       ↓
                              Fila persistida
                                       │
                                       ↓
                         Resultado + screenshot + bug
```

## Entidades implementadas

- `Project` e `Environment`
- `Requirement`
- `TestScenario` e `ScenarioStep`
- `RecordingSession` e `RecordedEvent`
- `TestExecution`, `ExecutionStep`, `ExecutionLog` e `ExecutionEvidence`
- `Bug`
- `User`

## Modelo de passo

| Ação | Target | Value | Expected |
|---|---|---|---|
| `NAVIGATE` | — | caminho ou URL | — |
| `FILL` | seletor CSS | conteúdo | — |
| `CLICK` | seletor CSS | — | — |
| `SELECT` | seletor CSS | opção | — |
| `CHECK` | seletor CSS | — | — |
| `ASSERT_TEXT` | seletor opcional | — | texto |
| `ASSERT_VISIBLE` | seletor CSS | — | — |
| `ASSERT_URL` | — | — | fragmento da URL |

## Execução

O endpoint cria uma execução em `QUEUED` e responde imediatamente. Um processo separado consulta a fila, reivindica o próximo item e altera o status para `RUNNING`. A interface consulta o progresso automaticamente.

O worker persiste heartbeat, etapa atual, percentual e logs. Também respeita timeout global do cenário e timeout específico por passo. Uma combinação de cenário, ambiente e navegador só pode possuir uma execução ativa por vez.

## Evidências

Cada cenário define sua política de captura:

- screenshots desativados, somente em falhas ou em todos os passos;
- vídeo WebM;
- trace do Playwright;
- eventos de console e erros da página;
- respostas HTTP e falhas de rede;
- prazo de retenção entre 1 e 365 dias.

Os arquivos ficam em `backend/storage/executions/<codigo>` e seus metadados ficam em `ExecutionEvidence`. Evidências manuais usam o mesmo catálogo, com autor, descrição, MIME type e tamanho. O worker remove pacotes expirados e a interface também permite exclusão individual.

`ExecutionStep` preserva ação, valor esperado e resultado encontrado. Relatórios PDF e CSV são gerados a partir do estado persistido, mantendo o histórico independente do cenário atual.

Na primeira falha:

1. o erro técnico é registrado;
2. passos restantes são ignorados;
3. um screenshot é salvo;
4. a execução recebe o status `FAILED`;
5. o usuário pode gerar um bug preenchido.

Execuções em fila ou em andamento podem receber cancelamento. Execuções finalizadas podem gerar uma nova tentativa vinculada à original.

## Evolução para produção

- PostgreSQL/Supabase para colaboração.
- Supabase Auth para identidade.
- Storage/S3 para screenshots, vídeos e traces.
- Redis/BullMQ para fila distribuída e múltiplos workers.
- Worker Playwright em container com política explícita de acesso à rede.
- WebSocket ou SSE para substituir o polling do progresso.
- Storage S3/Supabase para evidências e URLs temporárias assinadas.
- Cofre de segredos para variáveis dos ambientes.
