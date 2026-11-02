import { buscarContratacoesPNCP, FiltrosBusca, LicitacaoPNCP } from '../../pncp.service';
import { DATA_SOURCE_REGISTRY } from '../source-registry';
import type { DataConnector, DataFetchInput, RawDataRecord } from '../types';

type PncpFetch = typeof buscarContratacoesPNCP;

export class PncpDataConnector implements DataConnector {
  descriptor = DATA_SOURCE_REGISTRY.pncp;

  constructor(private readonly fetchPncp: PncpFetch = buscarContratacoesPNCP) {}

  async fetch(input: DataFetchInput): Promise<RawDataRecord[]> {
    const filters = buildPncpFilters(input);
    const maxPages = Number(process.env.PNCP_INGEST_MAX_PAGES ?? 20);
    if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 1000) {
      throw new Error('PNCP_INGEST_MAX_PAGES deve ser um inteiro entre 1 e 1000.');
    }

    const records: RawDataRecord[] = [];
    const firstPage = Number(filters.pagina);
    let totalPages: number | null = null;
    let lastPageSize = 0;
    let responsePageSize = 0;

    for (let pageOffset = 0; pageOffset < maxPages; pageOffset += 1) {
      const pagina = firstPage + pageOffset;
      const result = await this.fetchPncp({ ...filters, pagina });
      lastPageSize = result.data.length;
      responsePageSize = result.tamanhoPagina;
      const fetchedAt = new Date().toISOString();

      records.push(...result.data.map((item) => ({
        tenantId: input.tenantId ?? null,
        source: 'pncp' as const,
        entityType: 'procurement_notice' as const,
        externalId: item.numeroControlePNCP,
        fetchedAt,
        traceId: input.traceId ?? null,
        payload: mapPncpPayload(item),
      })));

      if (result.totalRegistros !== null) {
        totalPages = Math.ceil(result.totalRegistros / result.tamanhoPagina);
        if (pagina >= totalPages) return records;
      } else if (result.data.length < result.tamanhoPagina) {
        return records;
      }

      if (result.data.length === 0) return records;
      if (pageOffset < maxPages - 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    if (
      (totalPages !== null && firstPage + maxPages - 1 < totalPages)
      || (totalPages === null && lastPageSize === responsePageSize)
    ) {
      throw new Error(
        `PNCP excedeu o limite de ${maxPages} páginas; configure PNCP_INGEST_MAX_PAGES para concluir a sincronização.`,
      );
    }

    return records;
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
