import type { DataSourceCode, DataSourceDescriptor } from './types';

export const DATA_SOURCE_REGISTRY: Record<DataSourceCode, DataSourceDescriptor> = {
  tcu: {
    code: 'tcu',
    name: 'Tribunal de Contas da Uniao',
    accessMode: 'configured_api',
    envBaseUrl: 'TCU_API_BASE_URL',
    safeAccessOnly: true,
    capabilities: [
      { entityType: 'jurisprudence', supportsIncremental: true, supportsBulk: true },
      { entityType: 'legal_pattern', supportsIncremental: true, supportsBulk: false },
    ],
    notes: 'Prepared for official/configured API access only. No scraping is allowed.',
  },
  pncp: {
    code: 'pncp',
    name: 'Portal Nacional de Contratacoes Publicas',
    accessMode: 'internal_adapter',
    envBaseUrl: 'PNCP_BASE_URL',
    safeAccessOnly: true,
    capabilities: [
      { entityType: 'procurement_notice', supportsIncremental: true, supportsBulk: true },
      { entityType: 'legal_document', supportsIncremental: true, supportsBulk: true },
      { entityType: 'bidding_history', supportsIncremental: true, supportsBulk: true },
    ],
    notes: 'Uses official PNCP API adapters already present in the backend.',
  },
  compras_gov: {
    code: 'compras_gov',
    name: 'Compras.gov.br Dados Abertos',
    accessMode: 'internal_adapter',
    envBaseUrl: 'COMPRASGOV_BASE_URL',
    safeAccessOnly: true,
    capabilities: [
      { entityType: 'procurement_notice', supportsIncremental: true, supportsBulk: true },
      { entityType: 'bidding_history', supportsIncremental: true, supportsBulk: true },
    ],
    notes: 'Uses public Dados Abertos endpoints through the existing Compras.gov service.',
  },
  portal_transparencia: {
    code: 'portal_transparencia',
    name: 'Portal da Transparencia',
    accessMode: 'internal_adapter',
    envBaseUrl: 'TRANSPARENCIA_API_BASE_URL',
    safeAccessOnly: true,
    capabilities: [
      { entityType: 'bidding_history', supportsIncremental: true, supportsBulk: true },
      { entityType: 'investigation_signal', supportsIncremental: true, supportsBulk: false },
      { entityType: 'company', supportsIncremental: true, supportsBulk: true },
    ],
    notes: 'Uses configured token-based API access and existing cache/retry layer.',
  },
  receita_federal: {
    code: 'receita_federal',
    name: 'Receita Federal',
    accessMode: 'internal_adapter',
    envBaseUrl: 'BRASILAPI_BASE_URL',
    safeAccessOnly: true,
    capabilities: [
      { entityType: 'company', supportsIncremental: true, supportsBulk: true },
      { entityType: 'investigation_signal', supportsIncremental: true, supportsBulk: false },
    ],
    notes: 'Uses public/company data adapters already present in the backend.',
  },
  cade: {
    code: 'cade',
    name: 'Conselho Administrativo de Defesa Economica',
    accessMode: 'configured_api',
    envBaseUrl: 'CADE_API_BASE_URL',
    safeAccessOnly: true,
    capabilities: [
      { entityType: 'jurisprudence', supportsIncremental: true, supportsBulk: true },
      { entityType: 'investigation_signal', supportsIncremental: true, supportsBulk: false },
      { entityType: 'legal_pattern', supportsIncremental: true, supportsBulk: false },
    ],
    notes: 'Prepared for official/configured API access only. No scraping is allowed.',
  },
};

export function listDataSources() {
  return Object.values(DATA_SOURCE_REGISTRY);
}

export function getDataSourceDescriptor(source: DataSourceCode) {
  return DATA_SOURCE_REGISTRY[source];
}

export function assertSafeDataSource(source: DataSourceCode) {
  const descriptor = getDataSourceDescriptor(source);
  if (!descriptor.safeAccessOnly) {
    throw new Error(`Fonte ${source} nao esta marcada como acesso seguro.`);
  }
  return descriptor;
}
