# Plano de publicação

## Arquitetura alvo da demonstração

- Frontend: hospedagem estática com variável `VITE_API_URL`.
- API: serviço Node.js com health check.
- Banco: PostgreSQL gerenciado.
- Evidências: armazenamento de objetos com acesso temporário.
- Worker: processo ou container separado com navegadores Playwright.

## Checklist

- [ ] Escolher provedor para frontend, API, banco, storage e worker.
- [ ] Criar ambientes de homologação e demonstração.
- [ ] Migrar o datasource Prisma de SQLite para PostgreSQL.
- [ ] Criar migrations para produção.
- [ ] Configurar segredos fora do repositório.
- [ ] Configurar CORS para o domínio público.
- [ ] Persistir evidências em storage externo.
- [ ] Disponibilizar health checks da API e do worker.
- [ ] Executar seed idempotente do ambiente de demonstração.
- [ ] Validar login, execução, evidências e criação de bug ponta a ponta.
- [ ] Capturar dashboard, detalhes da execução e backlog de bugs para o README.
- [ ] Gravar um vídeo curto seguindo o roteiro de demonstração.
- [ ] Configurar monitoramento e política de custos.
- [ ] Documentar URL pública e limitações da demonstração no README.

## Critério de publicação

A demonstração será considerada pronta quando um visitante puder entrar com credenciais públicas, executar `CT-001`, acompanhar o resultado e criar um bug sem acesso ao código ou à infraestrutura.
