import { NoticesErrorRadarService } from './notices-error-radar.service';

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
    source: 'pncp',
    externalId: 'PNCP-001',
    noticeNumber: 'PE 001/2026',
    modality: 'Pregao eletronico',
    buyerName: 'Prefeitura de Teste',
    object: 'Contratacao de servicos continuados de limpeza predial com materiais e equipe dedicada',
    estimatedValue: 250000,
    publishedAt: new Date('2026-06-01T12:00:00Z'),
    openingAt: new Date('2026-06-10T12:00:00Z'),
    status: 'open',
    ...overrides,
  };
}

function serviceWith(params: {
  notice?: any;
  chunks?: Array<{ text?: string; content?: string }>;
}) {
  const notices = {
    getNoticeById: jest.fn(async () => params.notice ?? notice()),
    listChunks: jest.fn(async () => ({
      data: params.chunks ?? [],
    })),
  };

  return {
    service: new NoticesErrorRadarService(notices as any),
    notices,
  };
}

describe('NoticesErrorRadarService', () => {
  test('retorna null quando edital nao existe', async () => {
    const notices = {
      getNoticeById: jest.fn(async () => null),
      listChunks: jest.fn(),
    };

    const service = new NoticesErrorRadarService(notices as any);

    const result = await service.analyzeNotice('notice-inexistente', context);

    expect(result).toBeNull();
    expect(notices.getNoticeById).toHaveBeenCalledWith('notice-inexistente', {}, context);
    expect(notices.listChunks).not.toHaveBeenCalled();
  });

  test('retorna radar sem alertas graves quando edital esta completo', async () => {
    const { service } = serviceWith({
      notice: notice(),
      chunks: [
        {
          content: [
            'O criterio de julgamento sera menor preco por item.',
            'A habilitacao juridica, regularidade fiscal e proposta comercial estao descritas objetivamente.',
            'Serao aceitos produtos equivalentes que atendam as especificacoes tecnicas.',
          ].join(' '),
        },
        { content: 'O edital permite ampla competitividade e nao restringe marca ou sede.' },
        { content: 'O prazo de abertura permite preparacao adequada das propostas.' },
      ],
    });

    const result = await service.analyzeNotice('notice-1', context);

    expect(result).toMatchObject({
      noticeId: 'notice-1',
      summary: {
        riskLevel: 'low',
        confidence: 'medium',
      },
    });

    expect(result?.issues).toEqual([]);
    expect(result?.safetyNotice).toMatch(/não afirma fraude/i);
  });

  test('detecta objeto generico, valor ausente e prazo curto', async () => {
    const { service } = serviceWith({
      notice: notice({
        object: 'Contratacao',
        estimatedValue: null,
        publishedAt: new Date('2026-06-01T12:00:00Z'),
        openingAt: new Date('2026-06-03T12:00:00Z'),
      }),
      chunks: [
        { content: 'O criterio de julgamento sera menor preco.' },
      ],
    });

    const result = await service.analyzeNotice('notice-1', context);

    expect(result?.summary.high).toBeGreaterThanOrEqual(2);
    expect(result?.summary.riskLevel).toBe('high');

    expect(result?.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'generic_or_missing_object' }),
      expect.objectContaining({ code: 'missing_estimated_value' }),
      expect.objectContaining({ code: 'short_deadline' }),
    ]));
  });

  test('detecta possivel marca especifica e restricao territorial', async () => {
    const { service } = serviceWith({
      notice: notice(),
      chunks: [
        {
          content: [
            'O equipamento devera observar marca especifica e modelo especifico sem similar.',
            'A empresa devera possuir sede no municipio para participar do certame.',
            'O criterio de julgamento sera menor preco.',
          ].join(' '),
        },
        { content: 'Exigencias tecnicas complementares do edital.' },
        { content: 'Demais condicoes de habilitacao.' },
      ],
    });

    const result = await service.analyzeNotice('notice-1', context);

    expect(result?.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'possible_brand_restriction',
        severity: 'high',
      }),
      expect.objectContaining({
        code: 'possible_territorial_restriction',
        severity: 'medium',
      }),
    ]));

    expect(JSON.stringify(result)).not.toMatch(/fraude comprovada|cartel confirmado|ilegalidade certa/i);
  });

  test('aponta baixa confianca quando nao ha chunks do edital', async () => {
    const { service } = serviceWith({
      notice: notice(),
      chunks: [],
    });

    const result = await service.analyzeNotice('notice-1', context);

    expect(result?.summary.confidence).toBe('low');
    expect(result?.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'missing_document_chunks',
        severity: 'medium',
      }),
    ]));
  });
});
