import { buscarContratacoesPNCP, LicitacaoPNCP } from './pncp.service';
import { buscarLicitacoesComprasGov, LicitacaoComprasGov } from './comprasgov.service';

export type FonteBusca = 'TODAS' | 'PNCP' | 'COMPRASGOV';

export interface FiltrosBuscaUnificada {
  descricao?: string;
  uf?: string;
  valorMin?: number;
  valorMax?: number;
  modalidade?: string | number;
  dataInicio?: string;
  dataFim?: string;
  pagina?: number;
  tamanhoPagina?: number;
  fonte?: FonteBusca;
}

export interface LicitacaoUnificada {
  id: string;
  fonte: 'PNCP' | 'ComprasGov';
  numero: string;
  objeto: string;
  orgao: string;
  cnpjOrgao?: string;
  uf?: string;
  municipio?: string;
  valorEstimado?: number;
  valorHomologado?: number;
  dataAbertura?: string;
  dataEncerramento?: string;
  modalidade?: string;
  situacao?: string;
  link?: string;
}

export interface ResultadoBuscaUnificada {
  items: LicitacaoUnificada[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
  fontesComErro: string[];
}

function mapPncpParaUnificado(item: LicitacaoPNCP): LicitacaoUnificada {
  return {
    id: `PNCP:${item.numeroControlePNCP}`,
    fonte: 'PNCP',
    numero: item.numeroControlePNCP,
    objeto: item.objeto || 'Objeto não informado',
    orgao: item.orgaoEntidade?.razaoSocial || 'Órgão não informado',
    cnpjOrgao: item.orgaoEntidade?.cnpj,
    uf: item.unidadeOrgao?.ufSigla,
    municipio: item.unidadeOrgao?.municipioNome,
    valorEstimado: item.valorTotalEstimado,
    dataAbertura: item.dataAberturaProposta,
    dataEncerramento: item.dataEncerramentoProposta,
    modalidade: item.modalidadeNome || 'Não informada',
    situacao: item.situacaoCompraNome || 'Publicada',
    link: item.linkEditalPNCP || item.linkSistemaOrigem,
  };
}

function mapComprasGovParaUnificado(item: LicitacaoComprasGov): LicitacaoUnificada {
  return {
    id: `COMPRASGOV:${item.id}`,
    fonte: 'ComprasGov',
    numero: item.numero,
    objeto: item.objeto || 'Objeto não informado',
    orgao: item.orgao,
    uf: item.uf || undefined,
    valorEstimado: item.valor_estimado,
    valorHomologado: item.valor_homologado,
    dataAbertura: item.data_abertura,
    dataEncerramento: item.data_encerramento,
    modalidade: item.modalidade,
    situacao: item.situacao,
    link: item.link,
  };
}

export class LicitacaoSearchService {
  public async execute(filtros: FiltrosBuscaUnificada): Promise<ResultadoBuscaUnificada> {
    const fonte = filtros.fonte || 'TODAS';
    const pagina = Math.max(1, filtros.pagina || 1);
    const tamanhoPagina = Math.min(100, Math.max(10, filtros.tamanhoPagina || 20));

    const buscarPncp = fonte === 'TODAS' || fonte === 'PNCP';
    const buscarCompras = fonte === 'TODAS' || fonte === 'COMPRASGOV';

    const promessas: [Promise<any> | null, Promise<any> | null] = [
      buscarPncp
        ? buscarContratacoesPNCP({
            palavraChave: filtros.descricao,
            uf: filtros.uf,
            dataInicial: filtros.dataInicio,
            dataFinal: filtros.dataFim,
            pagina,
            tamanhoPagina,
            codigoModalidadeContratacao: Number(filtros.modalidade) || undefined,
          })
        : null,
      buscarCompras
        ? buscarLicitacoesComprasGov({
            descricao: filtros.descricao,
            uf: filtros.uf,
            valorMin: filtros.valorMin,
            valorMax: filtros.valorMax,
            modalidade: filtros.modalidade,
            dataInicio: filtros.dataInicio,
            dataFim: filtros.dataFim,
            pagina,
          })
        : null,
    ];

    const [pncpResult, comprasResult] = await Promise.allSettled([
      promessas[0] ?? Promise.resolve(null),
      promessas[1] ?? Promise.resolve(null),
    ]);

    const items: LicitacaoUnificada[] = [];
    const fontesComErro: string[] = [];
    let totalAcumulado = 0;

    // Processamento PNCP
    if (pncpResult.status === 'fulfilled' && pncpResult.value) {
      const pncpData = pncpResult.value;
      const unificados = (pncpData.data || []).map(mapPncpParaUnificado);
      items.push(...unificados);
      totalAcumulado += pncpData.totalRegistros ?? unificados.length;
    } else if (pncpResult.status === 'rejected') {
      console.error('[SearchService] Erro ao consultar PNCP:', pncpResult.reason?.message);
      fontesComErro.push('PNCP');
    }

    // Processamento Compras.gov
    if (comprasResult.status === 'fulfilled' && comprasResult.value) {
      const comprasData = comprasResult.value;
      const unificados = (comprasData.data || []).map(mapComprasGovParaUnificado);
      items.push(...unificados);
      totalAcumulado += comprasData.total ?? unificados.length;
    } else if (comprasResult.status === 'rejected') {
      console.error('[SearchService] Erro ao consultar Compras.gov:', comprasResult.reason?.message);
      fontesComErro.push('ComprasGov');
    }

    // Desduplicação por identificador único/número de controle
    const vistos = new Set<string>();
    const itemsUnicos = items.filter((item) => {
      const chaveDeduplicacao = `${item.numero}-${item.orgao}`;
      if (vistos.has(chaveDeduplicacao)) {
        return false;
      }
      vistos.add(chaveDeduplicacao);
      return true;
    });

    return {
      items: itemsUnicos,
      total: totalAcumulado,
      pagina,
      tamanhoPagina,
      fontesComErro,
    };
  }
}