import { NoticesOpportunityScoreService } from './notices-opportunity-score.service';

const mockCompany = jest.fn();

jest.mock('../database/prisma', () => ({
  prisma: {
    company: {
      findFirst: (...args: any[]) => mockCompany(...args),
    },
  },
  getPrismaClient: () => ({
    company: {
      findFirst: (...args: any[]) => mockCompany(...args),
    }
  })
}));
const context = {
  tenantId: null,
  user: {
    id: 'user-1',
    email: 'user@expertise.test',
    role: 'fornecedor',
    isAdmin: false,
    permissions: [],
  },
  requestId: 'req-1',
  ip: '127.0.0.1',
  userAgent: 'jest',
};

function notice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notice-1',
    object: 'Contratacao de servicos de limpeza predial com fornecimento de materiais',
    modality: 'Pregao eletronico',
    uf: 'CE',
    municipality: 'Santa Quiteria',
    estimatedValue: 50000,
    publishedAt: new Date('2026-06-01T12:00:00Z'),
    openingAt: new Date('2026-06-15T12:00:00Z'),
    ...overrides,
  };
}

function empresa(overrides: Record<string, unknown> = {}) {
  return {
    id: 'empresa-1',
    user_id: 'user-1',
    cnpj: '00000000000100',
    razao_social: 'Empresa Teste LTDA',
    nome_fantasia: 'Empresa Teste',
    cnae_principal: 'limpeza',
    municipio: 'Santa Quiteria',
    uf: 'CE',
    status: 'ativa',
    nicho: ['limpeza'],
    palavras_chave: ['limpeza predial', 'materiais'],
    valor_min: 10000,
    valor_max: 100000,
    regioes: ['CE', 'Santa Quiteria'],
    orgaos_preferidos: [],
    orgaos_bloqueados: [],
    created_at: '2026-06-01T12:00:00.000Z',
    updated_at: '2026-06-01T12:00:00.000Z',
    ...overrides,
  };
}

function serviceWith(params: {
  notice?: any;
  empresa?: any | null;
  empresas?: any[];
  radar?: any;
}) {
  const notices = {
    getNoticeById: jest.fn(async () => Object.prototype.hasOwnProperty.call(params, 'notice') ? params.notice : notice()),
  };

  mockCompany.mockImplementation(async () => {
    let e = params.empresa;
    if (e === undefined) {
      e = params.empresas && params.empresas.length > 0 ? params.empresas[0] : empresa();
    }
    if (!e) return null;
    return {
      id: e.id,
      userId: e.user_id,
      cnpj: e.cnpj,
      razaoSocial: e.razao_social,
      uf: e.uf,
      nicho: e.nicho,
      palavrasChave: e.palavras_chave,
      valorMin: e.valor_min,
      valorMax: e.valor_max,
      regioes: e.regioes,
      orgaosPreferidos: e.orgaos_preferidos,
      orgaosBloqueados: e.orgaos_bloqueados,
    };
  });

  const errorRadar = {
    analyzeNotice: jest.fn(async () => params.radar ?? {
      issues: [],
      summary: {
        total: 0,
        high: 0,
        medium: 0,
        low: 0,
        riskLevel: 'low',
        confidence: 'medium',
      },
    }),
  };

  return {
    service: new NoticesOpportunityScoreService(notices as any, errorRadar as any),
    notices,
    errorRadar,
  };
}

describe('NoticesOpportunityScoreService', () => {
  test('retorna null quando edital nao existe', async () => {
    const { service, notices, errorRadar } = serviceWith({
      notice: null,
    });

    const result = await service.scoreNotice('notice-inexistente', {}, context);

    expect(result).toBeNull();
    expect(notices.getNoticeById).toHaveBeenCalledWith('notice-inexistente', {}, context);
    expect(errorRadar.analyzeNotice).not.toHaveBeenCalled();
  });

  test('gera score alto quando edital combina com empresa', async () => {
    const { service } = serviceWith({
      notice: notice(),
      empresa: empresa(),
      radar: { issues: [] },
    });

    const result = await service.scoreNotice('notice-1', { empresa_id: 'empresa-1' }, context);

    expect(result).toMatchObject({
      noticeId: 'notice-1',
      nivel: 'alta',
      empresa: {
        id: 'empresa-1',
        razaoSocial: 'Empresa Teste LTDA',
      },
      edital: {
        id: 'notice-1',
        uf: 'CE',
        municipio: 'Santa Quiteria',
        valorEstimado: 50000,
      },
    });

    expect(result?.score).toBeGreaterThanOrEqual(75);
    expect(result?.motivos.join(' ')).toMatch(/compatibilidade|Valor estimado|Prazo adequado/i);
  });

  test('usa primeira empresa quando empresa_id nao foi informado', async () => {
    const { service } = serviceWith({
      notice: notice(),
      empresas: [empresa({ id: 'empresa-primeira' })],
      radar: { issues: [] },
    });

    const result = await service.scoreNotice('notice-1', {}, context);

    
    expect(result?.empresa.id).toBe('empresa-primeira');
  });

  test('reduz score quando valor esta fora da faixa e radar aponta risco alto', async () => {
    const { service } = serviceWith({
      notice: notice({
        estimatedValue: 500000,
        openingAt: new Date('2026-06-03T12:00:00Z'),
      }),
      empresa: empresa({
        valor_min: 10000,
        valor_max: 100000,
      }),
      radar: {
        issues: [
          { severity: 'high', code: 'missing_estimated_value' },
          { severity: 'medium', code: 'possible_territorial_restriction' },
        ],
      },
    });

    const result = await service.scoreNotice('notice-1', { empresa_id: 'empresa-1' }, context);

    expect(result?.score).toBeLessThan(75);
    expect(result?.riscos).toEqual(expect.arrayContaining([
      expect.stringMatching(/acima da faixa máxima/i),
      expect.stringMatching(/severidade alta/i),
      expect.stringMatching(/prazo possivelmente curto/i),
    ]));
  });

  test('informa risco quando nao ha empresa cadastrada', async () => {
    const { service } = serviceWith({
      notice: notice(),
      empresas: [],
      empresa: null,
      radar: { issues: [] },
    });

    const result = await service.scoreNotice('notice-1', {}, context);

    expect(result?.empresa.id).toBeNull();
    expect(result?.riscos).toEqual(expect.arrayContaining([
      expect.stringMatching(/Nenhuma empresa/i),
    ]));
  });
});


