jest.mock('./intelligence.service', () => ({
  consultarCguCompleto: jest.fn(),
}));

import axios from 'axios';
import { consultarCguCompleto } from './intelligence.service';
import {
  avaliarRiscoIrregularidade,
  consultarSicaf,
  consultarSicafConsolidado,
} from './sicaf.service';

describe('sicaf.service (Etapa 6)', () => {
  const cguMock = consultarCguCompleto as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('consultarSicafConsolidado consulta SICAF com ativo=true, BrasilAPI e TCU APF em paralelo', async () => {
    jest.spyOn(axios, 'get').mockImplementation(async (url: string, config?: any) => {
      if (url.includes('/modulo-fornecedor/1_consultarFornecedor')) {
        expect(config?.params).toMatchObject({ cnpj: '00000000000191', ativo: true });
        return {
          status: 200,
          data: {
            resultado: [
              {
                razaoSocial: 'EMPRESA MODELO LTDA',
                porteEmpresaNome: 'EPP',
                nomeMunicipio: 'SAO PAULO',
                ufSigla: 'SP',
                ativo: true,
              },
            ],
          },
        } as any;
      }
      if (url.includes('brasilapi.com.br')) {
        return {
          status: 200,
          data: {
            cnpj: '00000000000191',
            razao_social: 'EMPRESA MODELO LTDA',
            descricao_situacao_cadastral: 'ATIVA',
            cnae_fiscal: 6201501,
            cnae_fiscal_descricao: 'Desenvolvimento de programas de computador',
            uf: 'SP',
            municipio: 'SAO PAULO',
            porte: 'EPP',
          },
        } as any;
      }
      if (url.includes('certidoes-apf.apps.tcu.gov.br')) {
        return {
          status: 200,
          data: {
            certidoes: [
              { emissor: 'TCU', tipo: 'Inidôneos', descricao: 'Licitantes Inidôneos', situacao: 'NADA_CONSTA' },
              { emissor: 'CGU', tipo: 'CEIS', descricao: 'Empresas Inidôneas', situacao: 'NADA_CONSTA' },
            ],
          },
        } as any;
      }
      return { status: 404, data: {} } as any;
    });

    cguMock.mockResolvedValueOnce({
      ceis: 0,
      cnep: 0,
      cepim: 0,
      leniencia: 0,
      alerta: false,
      resumo: 'Nada consta',
    });

    const res = await consultarSicafConsolidado('00.000.000/0001-91');

    expect(res.cadastradoSicaf).toBe(true);
    expect(res.avaliacaoRisco.nivel).toBe('baixo');
    expect(res.niveisSicaf).toHaveLength(6);
    expect(res.niveisSicaf[0].status).toBe('REGULAR');
    expect(res.niveisSicaf[5].status).toBe('REGULAR');
  });

  test('consultarSicafConsolidado e consultarSicaf reportam honestamente 404 do SICAF aberto e restricao no TCU', async () => {
    jest.spyOn(axios, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/modulo-fornecedor/')) {
        return { status: 404, data: { statusCode: 404, message: 'Resource not found' } } as any;
      }
      if (url.includes('brasilapi.com.br')) {
        return {
          status: 200,
          data: {
            cnpj: '11111111000111',
            razao_social: 'EMPRESA SANCIONADA SA',
            descricao_situacao_cadastral: 'ATIVA',
          },
        } as any;
      }
      if (url.includes('certidoes-apf.apps.tcu.gov.br')) {
        return {
          status: 200,
          data: {
            certidoes: [
              { emissor: 'TCU', tipo: 'Inidôneos', descricao: 'Licitantes Inidôneos', situacao: 'CONSTA' },
            ],
          },
        } as any;
      }
      return { status: 404, data: {} } as any;
    });

    cguMock.mockResolvedValue({
      ceis: 1,
      cnep: 0,
      cepim: 0,
      leniencia: 0,
      alerta: true,
      resumo: 'Consta CEIS',
    });

    const consolidado = await consultarSicafConsolidado('11111111000111');
    expect(consolidado.cadastradoSicaf).toBe(false);
    expect(consolidado.avaliacaoRisco.nivel).toBe('alto');
    expect(consolidado.niveisSicaf[5].status).toBe('IRREGULAR');

    const legacy = await consultarSicaf('11111111000111');
    expect(legacy.situacao_cadastral).toBe('suspenso');
    expect(avaliarRiscoIrregularidade(legacy).nivel).toBe('alto');
  });
});
