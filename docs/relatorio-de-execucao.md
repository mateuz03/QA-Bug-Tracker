# Relatório de execução

## Ciclo inicial

Status: base pronta para execução local e CI.

| Área | Cenários implementados |
|---|---:|
| Autenticação E2E | 3 |
| Cadastro de bugs E2E | 2 |
| Autenticação API | 2 |
| CRUD e validação de bugs API | 3 |
| Projetos, requisitos e cenários API | 1 |
| Conversão de gravação em cenário API | 1 |
| Execução real pelo worker Playwright e evidências | 1 |

O ciclo vertical Projeto → Requisito → Cenário → Execução foi validado. O cenário de login executou cinco passos no Chromium, foi aprovado e gerou vídeo, trace, console e rede. Upload manual, retenção, exclusão e relatórios PDF/CSV também são cobertos pela suíte de API.
