import axios from 'axios';
import { checarSancoesCnpj } from './transparencia.service';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('checarSancoesCnpj', () => {
  const originalToken = process.env.PORTAL_TRANSPARENCIA_TOKEN;
  const originalLegacyToken = process.env.TRANSPARENCIA_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.TRANSPARENCIA_API_KEY;
  });

  afterAll(() => {
    if (originalToken === undefined) delete process.env.PORTAL_TRANSPARENCIA_TOKEN;
    else process.env.PORTAL_TRANSPARENCIA_TOKEN = originalToken;
    if (originalLegacyToken === undefined) delete process.env.TRANSPARENCIA_API_KEY;
    else process.env.TRANSPARENCIA_API_KEY = originalLegacyToken;
  });

  it('rejeita CNPJ inválido sem consultar o provedor', async () => {
    const result = await checarSancoesCnpj('00.000.000/0000-00');

    expect(result).toMatchObject({
      cnpj: '00000000000000',
      temSancoes: null,
      statusConsulta: 'CNPJ_INVALIDO',
    });
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('retorna estado explícito quando não há token configurado', async () => {
    delete process.env.PORTAL_TRANSPARENCIA_TOKEN;

    const result = await checarSancoesCnpj('11.222.333/0001-81');

    expect(result.statusConsulta).toBe('TOKEN_NAO_CONFIGURADO');
    expect(result.temSancoes).toBeNull();
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('consulta CEIS e CNEP e reporta as contagens reais', async () => {
    process.env.PORTAL_TRANSPARENCIA_TOKEN = 'test-token';
    mockedAxios.get
      .mockResolvedValueOnce({ data: [{ id: 'ceis-1' }] } as never)
      .mockResolvedValueOnce({ data: [{ id: 'cnep-1' }, { id: 'cnep-2' }] } as never);

    const result = await checarSancoesCnpj('11.222.333/0001-81');

    expect(result).toMatchObject({
      cnpj: '11222333000181',
      temSancoes: true,
      registrosCEIS: 1,
      registrosCNEP: 2,
      statusConsulta: 'OK',
    });
    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/\/ceis$/),
      expect.objectContaining({
        params: { cnpjSancionado: '11222333000181', pagina: 1 },
        headers: { 'chave-api-dados': 'test-token' },
      }),
    );
    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/\/cnep$/),
      expect.objectContaining({
        params: { cnpjSancionado: '11222333000181', pagina: 1 },
      }),
    );
  });

  it('não afirma ausência de sanções quando uma fonte falha', async () => {
    process.env.PORTAL_TRANSPARENCIA_TOKEN = 'test-token';
    mockedAxios.get
      .mockResolvedValueOnce({ data: [] } as never)
      .mockRejectedValueOnce(new Error('provider unavailable'));

    const result = await checarSancoesCnpj('11.222.333/0001-81');

    expect(result.statusConsulta).toBe('ERRO_PROVEDOR');
    expect(result.temSancoes).toBeNull();
  });
});
