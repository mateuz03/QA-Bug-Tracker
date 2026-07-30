# Cenários BDD

## Autenticação

```gherkin
Cenário: Login de administrador
  Dado que existe um administrador ativo
  Quando ele informa e-mail e senha válidos
  Então deve acessar a visão geral

Cenário: Bloqueio por senha inválida
  Quando o usuário informa uma senha inválida
  Então deve permanecer na página de login
  E deve visualizar uma mensagem segura
```

## Ocorrências

```gherkin
Cenário: Cadastro mínimo de bug
  Dado que o analista está autenticado
  Quando informa título, descrição, severidade e prioridade
  Então o sistema deve gerar um código único
  E a ocorrência deve aparecer na listagem

Cenário: Exclusão restrita
  Dado que o usuário possui perfil analista
  Quando tenta excluir uma ocorrência pela API
  Então deve receber o código 403
  E a ocorrência deve permanecer no banco
```
