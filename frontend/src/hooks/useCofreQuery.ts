import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import toast from 'react-hot-toast';

export interface DocumentoCofre {
  id: string;
  titulo: string;
  categoria: 'CND' | 'ATESTATO' | 'CONTRATO_SOCIAL' | 'QUALIFICACAO';
  dataValidade: string;
  status: 'VALIDO' | 'ALERTA' | 'VENCIDO';
  arquivoUrl?: string;
}

export const COFRE_KEYS = {
  all: ['cofre'] as const,
  documentos: () => [...COFRE_KEYS.all, 'documentos'] as const,
};

export function useDocumentosCofre() {
  return useQuery({
    queryKey: COFRE_KEYS.documentos(),
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: DocumentoCofre[] }>('/cofre/documentos');
      return data.data;
    },
  });
}

export function useUploadDocumento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await apiClient.post('/cofre/documentos/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      toast.success('Documento arquivado no Cofre com sucesso!');
      queryClient.invalidateQueries({ queryKey: COFRE_KEYS.all });
    },
    onError: () => {
      toast.error('Erro ao efetuar upload do documento.');
    },
  });
}