import api from './api';
import {
  GuaranteesResponse,
  CertificateAlertsResponse,
  GarantiaItem,
} from '../types/guarantees.types';

export interface CreateGuaranteePayload {
  tipo: string;
  modalidade: string;
  instituicaoEmissora?: string;
  numeroApolice?: string;
  valor: number;
  percentual?: number;
  dataEmissao?: string;
  dataVencimento: string;
  documentoUrl?: string;
  observacoes?: string;
}

export const guaranteesService = {
  /**
   * GET /api/guarantees
   * Lista todas as garantias da empresa com métricas de dinheiro retido e cauções ativas
   */
  async getGuarantees(): Promise<GuaranteesResponse> {
    const response = await api.get<{ success: boolean; data: GuaranteesResponse }>('/guarantees');
    if (!response.data.success || !response.data.data) {
      throw new Error('Falha ao carregar garantias licitatórias.');
    }
    return response.data.data;
  },

  /**
   * POST /api/guarantees
   * Cadastra nova garantia
   */
  async createGuarantee(payload: CreateGuaranteePayload): Promise<GarantiaItem> {
    const response = await api.post<{ success: boolean; data: GarantiaItem }>('/guarantees', payload);
    if (!response.data.success || !response.data.data) {
      throw new Error('Falha ao cadastrar garantia licitatória.');
    }
    return response.data.data;
  },

  /**
   * PUT /api/guarantees/:id
   * Atualiza status (ex: dar baixa após restituição)
   */
  async updateGuarantee(id: string, payload: Partial<CreateGuaranteePayload & { status: string }>): Promise<GarantiaItem> {
    const response = await api.put<{ success: boolean; data: GarantiaItem }>(`/guarantees/${id}`, payload);
    if (!response.data.success || !response.data.data) {
      throw new Error('Falha ao atualizar garantia.');
    }
    return response.data.data;
  },

  /**
   * GET /api/guarantees/alerts
   * Consulta alertas de CNDs com vencimento crítico (< 15 dias) para o banner global
   */
  async getCertificateAlerts(): Promise<CertificateAlertsResponse> {
    const response = await api.get<{ success: boolean; data: CertificateAlertsResponse }>('/guarantees/alerts');
    if (!response.data.success || !response.data.data) {
      return { hasCriticalAlert: false, totalCriticas: 0, alerts: [] };
    }
    return response.data.data;
  },
};

export default guaranteesService;

