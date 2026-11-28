jest.mock('./intelligence.service', () => ({
  consultarComprasGovContratos: jest.fn(),
}));

import {
  buildEstatisticas,
  buildRankingDominante,
  calcularDescontoReal,
  ConcorrentesService,
  ContratoConcorrente,
  ContratoMercadoItem,
  extrairCnpjsDeTextoAta,
  validarCnpjDigitos,
} from './concorrentes.service';
import { consultarComprasGovContratos } from './intelligence.service';

describe('concorrentes.service', () => {
  test('agrega estatisticas do historico de contratos', () => {
    const contratos: ContratoConcorrente[] = [
      {
        id: '1',
        fonte: 'pncp',
        numeroContrato: '001/2026',
        numeroControlePncp: 'PNCP-1',
        objeto: 'Servico A',
        orgao: 'Prefeitura A',
        cnpjOrgao: '11111111000111',
        modalidade: 'Pregao',
        categoria: 'Servicos',
        valor: 1000,
        dataAssinatura: '2026-01-10',
        dataPublicacao: '2026-01-11',
        vigenciaInicio: null,
        vigenciaFim: null,
        situacao: null,
        url: null,
      },
      {
        id: '2',
        fonte: 'portal_transparencia',
        numeroContrato: '002/2026',
        numeroControlePncp: 'PNCP-2',
        objeto: 'Servico B',
        orgao: 'Prefeitura A',
        cnpjOrgao: '11111111000111',
        modalidade: 'Dispensa',
        categoria: 'Servicos',
        valor: 500,
        dataAssinatura: '2026-02-10',
        dataPublicacao: '2026-02-11',
        vigenciaInicio: null,
        vigenciaFim: null,
        situacao: null,
        url: null,
      },
    ];

    const stats = buildEstatisticas(contratos);

    expect(stats.totalContratos).toBe(2);
    expect(stats.valorTotalContratado).toBe(1500);
    expect(stats.ticketMedio).toBe(750);
    expect(stats.orgaosContratantes).toBe(1);
    expect(stats.porAno).toEqual({ '2026': 2 });
    expect(stats.porModalidade).toEqual({ Pregao: 1, Dispensa: 1 });
    expect(stats.porOrgao[0]).toEqual({ orgao: 'Prefeitura A', total: 2, valorTotal: 1500 });
  });

  test('gerarDossie agrega contratos do Compras.gov mesmo quando PNCP falha', async () => {
    (consultarComprasGovContratos as jest.Mock).mockResolvedValueOnce([
      {
        id: 'CG-100',
        orgao: 'Ministério da Saúde',
        objeto: 'Fornecimento Hospitalar',
        valor: 12500,
        dataAssinatura: '2026-08-01',
        modalidade: 'Pregão Eletrônico',
      },
    ]);

    const service = new ConcorrentesService();
    jest.spyOn(service as any, 'consultarPncp').mockResolvedValueOnce({
      fonte: 'pncp',
      status: 'failed',
      contratos: [],
      message: 'Timeout',
    });
    jest.spyOn(service as any, 'consultarPortalTransparencia').mockResolvedValueOnce({
      fonte: 'portal_transparencia',
      status: 'failed',
      contratos: [],
      message: 'Indisponível',
    });

    const dossie = await service.gerarDossie('00.000.000/0001-91', 'user-1');

    expect(dossie.contratos).toHaveLength(1);
    expect(dossie.contratos[0]).toMatchObject({
      fonte: 'comprasgov',
      orgao: 'Ministério da Saúde',
      valor: 12500,
    });
    expect(dossie.fontes.find((f) => f.fonte === 'comprasgov')?.status).toBe('success');
  });

  test('calcularDescontoReal calcula desconto apenas quando estimado e homologado existem', () => {
    const comDesconto = calcularDescontoReal(100000, 82500);
    expect(comDesconto.descontoPercentual).toBe(17.5);
    expect(comDesconto.statusDesconto).toContain('17.50% abaixo do estimado');

    const semEstimado = calcularDescontoReal(null, 82500);
    expect(semEstimado.descontoPercentual).toBeNull();
    expect(semEstimado.statusDesconto).toBe('Valor estimado não divulgado');
  });

  test('buildRankingDominante ordena fornecedores por vitórias e calcula desconto médio real', () => {
    const contratos: ContratoMercadoItem[] = [
      {
        id: 'c1',
        fonte: 'pncp',
        orgao: 'Prefeitura A',
        cnpjOrgao: '11111111000111',
        numeroContrato: '1/2026',
        numeroControlePncp: null,
        objeto: 'Uniformes',
        dataAssinatura: '2026-05-01',
        fornecedorNome: 'Empresa Alfa LTDA',
        fornecedorCnpj: '22222222000122',
        valorHomologado: 80000,
        valorEstimado: 100000,
        descontoPercentual: 20,
        statusDesconto: '20.00% abaixo do estimado',
        urlOficial: null,
      },
      {
        id: 'c2',
        fonte: 'comprasgov',
        orgao: 'Prefeitura A',
        cnpjOrgao: '11111111000111',
        numeroContrato: '2/2026',
        numeroControlePncp: null,
        objeto: 'Fardamento',
        dataAssinatura: '2026-06-01',
        fornecedorNome: 'Empresa Alfa LTDA',
        fornecedorCnpj: '22222222000122',
        valorHomologado: 90000,
        valorEstimado: 100000,
        descontoPercentual: 10,
        statusDesconto: '10.00% abaixo do estimado',
        urlOficial: null,
      },
      {
        id: 'c3',
        fonte: 'pncp',
        orgao: 'Prefeitura A',
        cnpjOrgao: '11111111000111',
        numeroContrato: '3/2026',
        numeroControlePncp: null,
        objeto: 'Jalecos',
        dataAssinatura: '2026-07-01',
        fornecedorNome: 'Empresa Beta ME',
        fornecedorCnpj: '33333333000133',
        valorHomologado: 50000,
        valorEstimado: null,
        descontoPercentual: null,
        statusDesconto: 'Valor estimado não divulgado',
        urlOficial: null,
      },
    ];

    const ranking = buildRankingDominante(contratos);
    expect(ranking).toHaveLength(2);
    expect(ranking[0].razaoSocial).toBe('Empresa Alfa LTDA');
    expect(ranking[0].totalVitorias).toBe(2);
    expect(ranking[0].valorAcumulado).toBe(170000);
    expect(ranking[0].ticketMedio).toBe(85000);
    expect(ranking[0].descontoMedioReal).toBe(15);
    expect(ranking[1].descontoMedioReal).toBeNull();
  });

  test('validarCnpjDigitos valida digitos verificadores e rejeita CNPJs invalidos', () => {
    expect(validarCnpjDigitos('11.222.333/0001-81')).toBe(true);
    expect(validarCnpjDigitos('00.000.000/0001-91')).toBe(true);
    expect(validarCnpjDigitos('11.222.333/0001-82')).toBe(false);
    expect(validarCnpjDigitos('11.111.111/1111-11')).toBe(false);
    expect(validarCnpjDigitos('123456')).toBe(false);
  });

  test('extrairCnpjsDeTextoAta extrai CNPJs validos, remove duplicados e exclui CNPJ da empresa ativa', () => {
    const textoAta = [
      'ATA DE REALIZACAO DO PREGAO ELETRONICO N 012/2026',
      '1 - 00.000.000/0001-91 - BANCO DO BRASIL S.A.',
      '2 - EMPRESA TESTE ALFA LTDA - CNPJ 11.222.333/0001-81',
      '3 - CNPJ INVALIDO 11.222.333/0001-99 NAO DEVE ENTRAR',
      '4 - PARTICIPANTE DUPLICADO 11222333000181',
      '5 - MINHA PROPRIA EMPRESA 33.000.167/0001-01',
    ].join('\n');

    const extraidos = extrairCnpjsDeTextoAta(textoAta, '33.000.167/0001-01');
    expect(extraidos).toHaveLength(2);
    expect(extraidos[0]).toMatchObject({
      cnpj: '00000000000191',
      cnpjFormatado: '00.000.000/0001-91',
      razaoSocial: 'BANCO DO BRASIL S.A.',
    });
    expect(extraidos[1]).toMatchObject({
      cnpj: '11222333000181',
      cnpjFormatado: '11.222.333/0001-81',
      razaoSocial: 'EMPRESA TESTE ALFA LTDA',
    });
  });
});
