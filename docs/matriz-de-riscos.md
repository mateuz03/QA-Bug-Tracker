# Matriz de riscos

| Risco | Probabilidade | Impacto | Nível | Mitigação |
|---|---:|---:|---|---|
| Acesso não autorizado ao backlog | Média | Crítico | Alto | Testes negativos de token e permissões |
| Perda de dados ao editar bug | Média | Alto | Alto | Teste API antes/depois e validação no banco |
| Exclusão por perfil analista | Baixa | Alto | Médio | Teste de autorização `403` |
| Filtro retornar dados incorretos | Média | Médio | Médio | Massa controlada e combinação de filtros |
| Paginação omitir ou duplicar itens | Média | Médio | Médio | Validação de totais e transição de páginas |
| Layout inutilizável em mobile | Média | Médio | Médio | Viewports responsivos e inspeção visual |
| Teste instável por sincronização | Baixa | Médio | Baixo | Locators semânticos e auto-wait |
