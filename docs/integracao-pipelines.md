# Integração com pipelines

O QA Truker permite disparar um cenário automatizado sem usar o token pessoal de um usuário. Cada projeto pode possuir chaves independentes, com nome, expiração opcional, acompanhamento do último uso e revogação imediata.

## Criar a chave

1. Entre como proprietário do projeto.
2. Abra o detalhe do projeto.
3. Na seção **Integração com pipelines**, informe um nome e, opcionalmente, uma data de expiração.
4. Copie a chave exibida. O valor completo aparece somente uma vez.

Armazene a chave como segredo do provedor de CI/CD. Nunca adicione o valor ao repositório ou aos logs do job.

## Disparar um cenário

```bash
curl --fail-with-body \
  --request POST \
  --header "Content-Type: application/json" \
  --header "x-qa-api-key: $QA_TRUKER_API_KEY" \
  --data '{
    "scenarioCode": "CT-001",
    "environmentName": "Homologação",
    "browser": "chromium",
    "source": "GitHub Actions",
    "commitSha": "abc123"
  }' \
  "$QA_TRUKER_URL/api/pipeline/executions"
```

O ambiente padrão é utilizado quando `environmentId` e `environmentName` não são informados. A resposta contém `code`, `status` e `statusUrl`.

## Consultar o resultado

```bash
curl --fail-with-body \
  --header "x-qa-api-key: $QA_TRUKER_API_KEY" \
  "$QA_TRUKER_URL/api/pipeline/executions/EXEC-00042"
```

Estados finais: `PASSED`, `FAILED`, `BLOCKED` ou `CANCELLED`. O consumidor pode consultar periodicamente enquanto o estado for `QUEUED` ou `RUNNING`.

## Exemplo de GitHub Actions

Cadastre `QA_TRUKER_URL` e `QA_TRUKER_API_KEY` nos secrets do GitHub Actions.

```yaml
name: QA Truker smoke

on:
  workflow_dispatch:

jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - name: Disparar cenário
        env:
          QA_TRUKER_URL: ${{ secrets.QA_TRUKER_URL }}
          QA_TRUKER_API_KEY: ${{ secrets.QA_TRUKER_API_KEY }}
          COMMIT_SHA: ${{ github.sha }}
        run: |
          curl --fail-with-body \
            --request POST \
            --header "Content-Type: application/json" \
            --header "x-qa-api-key: $QA_TRUKER_API_KEY" \
            --data "{\"scenarioCode\":\"CT-001\",\"source\":\"GitHub Actions\",\"commitSha\":\"$COMMIT_SHA\"}" \
            "$QA_TRUKER_URL/api/pipeline/executions"
```

## Publicar o resultado no commit

No detalhe do projeto, configure **Status de commit no GitHub** com:

- repositório no formato `proprietario/repositorio`;
- fine-grained personal access token limitado ao repositório;
- permissão de repositório **Commit statuses: Read and write**.

O token é criptografado com AES-256-GCM usando `INTEGRATION_ENCRYPTION_KEY`. Use uma chave exclusiva, longa e estável em produção; trocar essa variável invalida os tokens já armazenados.

Quando o payload do pipeline contém `commitSha`, o QA Truker publica inicialmente `pending`. Ao final, o worker publica `success`, `failure` ou `error` no contexto `qa-truker/<código-do-cenário>`, com um link para a execução. A integração utiliza a versão `2026-03-10` da API REST do GitHub.

## Sincronizar bugs com GitHub Issues

Para criar e atualizar issues, o mesmo fine-grained token precisa também da permissão **Issues: Read and write**. Abra um bug já salvo e use **Criar no GitHub**. Depois do primeiro envio, a ação muda para **Sincronizar** e a interface mantém um link direto para a issue.

A sincronização envia:

- título e descrição;
- passos de reprodução;
- resultado esperado e obtido;
- severidade e prioridade;
- ambiente e navegador;
- cenário, execução, erro técnico e evidência;
- link de volta para o bug no QA Truker.

Estados `RESOLVED` e `CLOSED` fecham a issue; os demais estados mantêm ou reabrem a issue. A sincronização é explícita para que o usuário possa revisar alterações locais antes de publicá-las externamente.

## Sincronizar bugs com Jira Cloud

No detalhe do projeto, o proprietário configura **Sincronização com Jira Cloud** com:

- URL raiz HTTPS no formato `https://empresa.atlassian.net`;
- e-mail da conta Atlassian;
- API token dessa conta;
- chave do projeto, como `QA`;
- nome do tipo de issue disponível no projeto, normalmente `Bug`.

O token é cifrado com a mesma `INTEGRATION_ENCRYPTION_KEY` usada nas demais integrações. A conta Atlassian precisa conseguir visualizar o projeto e criar e editar issues. Na edição de um bug, use **Criar no Jira**; depois do primeiro envio, a ação passa a atualizar a mesma issue e mantém o link direto para o Jira.

A integração usa `/rest/api/3/issue` e envia a descrição em Atlassian Document Format. O conteúdo inclui reprodução, resultados, classificação, ambiente, cenário, execução, erro técnico, evidência e link de retorno. Como os workflows e nomes de status variam por projeto, esta versão não força transições do Jira: ela sincroniza os campos e preserva o fluxo configurado pela equipe.

## Receber resultado por webhook assinado

O proprietário do projeto pode gerar um webhook na área **Integração com pipelines**. O segredo é apresentado uma única vez e fica cifrado no banco. Configure o pipeline para enviar `POST` para:

```text
https://seu-dominio/api/webhooks/projects/ID_DO_PROJETO/pipeline
```

O corpo JSON aceito é:

```json
{
  "event": "execution.completed",
  "executionCode": "EXEC-00001",
  "status": "PASSED",
  "durationMs": 1400
}
```

`status` também aceita `FAILED`, `BLOCKED` e `CANCELLED`; para falhas, envie opcionalmente `errorMessage`.

Assine o corpo original com HMAC SHA-256 usando a sequência `timestamp + "." + corpo`, codificada em UTF-8. Envie:

- `x-qa-signature-256: sha256=<hash hexadecimal>`;
- `x-qa-timestamp: <Unix timestamp em segundos>`;
- `x-qa-delivery: <identificador único por entrega>`.

O servidor aceita timestamps de até cinco minutos, valida a assinatura em tempo constante e mantém o identificador de cada entrega por projeto. Uma entrega repetida recebe sucesso idempotente sem alterar novamente a execução. O webhook somente finaliza execuções que foram iniciadas por uma chave de pipeline externa.

## Segurança e auditoria

- Somente proprietários podem criar, listar e revogar chaves.
- O banco armazena apenas o hash SHA-256; o valor completo não pode ser recuperado.
- Chaves expiradas ou revogadas recebem `401`.
- Cada disparo registra cenário, ambiente, navegador, origem e commit na auditoria do projeto.
- A chave é limitada ao projeto ao qual pertence.

## Próximas integrações

- suportar eventos de progresso e anexos de evidências enviados pelo pipeline.
