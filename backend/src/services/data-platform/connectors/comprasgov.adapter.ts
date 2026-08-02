import { buscarLicitacoesComprasGov, LicitacaoComprasGov } from '../../comprasgov.service';
import { sha256 } from '../normalization.service';
import { DATA_SOURCE_REGISTRY } from '../source-registry';
import type { DataConnector, DataFetchInput, RawDataRecord } from '../types';

type ComprasGovFetch = typeof buscarLicitacoesComprasGov;

export class ComprasGovDataConnector implements DataConnector {
  descriptor = DATA_SOURCE_REGISTRY.compras_gov;

  constructor(private readonly fetchComprasGov: ComprasGovFetch = buscarLicitacoesComprasGov) {}

  async fetch(input: DataFetchInput): Promise<RawDataRecord[]> {
    const params = buildComprasGovParams(input);
    const result = await this.fetchComprasGov(params);
    const fetchedAt = new Date().toISOString();

    return result.data.slice(0, input.limit ?? result.data.length).map((item) => {
      const externalId = resolveComprasGovExternalId(item);
      return {
        tenantId: input.tenantId ?? null,
        source: 'compras_gov',
        entityType: 'procurement_notice',
        externalId,
        fetchedAt,
        traceId: input.traceId ?? null,
        payload: mapComprasGovPayload(item, externalId),
      };
    });
  }
}

export function buildComprasGovParams(input: DataFetchInput) {
  const filters = input.filters ?? {};
  const since = normalizeDateLike(input.since);

  return {
    descricao: stringValue(filters.descricao ?? filters.palavrasChave ?? filters.q),
    codigoCatmat: stringValue(filters.codigoCatmat),
    uf: stringValue(filters.uf),
    valorMin: numberValue(filters.valorMin),
    valorMax: numberValue(filters.valorMax),
    modalidade: stringValue(filters.modalidade) ?? numberValue(filters.modalidade),
    dataInicio: stringValue(filters.dataInicio) ?? since,
    dataFim: stringValue(filters.dataFim),
    pagina: numberValue(filters.pagina) ?? numberValue(input.cursor?.cursorValue?.pagina) ?? 1,
  };
}

export function mapComprasGovPayload(item: LicitacaoComprasGov, externalId = resolveComprasGovExternalId(item)): Record<string, unknown> {
  return {
    id: externalId,
    sourceId: item.id,
    numero: item.numero,
    objeto: item.objeto,
    orgao: item.orgao,
    uasg: item.uasg,
    uf: item.uf,
    valorEstimado: item.valor_estimado ?? null,
    valorHomologado: item.valor_homologado ?? null,
    dataAbertura: item.data_abertura ?? null,
    dataEncerramento: item.data_encerramento ?? null,
    modalidade: item.modalidade ?? null,
    situacao: item.situacao ?? null,
    link: item.link ?? null,
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

function resolveComprasGovExternalId(item: LicitacaoComprasGov) {
  if (item.id && !isGeneratedFallbackId(item.id)) return item.id;

  const uasgNumero = [item.uasg, item.numero].filter(Boolean).join('-');
  if (uasgNumero) return uasgNumero;

  if (item.link) return item.link;

  const fallback = [item.orgao, item.objeto, item.data_abertura, item.data_encerramento]
    .filter(Boolean)
    .join('|');
  return fallback ? sha256(fallback) : item.id;
}

function isGeneratedFallbackId(value: string) {
  return /^\d{13}-0\.\d+/.test(value);
}
