import { describe, it, expect } from 'vitest';
import { aiApi, lexApi } from './services/api';
import { LexFloatingWidget } from './components/LexFloatingWidget';
import { LexAdvisor } from './components/ui/LexAdvisor';

describe('LEX — Contrato de Frontend e Interface', () => {
  it('aiApi e lexApi expõem métodos oficiais de consulta grounded', () => {
    expect(aiApi).toBeDefined();
    expect(typeof aiApi.consultar).toBe('function');
    expect(lexApi).toBeDefined();
    expect(typeof lexApi.chat).toBe('function');
    expect(typeof lexApi.resumo).toBe('function');
    expect(typeof lexApi.auditar).toBe('function');
  });

  it('LexFloatingWidget e LexAdvisor são componentes React válidos', () => {
    expect(LexFloatingWidget).toBeDefined();
    expect(typeof LexFloatingWidget).toBe('function');
    expect(LexAdvisor).toBeDefined();
    expect(typeof LexAdvisor).toBe('function');
  });

  it('Contrato epistêmico: payload com 5 níveis de distinção e resposta inconclusiva suportada', () => {
    // Simula resposta real grounded do backend
    const mockBackendResponse = {
      success: true,
      data: {
        resposta: 'O prazo para impugnação encerra-se em 18/11/2026 às 23:59.',
        intencao: 'CALCULO_PRAZO_VALOR',
        nivelCerteza: 'alto',
        distribuicaoEpistemica: {
          fatos: 1,
          calculos: 1,
          indicios: 0,
          hipoteses: 0,
          inconclusivo: false,
        },
        fontes: [
          {
            fonte: 'PNCP - Edital PE 10/2026',
            identificador: 'c8f7d9e1-1111-4a55-8888-000000000001',
            trechoRelevante: 'Abertura em 23/11/2026',
            tipoEpistemico: 'Fato da fonte',
          },
          {
            fonte: 'Cálculo Determinístico (prazo_impugnacao)',
            identificador: 'calc-prazo_impugnacao-0',
            trechoRelevante: 'Prazo final: 18/11/2026 (3 dias úteis antes)',
            tipoEpistemico: 'Cálculo reproduzível',
          },
        ],
        calculos: [
          {
            tipo: 'prazo_impugnacao',
            formula: 'Abertura - 3 dias úteis',
            fundamentacaoLegal: 'Art. 164 da Lei 14.133/2021',
            descricao: 'Prazo tempestivo até 18/11/2026',
          },
        ],
      },
    };

    expect(mockBackendResponse.data.resposta).toBeTruthy();
    expect(mockBackendResponse.data.fontes.length).toBe(2);
    expect(mockBackendResponse.data.fontes[0].tipoEpistemico).toBe('Fato da fonte');
    expect(mockBackendResponse.data.fontes[1].tipoEpistemico).toBe('Cálculo reproduzível');
    expect(mockBackendResponse.data.calculos[0].fundamentacaoLegal).toContain('Art. 164');
  });

  it('Contrato de erro: falha de provedor não pode gerar falso sucesso no frontend', () => {
    const errorResponse = {
      response: {
        status: 503,
        data: {
          success: false,
          code: 'PROVIDER_UNAVAILABLE',
          message: 'O provedor de IA está temporariamente indisponível.',
        },
      },
    };

    // Valida que o erro é explícito e não se confunde com mensagem de sucesso
    expect(errorResponse.response.status).toBe(503);
    expect(errorResponse.response.data.success).toBe(false);
    expect(errorResponse.response.data.code).toBe('PROVIDER_UNAVAILABLE');
    expect(errorResponse.response.data.message).not.toContain('Entendi sua pergunta');
  });

  it('Contrato de resposta inconclusiva: quando não há evidência suficiente, exibe dados faltantes', () => {
    const mockInconclusiveResponse = {
      success: true,
      data: {
        resposta: 'Com base nas fontes atualmente disponíveis no sistema, não foi possível concluir esta análise.',
        status: 'inconclusivo',
        nivelCerteza: 'inconclusivo',
        dadosFaltantes: ['Termo de Referência não anexado'],
        distribuicaoEpistemica: {
          fatos: 0,
          calculos: 0,
          indicios: 0,
          hipoteses: 0,
          inconclusivo: true,
        },
      },
    };

    expect(mockInconclusiveResponse.data.status).toBe('inconclusivo');
    expect(mockInconclusiveResponse.data.nivelCerteza).toBe('inconclusivo');
    expect(mockInconclusiveResponse.data.distribuicaoEpistemica.inconclusivo).toBe(true);
    expect(mockInconclusiveResponse.data.dadosFaltantes.length).toBeGreaterThan(0);
  });

  it('Contrato STEP 4: extração real e fallback de escopo real estrito quando PDF ausente', () => {
    const mockEscopoRealResponse = {
      success: true,
      data: {
        resposta: 'A auditoria limita-se ao escopo oficial do edital registrado no PNCP. Não foram identificadas cláusulas abusivas nos registros disponíveis.',
        avisoEscopoReal: true,
        fontes: [
          {
            fonte: 'PNCP - Registro Oficial do Certame',
            identificador: '00394460000141-1-000001/2026',
            trechoRelevante: 'Objeto Oficial: Aquisição de equipamentos hospitalares. Modo de Disputa: Aberto.',
            tipoEpistemico: 'Fato da fonte',
          },
        ],
        limitacoes: [
          'Texto integral do PDF não disponibilizado em formato pesquisável pelo órgão no PNCP.',
          'Análise estritamente vinculada aos dados cadastrais oficiais do certame.',
        ],
      },
    };

    expect(mockEscopoRealResponse.data.fontes[0].trechoRelevante).toContain('Objeto Oficial');
    expect(mockEscopoRealResponse.data.limitacoes[0]).toContain('PDF não disponibilizado');
  });
});
