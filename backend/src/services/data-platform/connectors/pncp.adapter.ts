import { buscarContratacoesPNCP, FiltrosBusca, LicitacaoPNCP } from '../../pncp.service';
import { DATA_SOURCE_REGISTRY } from '../source-registry';
import type { DataConnector, DataFetchInput, RawDataRecord } from '../types';

type PncpFetch = typeof buscarContratacoesPNCP;

export class PncpDataConnector implements DataConnector {
  descriptor = DATA_SOURCE_REGISTRY.pncp;

  constructor(private readonly fetchPncp: PncpFetch = buscarContratacoesPNCP) {}

  async fetch(input: DataFetchInput): Promise<RawDataRecord[]> {
    const filters = buildPncpFilters(input);
    const result = await this.fetchPncp(filters);
    const fetchedAt = new Date().toISOString();

    return result.data.map((item) => ({
      tenantId: input.tenantId ?? null,
      source: 'pncp',
      entityType: 'procurement_notice',
      externalId: item.numeroControlePNCP,
      fetchedAt,
      traceId: input.traceId ?? null,
      payload: mapPncpPayload(item),
    }));
  }
}

export function buildPncpFilters(input: DataFetchInput): FiltrosBusca {
  const filters = input.filters ?? {};
  const since = normalizeDateLike(input.since);

  return {
    palavrasChave: stringValue(filters.palavrasChave ?? filters.descricao ?? filters.q),
    uf: stringValue(filters.uf),
    municipio: stringValue(filters.municipio),
    modalidade: stringValue(filters.modalidade) ?? numberValue(filters.modalidade),
    dataInicio: stringValue(filters.dataInicio) ?? since,
    dataFim: stringValue(filters.dataFim),
    pagina: numberValue(filters.pagina) ?? numberValue(input.cursor?.cursorValue?.pagina) ?? 1,
    tamanhoPagina: input.limit ?? numberValue(filters.tamanhoPagina) ?? 50,
    valorMin: numberValue(filters.valorMin),
    valorMax: numberValue(filters.valorMax),
  };
}

export function mapPncpPayload(item: LicitacaoPNCP): Record<string, unknown> {
  return {
    numeroControlePNCP: item.numeroControlePNCP,
    objeto: item.objeto ?? '',
    modalidade: item.modalidadeNome ?? null,
    modalidadeId: item.modalidadeId ?? null,
    situacao: item.situacaoCompraNome ?? null,
    orgao: item.orgaoEntidade?.razaoSocial ?? item.unidadeOrgao?.nomeUnidade ?? null,
    orgaoRazaoSocial: item.orgaoEntidade?.razaoSocial ?? null,
    orgaoCnpj: item.orgaoEntidade?.cnpj ?? null,
    unidadeNome: item.unidadeOrgao?.nomeUnidade ?? null,
    uf: item.unidadeOrgao?.ufSigla ?? null,
    municipio: item.unidadeOrgao?.municipioNome ?? null,
    valorTotalEstimado: item.valorTotalEstimado ?? null,
    dataPublicacaoPncp: item.dataPublicacaoPncp ?? null,
    dataAberturaProposta: item.dataAberturaProposta ?? null,
    dataEncerramentoProposta: item.dataEncerramentoProposta ?? null,
    linkSistemaOrigem: item.linkSistemaOrigem ?? null,
    linkEditalPNCP: item.linkEditalPNCP ?? null,
    srp: item.srp ?? false,
  };
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function normalizeDateLike(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return stringValue(value);
}
