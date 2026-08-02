import {
  FiltrosBusca,
  LicitacaoPNCP,
  LicitacaoRadarPNCP,
  ResultadoRadarPNCP,
} from '../interfaces/pncp.interface';
import {
  buscarContratacaoPNCP,
  buscarContratacoesPNCP,
} from './pncp.service';

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : null;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizarLicitacaoPNCP(
  item: LicitacaoPNCP,
): LicitacaoRadarPNCP {
  const numeroControlePNCP = item.numeroControlePNCP.trim();

  return {
    id: numeroControlePNCP,
    numeroControlePNCP,
    orgao: nullableString(item.orgaoEntidade?.razaoSocial) ?? '',
    cnpjOrgao: nullableString(item.orgaoEntidade?.cnpj),
    unidade: nullableString(item.unidadeOrgao?.nomeUnidade),
    uf: nullableString(item.unidadeOrgao?.ufSigla),
    municipio: nullableString(item.unidadeOrgao?.municipioNome),
    objeto: nullableString(item.objeto) ?? '',
    processo: nullableString(item.processo),
    numeroCompra: nullableString(item.numeroCompra),
    modalidade: nullableString(item.modalidadeNome),
    modalidadeId: nullableNumber(item.modalidadeId),
    modoDisputa: nullableString(item.modoDisputaNome),
    situacao: nullableString(item.situacaoCompraNome),
    valorEstimado: nullableNumber(item.valorTotalEstimado),
    dataPublicacao: nullableString(item.dataPublicacaoPncp),
    dataAbertura: nullableString(item.dataAberturaProposta),
    dataEncerramento: nullableString(item.dataEncerramentoProposta),
    link: nullableString(item.linkSistemaOrigem),
    fonte: 'PNCP',
  };
}

/**
 * O Radar é uma consulta sob demanda à fonte oficial. Nenhuma leitura ou
 * escrita em banco/cache ocorre neste serviço.
 */
export async function listarLicitacoes(
  filtros: FiltrosBusca = {},
): Promise<ResultadoRadarPNCP> {
  const resultado = await buscarContratacoesPNCP(filtros);

  return {
    data: resultado.data
      .filter((item) => item.numeroControlePNCP.trim().length > 0)
      .map(normalizarLicitacaoPNCP),
    totalRegistros: resultado.totalRegistros,
    pagina: resultado.pagina,
    tamanhoPagina: resultado.tamanhoPagina,
  };
}

export async function buscarLicitacaoPorNumeroControle(
  numeroControlePNCP: string,
): Promise<LicitacaoRadarPNCP> {
  return normalizarLicitacaoPNCP(
    await buscarContratacaoPNCP(numeroControlePNCP),
  );
}
