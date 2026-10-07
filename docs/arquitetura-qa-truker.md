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
- `ProjectMember`, `ProjectApiKey` e `AuditLog`
- `BugExternalIssue`
- `Requirement`
- `TestScenario` e `ScenarioStep`
- `TestSuite`, `TestPlan` e `TestCycle`
- `RecordingSession` e `RecordedEvent`
- `TestExecution`, `ExecutionStep`, `ExecutionLog` e `ExecutionEvidence`
- `Bug`
- `User`

Suítes pertencem ao projeto e podem ser reutilizadas em diferentes planos. Ao criar um ciclo, os cenários das suítes selecionadas são preservados em `TestCycleScenario`. Cada `TestExecution` pode apontar para o ciclo que a originou, permitindo consolidar progresso e resultados sem perder a rastreabilidade individual.

Para cenários manuais, `TestCycleScenario` registra resultado, observações, responsável e horário. Cenários automatizados usam a execução mais recente do próprio ciclo. Um serviço compartilhado consolida ambos os tipos e encerra o ciclo automaticamente quando todos possuem resultado final.

A comparação de ciclos resolve o resultado efetivo de cada cenário nas duas rodadas e classifica a transição como regressão, melhoria, alteração, inclusão, remoção ou estabilidade. A taxa de aprovação é calculada separadamente para preservar a leitura histórica de cada ciclo.

Ciclos planejados podem armazenar `scheduledAt`. O worker consulta os horários vencidos a cada cinco segundos e usa uma atualização atômica de `PLANNED` para `RUNNING` antes de criar as execuções. Assim, chamadas simultâneas do agendador e da ação “Executar agora” não iniciam o mesmo ciclo duas vezes. Reagendar ou remover o horário é permitido apenas enquanto o ciclo permanece planejado.

## Segurança e governança por projeto

Administradores possuem acesso global. Nos demais casos, `ProjectMember` concede um papel por projeto: `OWNER` administra a equipe, `MANAGER` mantém conteúdo e consulta auditoria, e `VIEWER` possui acesso de leitura. O proprietário definido em `Project.ownerId` sempre recebe acesso efetivo de `OWNER`, mesmo durante a migração de dados antigos.

O serviço compartilhado de autorização compara o papel efetivo com o mínimo exigido pela operação. A listagem de projetos também aplica esse escopo no banco, evitando expor projetos dos quais o usuário não participa. Nesta primeira etapa, o controle cobre projetos, membros, detalhes e requisitos; os demais módulos estão explicitamente mantidos no roadmap da Prioridade 3.

`AuditLog` registra ator, ação, entidade, projeto, data e detalhes estruturados. Os primeiros eventos cobertos são criação de projeto, criação de requisito e inclusão, alteração ou remoção de membros.

## Integrações externas

`ProjectApiKey` fornece uma identidade técnica limitada a um único projeto. O valor aleatório usa 256 bits, começa com `qtk_` e é apresentado somente na criação; o banco persiste apenas o hash SHA-256 e um prefixo seguro para identificação. Expiração, revogação, último uso e situação do usuário criador participam da validação.

A rota de pipeline resolve cenário e ambiente dentro do projeto da chave antes de enfileirar uma execução. O consumidor recebe um código rastreável e consulta o resultado com a mesma credencial. Disparos externos também geram `AuditLog` com origem, navegador e commit, sem registrar o segredo.

A configuração opcional `GitHubIntegration` mantém o token cifrado com AES-256-GCM e chave externa à base. Quando uma execução possui `commitSha`, o serviço publica um commit status pela API REST oficial do GitHub: `pending` no disparo e um estado final após o worker concluir ou cancelar a rodada. Falhas de comunicação são registradas no log da execução e em `lastError`, mas não alteram o resultado do teste.

`BugExternalIssue` desacopla o bug local do provedor externo. O par bug/provedor é único e mantém chave, URL, estado, último envio, erro e metadados. Os adaptadores de GitHub e Jira reutilizam esse contrato sem inserir campos específicos de cada fornecedor diretamente em `Bug`.

`JiraIntegration` mantém URL do site, conta, projeto e tipo de issue, enquanto o API token usa a mesma cifra AES-256-GCM das demais credenciais. O adaptador aceita apenas sites HTTPS `*.atlassian.net`, usa a API REST v3 e produz descrições em Atlassian Document Format. Transições não são automatizadas porque cada projeto pode definir seu próprio workflow; a sincronização atualiza somente os campos portáveis e preserva o estado controlado no Jira.

`ProjectWebhook` fornece uma entrada segura para resultados de pipelines externos. O segredo aleatório é cifrado com AES-256-GCM, apresentado somente na geração ou rotação e assina o corpo original com HMAC SHA-256 junto de um timestamp. `WebhookDelivery` guarda identificador, hash do payload, evento e resultado de processamento para impedir replay por projeto sem armazenar o conteúdo recebido. Apenas resultados finais de execuções originadas por pipeline são aceitos; o processamento atualiza a execução, cria log, registra auditoria e publica o status do commit quando aplicável.

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

O endpoint cria uma execução em `QUEUED` e responde imediatamente. Um processo separado consulta a fila, reivindica o próximo item e altera o status para `RUNNING`. O mesmo processo inicia ciclos cujo agendamento venceu e adiciona seus cenários automatizados à fila. A interface consulta o progresso automaticamente.

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
