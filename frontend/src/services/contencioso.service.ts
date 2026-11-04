import api from './api';
import { AnalyzeRivalResult } from '../types/lex-contencioso.types';

export interface AnalyzeRivalPayload {
  file: File;
  pregaoNumero?: string;
  nomeNossaEmpresa?: string;
  objetoLicitacao?: string;
}

export const contenciosoService = {
  /**
   * POST /api/lex/analyze-rival
   * Envia o PDF do recurso concorrente para extração, RAG pgvector e geração de contrarrazão pelo GPT-4o
   */
  async analyzeRival(payload: AnalyzeRivalPayload): Promise<AnalyzeRivalResult> {
    const formData = new FormData();
    formData.append('file', payload.file);

    if (payload.pregaoNumero) formData.append('pregaoNumero', payload.pregaoNumero);
    if (payload.nomeNossaEmpresa) formData.append('nomeNossaEmpresa', payload.nomeNossaEmpresa);
    if (payload.objetoLicitacao) formData.append('objetoLicitacao', payload.objetoLicitacao);

    const response = await api.post<{ success: boolean; data: AnalyzeRivalResult }>(
      '/lex/analyze-rival',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 90000, // 90 segundos para geração profunda de peças com IA
      }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error('Falha ao processar análise do recurso pela inteligência jurídica.');
    }

    return response.data.data;
  },
};

export default contenciosoService;

