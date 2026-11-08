import axios from 'axios';
import {
  buscarContratacoesPNCP,
  buscarContratacaoPNCP,
  buscarItensPNCP,
  buscarArquivosPNCP,
  buildPncpDownloadUrl,
  mapPncpItem,
  parsePncpControlNumber,
} from './pncp.service';

describe('pncp.service', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('usa a data local de Brasília e não envia uma data futura ao PNCP', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-02T02:00:00.000Z'));

    const response: any = {
      data: { data: [], totalRegistros: 0 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} },
    };
    const getMock = jest.spyOn(axios, 'get').mockResolvedValue(response);

    await buscarContratacoesPNCP({ codigoModalidadeContratacao: 6 });

    expect(getMock.mock.calls[0][1]?.params).toMatchObject({
      dataInicial: '20261017',
      dataFinal: '20261101',
      codigoModalidadeContratacao: 6,
    });
  });

  test('parsePncpControlNumber extrai cnpj, ano e sequencial de formatos oficiais', () => {
    const p1 = parsePncpControlNumber('83102277000152-1-000015/2025');
    expect(p1).toEqual({ cnpj: '83102277000152', ano: '2025', sequencial: 15 });

    const p2 = parsePncpControlNumber('pncp-00394460000141-1-000045-2026');
    expect(p2).toEqual({ cnpj: '00394460000141', ano: '2026', sequencial: 45 });

    const p3 = parsePncpControlNumber('12345678000199/2024/12');
    expect(p3).toEqual({ cnpj: '12345678000199', ano: '2024', sequencial: 12 });
  });

  test('buildPncpDownloadUrl forma a URL oficial conforme a documentação do PNCP', () => {
    const url = buildPncpDownloadUrl('83102277000152-1-000015/2025');
    expect(url).toBe('https://pncp.gov.br/api/pncp/v1/orgaos/83102277000152/compras/2025/15/arquivos/1');
  });

  test('mapPncpItem mapeia linkEditalPNCP para a URL de download oficial', () => {
    const item = mapPncpItem({
      numeroControlePNCP: '83102277000152-1-000015/2025',
      anoCompra: 2025,
      sequencialCompra: 15,
      orgaoEntidade: { cnpj: '83102277000152', razaoSocial: 'Prefeitura' },
      objetoCompra: 'Aquisição de materiais',
    });

    expect(item.linkEditalPNCP).toBe('https://pncp.gov.br/api/pncp/v1/orgaos/83102277000152/compras/2025/15/arquivos/1');
  });

  test('buscarContratacaoPNCP retorna 404 limpo quando a API do governo falha com 404', async () => {
    const axiosError: any = new Error('Request failed with status code 404');
    axiosError.isAxiosError = true;
    axiosError.response = { status: 404, data: { message: 'Not found' } };

    jest.spyOn(axios, 'get').mockRejectedValue(axiosError);

    await expect(buscarContratacaoPNCP('83102277000152-1-000015/2025')).rejects.toMatchObject({
      code: 'PNCP_NOT_FOUND',
      statusCode: 404,
    });
  });

  test('buscarItensPNCP formata a chamada oficial e mapeia os itens', async () => {
    const response: any = {
      data: [
        {
          numeroItem: 1,
          descricao: 'Notebook Core i7',
          quantidade: 10,
          valorUnitarioEstimado: 4500,
          valorTotal: 45000,
        },
      ],
      status: 200,
      headers: {},
      config: { headers: {} },
    };
    const getMock = jest.spyOn(axios, 'get').mockResolvedValue(response);

    const itens = await buscarItensPNCP('83102277000152', '2025', '15');

    expect(getMock).toHaveBeenCalledWith(
      'https://pncp.gov.br/api/pncp/v1/orgaos/83102277000152/compras/2025/15/itens',
      expect.any(Object),
    );
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({
      numeroItem: 1,
      descricao: 'Notebook Core i7',
      quantidade: 10,
      valorUnitarioEstimado: 4500,
      valorTotal: 45000,
    });
  });

  test('buscarArquivosPNCP formata a chamada oficial e retorna lista de anexos', async () => {
    const response: any = {
      data: [
        {
          sequencialDocumento: 1,
          titulo: 'Edital_01_2025.pdf',
          url: 'https://pncp.gov.br/arquivos/edital.pdf',
        },
      ],
      status: 200,
      headers: {},
      config: { headers: {} },
    };
    const getMock = jest.spyOn(axios, 'get').mockResolvedValue(response);

    const arquivos = await buscarArquivosPNCP('83102277000152-1-000015/2025');

    expect(getMock).toHaveBeenCalledWith(
      'https://pncp.gov.br/api/pncp/v1/orgaos/83102277000152/compras/2025/15/arquivos',
      expect.any(Object),
    );
    expect(arquivos).toHaveLength(1);
    expect(arquivos[0].titulo).toBe('Edital_01_2025.pdf');
  });
});
