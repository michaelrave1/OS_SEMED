# DIRLOGISTICA - Gestao de Ordens de Servico

Aplicacao web local criada a partir das planilhas exportadas do AppSheet no arquivo `DIRLOGISTICA-314837652-20260513T161018Z-3-001.zip`.

## Como abrir

Abra o arquivo `index.html` no navegador.

Usuarios de demonstracao:

- `admin@dirlogistica.local`
- `solicitante@dirlogistica.local`
- `tecnico@dirlogistica.local`
- `logistica@dirlogistica.local`
- `gestor@dirlogistica.local`

Senha para todos: `admin123`

## O que esta implementado

- Login com perfis demonstrativos.
- Dashboard com totalizadores e indicadores por status, area e rota.
- Listagem de ordens de servico com filtros.
- Criacao e edicao de OS.
- Estabelecimento vinculado ao usuario, com alteracao permitida apenas ao administrador.
- Selecao em cascata: area de solicitacao filtra natureza, natureza filtra tipo e tipo filtra descricao.
- Status de OS e historico de alteracoes.
- Mensagens internas por OS.
- Cadastros de unidades, logistica, rotas, veiculos, motoristas e usuarios.
- Exclusao logica por ativo/inativo nos cadastros.
- Dados iniciais importados das planilhas `ABERTURA_OS`, `LOGISTICA`, `UNIDADES`, `ROTAS`, `VEICULOS` e `MOTORISTAS`.

## Estrutura

- `index.html`: entrada da aplicacao.
- `styles.css`: interface responsiva.
- `app.js`: regras de tela, filtros, formularios e persistencia local.
- `assets/seed-data.js`: dados extraidos das planilhas.
- `source-data/`: planilhas originais extraidas do ZIP.
- `scripts/extract-xlsx-data.ps1`: rotina de extracao dos dados das planilhas.
- `docs/technical-plan.md`: modelo de dados, arquitetura e evolucao para producao.

## Observacoes

Esta entrega e um prototipo funcional sem dependencias externas, usando armazenamento local do navegador. Para producao, a recomendacao e evoluir para backend Node.js, banco PostgreSQL, Prisma, JWT e upload seguro de arquivos.
