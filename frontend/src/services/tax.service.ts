import api from './api';
import {
  SimulateBdiInput,
  SimulateBdiResult,
  GenerateProposalPayload,
} from '../types/war-room.types';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  code?: string;
  message?: string;
}

export const taxService = {
  /**
   * POST /api/tax/simulate-bdi
   * Simula em tempo real o Split Payment e a margem líquida sob o IVA Dual
   */
  async simulateBdi(payload: SimulateBdiInput): Promise<SimulateBdiResult> {
    const response = await api.post<ApiResponse<SimulateBdiResult>>('/tax/simulate-bdi', payload);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.message || 'Falha ao processar simulação tributária de BDI.');
    }
    return response.data.data;
  },

  /**
   * POST /api/proposals/generate
   * Gera e faz download em tempo real do documento hidratado (.docx ou .xlsx)
   * com os dados reais da empresa no Prisma e os cálculos exatos da Disputa ao Vivo.
   */
  async generateHydratedProposal(payload: GenerateProposalPayload): Promise<{ filename: string }> {
    const response = await api.post<Blob>('/proposals/generate', payload, {
      responseType: 'blob',
    });

    const disposition = String(response.headers['content-disposition'] || '');
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const safePregao = (payload.pregaoId || 'PREGAO').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fallbackFilename =
      payload.format === 'xlsx'
        ? `Planilha_BDI_Proposta_${safePregao}.xlsx`
        : `Proposta_Comercial_${safePregao}.docx`;
    const filename = match?.[1] || fallbackFilename;

    const blob = new Blob([response.data], {
      type:
        response.headers['content-type'] ||
        (payload.format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return { filename };
  },
};

export default taxService;

