# Plano técnico - DIRLOGISTICA

## 1. Análise das tabelas

`ABERTURA_OS` é a tabela central da operação. Ela registra quem abriu a solicitação, estabelecimento, classificação logística, descrição, responsável, motorista, veículo, rota, anexos e mensagens.

`LOGISTICA` organiza a classificação da solicitação em área, natureza, tipo, descrição e detalhamento. Essa tabela deve alimentar listas dependentes no formulário de abertura de OS.

`UNIDADES` representa os estabelecimentos atendidos. Inclui tipo, nome, endereço e coordenadas.

`ROTAS`, `VEICULOS` e `MOTORISTAS` são cadastros de apoio usados na etapa de atribuição logística.

## 2. Modelo entidade-relacionamento em texto

```text
roles 1---N users
users 1---N work_orders (opened_by_user_id)
units 1---N users
users 1---N work_orders (responsible_user_id)
units 1---N work_orders
logistics_categories 1---N work_orders
routes 1---N work_orders
vehicles 1---N work_orders
drivers 1---N work_orders
work_orders 1---N work_order_messages
work_orders 1---N work_order_history
work_orders 1---N attachments
```

## 3. Tabelas recomendadas

### users

- id
- name
- email
- password_hash
- role_id
- unit_id
- active
- created_at
- updated_at

### roles

- id
- name
- permissions

### work_orders

- id
- opened_by_user_id
- unit_id
- logistics_category_id
- opened_at
- occurred_at
- status
- description
- detail
- observation
- has_material
- police_report
- responsible_user_id
- driver_id
- vehicle_id
- route_id
- active
- created_at
- updated_at

### work_order_messages

- id
- work_order_id
- user_id
- message
- created_at

### work_order_history

- id
- work_order_id
- user_id
- action
- previous_value
- new_value
- created_at

### units

- id
- type
- name
- address
- lat
- lng
- active

### logistics_categories

- id
- area
- nature
- type
- description
- detail
- options
- reminder
- active

### routes

- id
- route_code
- name
- number
- map_link
- active

### vehicles

- id
- plate
- model_type
- passenger_capacity
- active

### drivers

- id
- name
- active

### attachments

- id
- work_order_id
- uploaded_by_user_id
- file_name
- mime_type
- storage_path
- size_bytes
- created_at

## 4. Requisitos funcionais

- Autenticação por e-mail e senha.
- Perfis: Administrador, Solicitante, Responsável/Técnico, Logística e Gestor/Consulta.
- Abertura de OS com ID único e data automática.
- Estabelecimento vinculado ao usuário. Cada usuário pertence a uma única unidade e somente administradores podem alterar esse vínculo.
- Listas dependentes de logística em cascata com base no CSV `LOGISTICA - LOGISTICA.csv`: área filtra natureza, natureza filtra tipo, tipo filtra descrição e descrição filtra detalhamento.
- Responsável da OS definido pelo cadastro de responsável da área de solicitação.
- Solicitantes não podem alterar status; somente administrador e responsável vinculado à OS podem fazer essa alteração.
- Campo de anexos com upload de arquivos, imagens, PDFs, documentos e planilhas.
- Atribuição de responsável, motorista, veículo e rota.
- Alteração de status com histórico.
- Mensagens internas por OS.
- CRUD para unidades, logística, rotas, veículos e motoristas.
- Upload de fotos, PDFs, documentos e imagens.
- Dashboard administrativo.
- Filtros por ID, unidade, área, natureza, tipo, responsável, motorista, veículo, rota, status e datas.
- Exclusão lógica dos registros principais.

## 5. Requisitos não funcionais

- Interface responsiva.
- API REST versionada.
- Validação no frontend e backend.
- Auditoria das alterações relevantes.
- Senhas com hash forte.
- JWT com expiração.
- Controle de permissões por perfil.
- Banco normalizado.
- Índices para campos de busca e relacionamento.
- Armazenamento seguro de arquivos.

## 6. Casos de uso

- Solicitante abre uma nova OS.
- Administrador revisa e atribui responsável.
- Responsável altera status e registra mensagens.
- Logística vincula motorista, veículo e rota.
- Gestor consulta indicadores e filtra ordens.
- Administrador mantém cadastros de apoio.

## 7. Arquitetura recomendada

Frontend:

- React ou Next.js.
- Rotas protegidas por perfil.
- Componentes de formulário reutilizáveis.
- Camada de serviço para API REST.

Backend:

- Node.js com NestJS ou Express.
- Prisma ORM.
- PostgreSQL.
- JWT.
- Multer ou storage S3 compatível para anexos.
- Logs estruturados.

Banco:

- Migrations versionadas.
- Seeds a partir das planilhas importadas.
- Índices em status, opened_at, unit_id, logistics_category_id, route_id, vehicle_id e driver_id.

## 8. Estrutura de pastas para produção

```text
dirlogistica/
  apps/
    web/
      src/
        components/
        pages/
        services/
        styles/
    api/
      src/
        auth/
        users/
        work-orders/
        catalogs/
        attachments/
        audit/
  prisma/
    schema.prisma
    migrations/
    seed/
  docs/
  docker-compose.yml
  README.md
```
