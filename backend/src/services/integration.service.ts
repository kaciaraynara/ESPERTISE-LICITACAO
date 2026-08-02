import axios from 'axios';
import { buscarContratacoesPNCP } from './pncp.service';

export interface ICPNItem {
  id: string;
  orgaoEntidade: {
    razaoSocial: string | null;
    cnpj: string | null;
  };
  objetoCompra: string | null;
  dataDataInicioVigencia: string | null;
  valorTotalEstimado: number | null;
}

export interface IComprasGovItem {
  identificador: string;
  objeto: string | null;
  orgao_nome: string | null;
  data_entrega_proposta: string | null;
}

export class IntegrationService {
  private readonly timeoutMs = 15_000;

  public async fetchPNCP(
    dataInicial: string,
    dataFinal: string,
  ): Promise<ICPNItem[]> {
    const result = await buscarContratacoesPNCP({
      dataInicial,
      dataFinal,
      pagina: 1,
      tamanhoPagina: 50,
    });

    return result.data.map((item) => ({
      id: item.numeroControlePNCP,
      orgaoEntidade: {
        razaoSocial: item.orgaoEntidade?.razaoSocial ?? null,
        cnpj: item.orgaoEntidade?.cnpj ?? null,
      },
      objetoCompra: item.objeto ?? null,
      dataDataInicioVigencia:
        item.dataAberturaProposta
        ?? item.dataPublicacaoPncp
        ?? null,
      valorTotalEstimado: item.valorTotalEstimado ?? null,
    }));
  }

  public async fetchComprasGov(
    dataInicial: string,
    dataFinal: string,
  ): Promise<IComprasGovItem[]> {
    const baseUrl = (
      process.env.COMPRASGOV_LEGACY_BASE_URL
      || 'https://compras.dados.gov.br'
    ).replace(/\/+$/, '');

    const response = await axios.get(
      `${baseUrl}/licitacoes/v1/licitacoes.json`,
      {
        params: {
          data_publicacao_min: dataInicial,
          data_publicacao_max: dataFinal,
        },
        timeout: this.timeoutMs,
        headers: { Accept: 'application/json' },
      },
    );

    const items = response.data?._embedded?.licitacoes;
    if (!Array.isArray(items)) {
      throw new Error('COMPRASGOV_INVALID_RESPONSE');
    }

    return items.map((item: Record<string, unknown>) => ({
      identificador: String(item.identificador ?? ''),
      objeto: typeof item.objeto === 'string' ? item.objeto : null,
      orgao_nome:
        typeof item.orgao_nome === 'string'
          ? item.orgao_nome
          : null,
      data_entrega_proposta:
        typeof item.data_entrega_proposta === 'string'
          ? item.data_entrega_proposta
          : null,
    })).filter((item: IComprasGovItem) => item.identificador.length > 0);
  }
}
