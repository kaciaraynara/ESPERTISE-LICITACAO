import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { juridicoApi } from '@services/api';
import {
  AbrirCasoJuridicoPayload,
  AssinaturaJuridica,
  Advogado,
  CasoJuridico,
  PlanoJuridico,
  SalvarPerfilJuridicoPayload,
  StatusCasoJuridico,
} from './types';

export function useJuridicoWorkspace(buscaAdvogado = '', options: { casosRefetchInterval?: number } = {}) {
  const queryClient = useQueryClient();

  const planosQuery = useQuery({
    queryKey: ['juridico', 'planos'],
    queryFn: async () => {
      const response = await juridicoApi.planos();
      return response.data.data as PlanoJuridico[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const advogadosQuery = useQuery({
    queryKey: ['juridico', 'advogados', buscaAdvogado],
    queryFn: async () => {
      const response = await juridicoApi.listarAdvogados({ busca: buscaAdvogado || undefined });
      return response.data.data as Advogado[];
    },
  });

  const perfilQuery = useQuery({
    queryKey: ['juridico', 'meu-perfil'],
    queryFn: async () => {
      const response = await juridicoApi.meuPerfil();
      return response.data.data as Advogado | null;
    },
  });

  const assinaturaQuery = useQuery({
    queryKey: ['juridico', 'assinatura'],
    queryFn: async () => {
      const response = await juridicoApi.minhaAssinatura();
      return response.data.data as AssinaturaJuridica | null;
    },
  });

  const casosQuery = useQuery({
    queryKey: ['juridico', 'casos'],
    queryFn: async () => {
      const response = await juridicoApi.listarCasos();
      return response.data.data as CasoJuridico[];
    },
    refetchInterval: options.casosRefetchInterval ?? 30_000,
    refetchOnWindowFocus: true,
  });

  const salvarPerfil = useMutation({
    mutationFn: async (payload: SalvarPerfilJuridicoPayload) => {
      const response = await juridicoApi.salvarPerfil(payload);
      return response.data.data as Advogado;
    },
    onSuccess: () => {
      toast.success('Perfil jurídico salvo com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['juridico', 'meu-perfil'] });
      queryClient.invalidateQueries({ queryKey: ['juridico', 'advogados'] });
      queryClient.invalidateQueries({ queryKey: ['juridico', 'casos'] });
    },
  });

  const abrirCaso = useMutation({
    mutationFn: async (payload: AbrirCasoJuridicoPayload) => {
      const response = await juridicoApi.abrirCaso(payload);
      return response.data.data as CasoJuridico;
    },
    onSuccess: () => {
      toast.success('Atendimento jurídico iniciado.');
      queryClient.invalidateQueries({ queryKey: ['juridico', 'casos'] });
      queryClient.invalidateQueries({ queryKey: ['juridico', 'advogados'] });
    },
  });

  const enviarMensagem = useMutation({
    mutationFn: async ({ caseId, conteudo }: { caseId: string; conteudo: string }) => {
      const response = await juridicoApi.enviarMensagem(caseId, conteudo);
      return response.data.data as CasoJuridico;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['juridico', 'casos'] });
    },
  });

  const atualizarStatus = useMutation({
    mutationFn: async ({ caseId, status }: { caseId: string; status: StatusCasoJuridico }) => {
      const response = await juridicoApi.atualizarStatus(caseId, status);
      return response.data.data as CasoJuridico;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['juridico', 'casos'] });
      queryClient.invalidateQueries({ queryKey: ['juridico', 'advogados'] });
    },
  });

  const avaliarCaso = useMutation({
    mutationFn: async ({ caseId, nota, comentario }: { caseId: string; nota: number; comentario?: string }) => {
      const response = await juridicoApi.avaliarCaso(caseId, { nota, comentario });
      return response.data.data as CasoJuridico;
    },
    onSuccess: () => {
      toast.success('Avaliação registrada com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['juridico', 'casos'] });
      queryClient.invalidateQueries({ queryKey: ['juridico', 'advogados'] });
      queryClient.invalidateQueries({ queryKey: ['juridico', 'meu-perfil'] });
    },
  });

  return {
    planos: planosQuery.data ?? [],
    advogados: advogadosQuery.data ?? [],
    perfil: perfilQuery.data ?? null,
    assinatura: assinaturaQuery.data ?? null,
    casos: casosQuery.data ?? [],
    planosQuery,
    advogadosQuery,
    perfilQuery,
    assinaturaQuery,
    casosQuery,
    salvarPerfil,
    abrirCaso,
    enviarMensagem,
    atualizarStatus,
    avaliarCaso,
  };
}
