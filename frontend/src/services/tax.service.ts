import api from './api';
import { SimulateBdiInput, SimulateBdiResult } from '../types/war-room.types';

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
};

export default taxService;

