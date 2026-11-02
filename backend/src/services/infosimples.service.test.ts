import axios from 'axios';
import {
  InfoSimplesError,
  InfoSimplesService,
} from './infosimples.service';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('InfoSimplesService', () => {
  const service = new InfoSimplesService();
  const originalToken = process.env.INFOSIMPLES_TOKEN;
  const originalBaseUrl = process.env.INFOSIMPLES_API_BASE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INFOSIMPLES_TOKEN = 'test-secret-token';
    process.env.INFOSIMPLES_API_BASE_URL = 'https://api.infosimples.com/api/v2/consultas';
  });

  afterAll(() => {
    if (originalToken === undefined) delete process.env.INFOSIMPLES_TOKEN;
    else process.env.INFOSIMPLES_TOKEN = originalToken;
    if (originalBaseUrl === undefined) delete process.env.INFOSIMPLES_API_BASE_URL;
    else process.env.INFOSIMPLES_API_BASE_URL = originalBaseUrl;
  });

  it.each([
    ['consultarCndFederal', '/receita-federal/cnd'],
    ['consultarCrfFgts', '/caixa/crf'],
    ['consultarCndt', '/tst/cndt'],
  ] as const)('consulta %s com CNPJ e token nos campos esperados', async (method, endpoint) => {
    const providerResponse = {
      code: 200,
      data_count: 1,
      data: [{ data_validade: '2027-01-31', pdf: 'base64-pdf' }],
    };
    mockedAxios.post.mockResolvedValueOnce({ data: providerResponse } as never);

    const result = await service[method]('00.000.000/0001-91');

    expect(result).toEqual(providerResponse);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      `https://api.infosimples.com/api/v2/consultas${endpoint}`,
      'cnpj=00000000000191',
      expect.objectContaining({
        params: { token: 'test-secret-token' },
        headers: expect.objectContaining({
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
        maxRedirects: 0,
      }),
    );
  });

  it('falha explicitamente sem token configurado e não chama a API', async () => {
    delete process.env.INFOSIMPLES_TOKEN;

    await expect(service.consultarCndFederal('11.222.333/0001-81'))
      .rejects.toMatchObject<Partial<InfoSimplesError>>({
        code: 'INFOSIMPLES_TOKEN_NOT_CONFIGURED',
        httpStatus: 503,
      });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('rejeita CNPJ inválido antes da chamada externa', async () => {
    await expect(service.consultarCndt('00.000.000/0000-00'))
      .rejects.toMatchObject<Partial<InfoSimplesError>>({ code: 'INVALID_CNPJ' });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('não converte resposta de erro do provedor em sucesso', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { code: 601, code_message: 'Token não autorizado.', data: [] },
    } as never);

    await expect(service.consultarCrfFgts('00.000.000/0001-91'))
      .rejects.toMatchObject<Partial<InfoSimplesError>>({
        code: 'INFOSIMPLES_PROVIDER_601',
        httpStatus: 502,
      });
  });

  it('não inclui token na mensagem de erro de rede', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('request failed with token=test-secret-token'));

    await expect(service.consultarCndFederal('00.000.000/0001-91'))
      .rejects.toThrow('Não foi possível concluir a consulta à InfoSimples.');
  });
});
