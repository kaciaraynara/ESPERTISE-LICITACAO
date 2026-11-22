/**
 * @deprecated Controller legado do CRM, mantido apenas como registro histórico.
 *
 * Este arquivo continha oportunidades e métricas fictícias (por exemplo,
 * "opp-01", valores estimados e taxa de conversão inventados) e não é
 * importado por nenhuma rota.
 *
 * A fonte oficial do CRM é `backend/src/controllers/pipeline.controller.ts`,
 * montada em `backend/src/routes/crm.routes.ts`, que lê e grava no Prisma com
 * isolamento por usuário/tenant.
 *
 * Regra de negócio: nenhum dado fictício pode ser exibido como real.
 */
export {};
