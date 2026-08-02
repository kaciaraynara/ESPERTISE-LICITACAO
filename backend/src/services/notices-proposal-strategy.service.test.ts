import { NoticesProposalStrategyService } from './notices-proposal-strategy.service';

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

function score(overrides: Record<string, unknown> = {}) {
  return {
    noticeId: 'notice-1',
    generatedAt: new Date().toISOString(),
    score: 88,
    nivel: 'alta',
    motivos: ['Objeto compatível com o nicho da empresa.'],
    riscos: [],
    recomendacao: 'Oportunidade recomendada.',
    empresa: {
      id: 'empresa-1',
      razaoSocial: 'Empresa Teste LTDA',
      cnpj: '00000000000100',
    },
    edital: {
      id: 'notice-1',
      objeto: 'Contratacao de servicos de limpeza predial',
      modalidade: 'Pregao eletronico',
      uf: 'CE',
      municipio: 'Santa Quiteria',
      valorEstimado: 50000,
    },
    detalhes: {
      compatibilidadeNicho: 25,
      compatibilidadeRegiao: 15,
      compatibilidadeValor: 18,
      prazo: 15,
      riscoEdital: 0,
    },
    ...overrides,
  };
}

function serviceWith(params: {
  score?: any;
  radar?: any;
}) {
  const opportunityScore = {
    scoreNotice: jest.fn(async () => Object.prototype.hasOwnProperty.call(params, 'score') ? params.score : score()),
  };

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
    service: new NoticesProposalStrategyService(opportunityScore as any, errorRadar as any),
    opportunityScore,
    errorRadar,
  };
}

describe('NoticesProposalStrategyService', () => {
  test('retorna null quando score nao encontra edital', async () => {
    const { service, opportunityScore, errorRadar } = serviceWith({
      score: null,
    });

    const result = await service.buildStrategy('notice-inexistente', {}, context);

    expect(result).toBeNull();
    expect(opportunityScore.scoreNotice).toHaveBeenCalledWith('notice-inexistente', {}, context);
    expect(errorRadar.analyzeNotice).not.toHaveBeenCalled();
  });

  test('gera estrategia agressiva para score alto sem riscos relevantes', async () => {
    const { service } = serviceWith({
      score: score({ score: 90, nivel: 'alta', riscos: [] }),
      radar: { issues: [] },
    });

    const result = await service.buildStrategy('notice-1', { empresa_id: 'empresa-1' }, context);

    expect(result).toMatchObject({
      noticeId: 'notice-1',
      estrategia: 'agressiva',
      score: {
        valor: 90,
        nivel: 'alta',
      },
    });

    expect(result?.orientacoes.join(' ')).toMatch(/Priorizar participação|proposta competitiva/i);
    expect(result?.checklist).toEqual(expect.arrayContaining([
      expect.stringMatching(/Conferir objeto/i),
      expect.stringMatching(/documentos de habilitação/i),
    ]));
  });

  test('gera estrategia moderada quando ha score medio e risco controlado', async () => {
    const { service } = serviceWith({
      score: score({
        score: 65,
        nivel: 'media',
        riscos: ['Valor estimado exige atenção.'],
      }),
      radar: {
        issues: [
          {
            code: 'possible_territorial_restriction',
            severity: 'medium',
            title: 'Possível restrição territorial',
          },
        ],
      },
    });

    const result = await service.buildStrategy('notice-1', {}, context);

    expect(result?.estrategia).toBe('moderada');
    expect(result?.riscos).toEqual(expect.arrayContaining([
      expect.stringMatching(/Valor estimado exige atenção/i),
      expect.stringMatching(/Ponto de atenção/i),
    ]));
    expect(result?.proximosPassos).toEqual(expect.arrayContaining([
      expect.stringMatching(/Radar de Erros/i),
    ]));
  });

  test('gera estrategia conservadora quando ha score baixo ou risco alto', async () => {
    const { service } = serviceWith({
      score: score({
        score: 45,
        nivel: 'baixa',
        riscos: ['Baixa aderência ao perfil da empresa.'],
      }),
      radar: {
        issues: [
          {
            code: 'possible_brand_restriction',
            severity: 'high',
            title: 'Possível indicação de marca ou especificação restritiva',
          },
        ],
      },
    });

    const result = await service.buildStrategy('notice-1', {}, context);

    expect(result?.estrategia).toBe('conservadora');
    expect(result?.riscos).toEqual(expect.arrayContaining([
      expect.stringMatching(/Ponto crítico/i),
    ]));
    expect(result?.checklist).toEqual(expect.arrayContaining([
      expect.stringMatching(/marca\/modelo/i),
    ]));
    expect(result?.proximosPassos).toEqual(expect.arrayContaining([
      expect.stringMatching(/impugnação/i),
    ]));
  });

  test('mantem observacao de seguranca operacional', async () => {
    const { service } = serviceWith({
      score: score(),
      radar: { issues: [] },
    });

    const result = await service.buildStrategy('notice-1', {}, context);

    expect(result?.observacao).toMatch(/Não substitui/i);
    expect(JSON.stringify(result)).not.toMatch(/garantia de vitória|fraude comprovada|cartel confirmado/i);
  });
});
