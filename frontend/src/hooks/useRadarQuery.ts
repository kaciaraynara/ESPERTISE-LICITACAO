import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';

export interface EditalRadar {
  id: string;
  numeroProcesso: string;
  orgaoComprador: string;
  uf: string;
  objeto: string;
  valorEstimado: number;
  dataAbertura: string;
  modalidade: string;
  portal: string;
}

export const RADAR_KEYS = {
  all: ['radar'] as const,
  editais: (filtros: Record<string, unknown>) => [...RADAR_KEYS.all, 'editais', filtros] as const,
};

export function useEditaisRadar(filtros: { termo?: string; uf?: string } = {}) {
  return useQuery({
    queryKey: RADAR_KEYS.editais(filtros),
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: EditalRadar[] }>('/radar/editais', { params: filtros });
      return data.data;
    },
  });
}