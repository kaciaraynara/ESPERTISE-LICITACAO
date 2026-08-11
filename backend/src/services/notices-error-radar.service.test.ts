// Define DATABASE_URL fictícia antes das importações
process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/test_db';

import { NoticesErrorRadarService } from './notices-error-radar.service';
import { NoticesSearchService } from './notices-search.service';
import * as aiServiceModule from './ai.service';

// Mock do módulo de IA para isolar chamadas externas
jest.mock('./ai.service', () => ({
  __esModule: true,
  chatWithProvider: jest.fn(),
}));

jest.mock('../database/prisma', () => ({
  prisma: {
    legalRule: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}));

describe('NoticesErrorRadarService', () => {
  let service: NoticesErrorRadarService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock do getNoticeById para evitar chamadas reais ao Prisma
    jest.spyOn(NoticesSearchService.prototype, 'getNoticeById').mockResolvedValue({
      id: 'notice-123',
      title: 'Edital de Teste',
      description: 'Objeto de teste para o radar de erros',
      modality: 'PREGAO_ELETRONICO',
    } as any);

    // Mock do listChunks para simular os trechos carregados sem erro de banco
    jest.spyOn(NoticesSearchService.prototype, 'listChunks').mockImplementation(async () => {
      return {
        data: [
          {
            id: 'chunk-1',
            text: 'Exige-se exclusivamente a marca ModeloX. A licitante deve possuir sede instalada no município contratante.',
          },
        ],
        pagination: { total: 1, page: 1, pageSize: 10, totalPages: 1, hasMore: false },
      } as any;
    });

    service = new NoticesErrorRadarService();
  });

  it('detecta objeto generico, valor ausente e prazo curto', async () => {
    const mockContext = {
      user: { id: 'user-1' }
    };

    const mockAiResult = {
      issues: [
        {
          code: 'short_deadline',
          title: 'Prazo Curto',
          severity: 'high',
          description: 'O edital possui um prazo muito curto.',
          evidence: ['prazo muito curto'],
          recommendation: 'Impugnar.',
        },
      ],
    };

    (aiServiceModule.chatWithProvider as jest.Mock).mockResolvedValue({
      content: JSON.stringify(mockAiResult)
    });

    const result = await service.analyzeNotice('notice-123', mockContext as any);

    expect(result).not.toBeNull();
    const issueCodes = result!.issues.map((i: any) => i.code);

    expect(issueCodes).toContain('short_deadline');
    expect(issueCodes).toContain('missing_estimated_value');
    expect(issueCodes).not.toContain('missing_document_chunks');
  });

  it('detecta possivel marca especifica e restricao territorial', async () => {
    const mockContext = {
      user: { id: 'user-1' }
    };

    const mockAiResult = {
      issues: [
        {
          code: 'possible_brand_restriction',
          title: 'Restrição de Marca',
          severity: 'high',
          description: 'Exigência de marca específica sem justificativa.',
          evidence: ['exclusivamente a marca ModeloX'],
          recommendation: 'Admitir marcas equivalentes.',
        },
        {
          code: 'possible_territorial_restriction',
          title: 'Restrição Territorial',
          severity: 'medium',
          description: 'Exigência de localização geográfica específica.',
          evidence: ['sede instalada no município contratante'],
          recommendation: 'Remover restrição geográfica.',
        },
      ],
    };

    (aiServiceModule.chatWithProvider as jest.Mock).mockResolvedValue({
      content: JSON.stringify(mockAiResult)
    });

    const result = await service.analyzeNotice('notice-456', mockContext as any);

    expect(result).not.toBeNull();
    const issueCodes = result!.issues.map((i: any) => i.code);

    expect(issueCodes).toContain('possible_brand_restriction');
    expect(issueCodes).toContain('possible_territorial_restriction');
  });
});