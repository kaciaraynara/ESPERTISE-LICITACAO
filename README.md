# EXPERTISE Licitatória

Plataforma SaaS para empresas fornecedoras consultarem oportunidades públicas e organizarem sua operação licitatória com dados reais.

## Estado atual do produto

A superfície liberada no frontend contém somente fluxos com contrato implementado:

- autenticação por e-mail e senha, com access token em memória e refresh token em cookie;
- Página Inicial baseada nas empresas e nos documentos retornados pela API;
- Radar de Editais com sincronização diária do PNCP, busca em background e aderência por CNAE;
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
- token, segredo do webhook e IDs dos planos do Mercado Pago para checkout recorrente;
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

O processo da API não deve executar agendamentos. O worker é o ponto de entrada exclusivo dos jobs. Para desenvolvimento, execute `npm run dev:worker` em outro terminal. A sincronização do PNCP roda às 2h e às 14h no fuso de Brasília, controlada por `CRON_JOBS_ENABLED`, `ENABLE_CRON_JOBS` e `PNCP_CRON_SCHEDULE`.

O PNCP não recebe CNAE no endpoint de publicação. Ao abrir o Radar ou executar uma busca, a interface consulta as modalidades suportadas no PNCP e persiste os resultados; os termos deduzidos do CNAE são aplicados localmente. O worker também mantém o acervo atualizado diariamente para reduzir a dependência de uma primeira consulta manual.

Endpoints operacionais:

- `GET /health`: liveness;
- `GET /health/readiness`: conexão real com PostgreSQL;
- `/api-docs`: contrato OpenAPI;
- `/api/v1/auth/*`: autenticação;
- `/api/v1/empresas`: empresas da conta;
- `/api/v1/licitacoes`: consulta ao acervo sincronizado do PNCP, filtrado pelo perfil CNAE da empresa;
- `/api/v1/documentos`: documentos;
- `/api/v1/pagamentos/*`: planos, checkout recorrente e consulta de assinatura do Mercado Pago;
- `/api/v1/webhooks/mercadopago`: confirmação assinada de pagamentos e atualização dos planos.

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
