import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';

export function useLicitacoes(filtros: any) {
  return useQuery({
    queryKey: ['licitacoes', filtros],
    queryFn: async () => {
      const { data } = await apiClient.get('/licitacoes', { params: filtros });
      return data;
    },
    staleTime: 1000 * 60 * 5, // Mantém os dados "frescos" por 5 min
    retry: 2 // Tenta novamente 2 vezes se o governo falhar
  });
}