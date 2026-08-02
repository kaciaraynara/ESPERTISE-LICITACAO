# EXPERTISE Licitatória

Plataforma SaaS para empresas fornecedoras consultarem oportunidades públicas e organizarem sua operação licitatória com dados reais.

## Estado atual do produto

A superfície liberada no frontend contém somente fluxos com contrato implementado:

- autenticação por e-mail e senha, com access token em memória e refresh token em cookie;
- Página Inicial baseada nas empresas e nos documentos retornados pela API;
- Radar de Editais com consulta manual à API oficial do PNCP;
- Documentos do Licitante com upload em bucket privado e URL assinada.

Robô de lances, LEX e CRM permanecem desativados por padrão. Score, nulidades, SRP, monitoramento, propostas completas, catálogo, prazos, relatórios e configurações avançadas não são apresentados como prontos enquanto seus fluxos ponta a ponta não estiverem concluídos.

O sistema não substitui falhas de banco, storage, pagamento ou fonte oficial por dados demonstrativos.

## Estrutura

```text
EXPERTISE/
├── backend/   Node.js, Express, TypeScript, Prisma e PostgreSQL
├── frontend/  React, Vite, TypeScript e Tailwind CSS
└── docs/      auditorias e documentação técnica
```

## Requisitos

- Node.js 20 ou superior;
- PostgreSQL acessível pela `DATABASE_URL`;
- credenciais reais do Supabase Storage para upload de documentos;
- credenciais e IDs de planos do Mercado Pago para checkout;
- acesso de rede ao PNCP para o Radar.

## Backend

```powershell
cd backend
npm install
npm run migrate
npm run dev
```

Processos de produção:

```powershell
npm run build
npm run start:api
npm run start:worker
```

O processo da API não deve executar agendamentos. O worker é o ponto de entrada exclusivo dos jobs.

Endpoints operacionais:

- `GET /health`: liveness;
- `GET /health/readiness`: conexão real com PostgreSQL;
- `/api-docs`: contrato OpenAPI;
- `/api/v1/auth/*`: autenticação;
- `/api/v1/empresas`: empresas da conta;
- `/api/v1/licitacoes`: consulta manual ao PNCP;
- `/api/v1/documentos`: documentos;
- `/api/v1/pagamentos/*`: planos, checkout e webhook do Mercado Pago.

Use [`.env.example`](./backend/.env.example) como inventário de configuração. Não copie valores de exemplo para produção.

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

Validação:

```powershell
npm run lint
npm run test
npm run build
```

O build gera SSG apenas para `/`, `/login` e `/register`. A área `/fornecedor/*` permanece SPA protegida.

## Feature flags

As flags abaixo são `false` por padrão:

```dotenv
ENABLE_BID_ROBOT=false
ENABLE_LEX=false
ENABLE_CRM=false
ENABLE_DEMO_DATA=false
ENABLE_JSON_FALLBACK=false
```

Ativar uma flag não substitui a necessidade de credenciais, persistência, autorização e testes do respectivo módulo.

## Regra de integridade

Nenhum endpoint ou tela de produção deve retornar edital, empresa, documento, métrica, pagamento, resposta jurídica ou sucesso de integração fictício. Na ausência de dado real, a resposta correta é estado vazio; na falha de dependência, a resposta correta é erro explícito.
