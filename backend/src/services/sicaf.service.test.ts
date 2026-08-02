import {
  SicafIntegrationError,
  avaliarRiscoIrregularidade,
  consultarSicaf,
  getLinkConsultaSicaf,
  isSicafConfigured,
} from './sicaf.service';

const originalEnv = {
  SICAF_API_BASE_URL: process.env.SICAF_API_BASE_URL,
  GOVBR_CLIENT_ID: process.env.GOVBR_CLIENT_ID,
  GOVBR_CLIENT_SECRET: process.env.GOVBR_CLIENT_SECRET,
};

function restoreEnvironment() {
  const entries = Object.entries(originalEnv);

  for (const [name, value] of entries) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}

describe('sicaf.service', () => {
  afterEach(() => {
    restoreEnvironment();
  });

  it('nunca retorna dados fictícios sem configuração oficial', async () => {
    delete process.env.SICAF_API_BASE_URL;
    delete process.env.GOVBR_CLIENT_ID;
    delete process.env.GOVBR_CLIENT_SECRET;

    expect(isSicafConfigured()).toBe(false);

    await expect(
      consultarSicaf('12.345.678/0001-90'),
    ).rejects.toMatchObject({
      name: 'SicafIntegrationError',
      code: 'SICAF_INTEGRATION_NOT_CONFIGURED',
      source: 'SICAF',
      official: true,
      statusCode: 503,
    });
  });

  it('não finge integração mesmo quando existem variáveis configuradas', async () => {
    process.env.SICAF_API_BASE_URL = 'https://api-oficial.exemplo.invalid';
    process.env.GOVBR_CLIENT_ID = 'configured-client';
    process.env.GOVBR_CLIENT_SECRET = 'configured-secret';

    expect(isSicafConfigured()).toBe(true);

    await expect(
      consultarSicaf('12345678000190'),
    ).rejects.toMatchObject({
      code: 'SICAF_INTEGRATION_NOT_IMPLEMENTED',
      statusCode: 503,
    });
  });

  it('rejeita consulta sem CNPJ', async () => {
    await expect(consultarSicaf('')).rejects.toBeInstanceOf(TypeError);
  });

  it('normaliza o CNPJ somente para formar o link de consulta manual', () => {
    const link = getLinkConsultaSicaf('12.345.678/0001-90');

    expect(link).toContain('cnpj=12345678000190');
  });

  it('avalia apenas os dados recebidos sem completar informações', () => {
    const resultado = avaliarRiscoIrregularidade({
      cnpj: '12345678000190',
      razao_social: 'Empresa real informada pela fonte',
      situacao_cadastral: 'ativo',
      linhas_servico: [],
      certidoes: [
        {
          nome: 'Certidão A',
          status: 'vencida',
          validade: '2026-01-01',
          link_renovacao: 'https://fonte-oficial.example',
          orgao: 'Órgão A',
        },
        {
          nome: 'Certidão B',
          status: 'vencida',
          validade: '2026-01-01',
          link_renovacao: 'https://fonte-oficial.example',
          orgao: 'Órgão B',
        },
      ],
      habilitacoes: [],
    });

    expect(resultado).toEqual({
      nivel: 'medio',
      motivos: ['2 certidões vencidas'],
    });
  });

  it('expõe um erro tipado para tratamento pelos controllers', () => {
    const error = new SicafIntegrationError(
      'SICAF_INTEGRATION_NOT_CONFIGURED',
      'Integração indisponível.',
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(503);
    expect(error.source).toBe('SICAF');
  });
});
