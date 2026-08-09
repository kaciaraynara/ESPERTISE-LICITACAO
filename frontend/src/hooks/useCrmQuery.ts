import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import toast from 'react-hot-toast';

type EtapaFunil = string;
type OportunidadeCRM = { id: string; etapa: EtapaFunil; [key: string]: any };
type MetricasCRM = Record<string, any>;

// Chaves de Cache do React Query
export const CRM_KEYS = {
  all: ['crm'] as const,
  oportunidades: () => [...CRM_KEYS.all, 'oportunidades'] as const,
  metricas: () => [...CRM_KEYS.all, 'metricas'] as const,
};

// Hook de Busca: Oportunidades do Funil
export function useOportunidadesCRM() {
  return useQuery({
    queryKey: CRM_KEYS.oportunidades(),
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: OportunidadeCRM[] }>('/crm/oportunidades');
      return data.data;
    },
  });
}

// Hook de Busca: Métricas do Pipeline
export function useMetricasCRM() {
  return useQuery({
    queryKey: CRM_KEYS.metricas(),
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: MetricasCRM }>('/crm/metricas');
      return data.data;
    },
  });
}

// Hook de Mutação: Atualizar Etapa no Kanban
export function useMoverEtapaOportunidade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, novaEtapa }: { id: string; novaEtapa: EtapaFunil }) => {
      const { data } = await apiClient.patch(`/crm/oportunidades/${id}/etapa`, { etapa: novaEtapa });
      return data;
    },
    // Atualização Otimista no Cache
    onMutate: async ({ id, novaEtapa }) => {
      await queryClient.cancelQueries({ queryKey: CRM_KEYS.oportunidades() });
      const previousOportunidades = queryClient.getQueryData<OportunidadeCRM[]>(CRM_KEYS.oportunidades());

      if (previousOportunidades) {
        queryClient.setQueryData<OportunidadeCRM[]>(
          CRM_KEYS.oportunidades(),
          previousOportunidades.map((item) =>
            item.id === id ? { ...item, etapa: novaEtapa } : item
          )
        );
      }

      return { previousOportunidades };
    },
    onError: (_err, _newVal, context) => {
      if (context?.previousOportunidades) {
        queryClient.setQueryData(CRM_KEYS.oportunidades(), context.previousOportunidades);
      }
      toast.error('Erro ao mover a oportunidade no servidor.');
    },
    onSuccess: () => {
      toast.success('Etapa atualizada com sucesso!');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CRM_KEYS.all });
    },
  });
}