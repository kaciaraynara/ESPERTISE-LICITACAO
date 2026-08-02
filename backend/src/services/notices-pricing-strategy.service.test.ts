import { NoticesPricingStrategyService } from './notices-pricing-strategy.service';

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
    object: 'Contratacao de servicos de limpeza predial',
    modality: 'Pregao eletronico',
    uf: 'CE',
    municipality: 'Santa Quiteria',
    estimatedValue: 100000,
    publishedAt: new Date('2026-06-01T12:00:00Z'),
    openingAt: new Date('2026-06-15T12:00:00Z'),
    ...overrides,
  };
}

function score(overrides: Record<string, unknown> = {}) {
  return {
    noticeId: 'notice-1',
    score: 88,
    nivel: 'alta',
    riscos: [],
    ...overrides,
  };
}

function proposal(overrides: Record<string, unknown> = {}) {
  return {
    noticeId: 'notice-1',
    estrategia: 'agressiva',
    riscos: [],
    ...overrides,
  };
}

function serviceWith(params: {
  notice?: any;
  score?: any;
  proposal?: any;
}) {
  const notices = {
    getNoticeById: jest.fn(async () =>
      Object.prototype.hasOwnProperty.call(params, 'notice') ? params.notice : notice(),
    ),
  };

  const opportunityScore = {
    scoreNotice: jest.fn(async () =>
      Object.prototype.hasOwnProperty.call(params, 'score') ? params.score : score(),
    ),
  };

  const proposalStrategy = {
    buildStrategy: jest.fn(async () =>
      Object.prototype.hasOwnProperty.call(params, 'proposal') ? params.proposal : proposal(),
    ),
  };

  return {
    service: new NoticesPricingStrategyService(
      notices as any,
      opportunityScore as any,
      proposalStrategy as any,
    ),
    notices,
    opportunityScore,
    proposalStrategy,
  };
}

const validInput = {
  custo_produto: 50000,
  percentual_impostos: 10,
  custo_logistico: 5000,
  taxas_administrativas: 3000,
  margem_desejada_percentual: 15,
};

describe('NoticesPricingStrategyService', () => {
  test('retorna null quando edital nao existe', async () => {
    const { service, notices, opportunityScore, proposalStrategy } = serviceWith({
      notice: null,
    });

    const result = await service.buildPricingStrategy('notice-inexistente', validInput, context);

    expect(result).toBeNull();
    expect(notices.getNoticeById).toHaveBeenCalledWith('notice-inexistente', {}, context);
    expect(opportunityScore.scoreNotice).not.toHaveBeenCalled();
    expect(proposalStrategy.buildStrategy).not.toHaveBeenCalled();
  });

  test('gera precificacao agressiva quando score e estrategia sao altos', async () => {
    const { service } = serviceWith({
      notice: notice({ estimatedValue: 100000 }),
      score: score({ score: 90, nivel: 'alta', riscos: [] }),
      proposal: proposal({ estrategia: 'agressiva', riscos: [] }),
    });

    const result = await service.buildPricingStrategy('notice-1', validInput, context);

    expect(result).toMatchObject({
      noticeId: 'notice-1',
      valorEstimado: 100000,
      margemDesejadaPercentual: 15,
      posicao: 'agressiva',
      score: {
        valor: 90,
        nivel: 'alta',
      },
      estrategiaProposta: 'agressiva',
    });

    expect(result?.precoMinimoSaudavel).toBeGreaterThan(0);
    expect(result?.precoSugerido).toBeGreaterThanOrEqual(result?.precoMinimoSaudavel ?? 0);
    expect(result?.viabilidade.margemLucroRealPercentual).toBeGreaterThanOrEqual(10);
  });

  test('gera posicao conservadora quando ha riscos relevantes', async () => {
    const { service } = serviceWith({
      notice: notice({ estimatedValue: 100000 }),
      score: score({ score: 50, nivel: 'media' }),
      proposal: proposal({
        estrategia: 'conservadora',
        riscos: [
          'Risco documental relevante.',
          'Risco técnico relevante.',
          'Risco operacional relevante.',
        ],
      }),
    });

    const result = await service.buildPricingStrategy('notice-1', validInput, context);

    expect(result?.posicao).toBe('conservadora');
    expect(result?.recomendacoes).toEqual(expect.arrayContaining([
      expect.stringMatching(/Preservar margem/i),
      expect.stringMatching(/Radar de Erros/i),
    ]));
    expect(result?.alertas).toEqual(expect.arrayContaining([
      expect.stringMatching(/riscos estratégicos/i),
    ]));
  });

  test('retorna alerta quando preco sugerido fica acima do valor estimado', async () => {
    const { service } = serviceWith({
      notice: notice({ estimatedValue: 60000 }),
      score: score({ score: 80, nivel: 'alta' }),
      proposal: proposal({ estrategia: 'agressiva', riscos: [] }),
    });

    const result = await service.buildPricingStrategy('notice-1', {
      custo_produto: 70000,
      percentual_impostos: 10,
      custo_logistico: 5000,
      taxas_administrativas: 3000,
      margem_desejada_percentual: 15,
    }, context);

    expect(result?.precoSugerido).toBeGreaterThan(60000);
    expect(result?.alertas).toEqual(expect.arrayContaining([
      expect.stringMatching(/acima do valor estimado/i),
    ]));
  });

  test('lança erro para dados financeiros invalidos', async () => {
    const { service } = serviceWith({
      notice: notice(),
      score: score(),
      proposal: proposal(),
    });

    await expect(service.buildPricingStrategy('notice-1', {
      ...validInput,
      percentual_impostos: 150,
    }, context)).rejects.toThrow('INVALID_PERCENTUAL_IMPOSTOS');
  });

  test('mantem observacao de seguranca financeira', async () => {
    const { service } = serviceWith({
      notice: notice(),
      score: score(),
      proposal: proposal(),
    });

    const result = await service.buildPricingStrategy('notice-1', validInput, context);

    expect(result?.observacao).toMatch(/Não substitui análise contábil/i);
    expect(JSON.stringify(result)).not.toMatch(/garantia de vitória|lucro garantido|vencerá a licitação/i);
  });
});
