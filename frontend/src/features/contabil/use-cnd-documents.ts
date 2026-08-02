import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import api, { documentosApi } from '@services/api';

import {
  type CndDocumentRecord,
  type DocumentoApiRecord,
  isCndDocument,
  mapDocumentoToCnd,
} from './cnd-documents';

type EmpresaResumo = {
  id: string;
  razao_social: string;
};

function extractArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const response = payload as {
    data?: unknown;
    items?: unknown;
  };

  if (Array.isArray(response.data)) {
    return response.data as T[];
  }

  if (Array.isArray(response.items)) {
    return response.items as T[];
  }

  return [];
}

function sortCertidoes(
  first: CndDocumentRecord,
  second: CndDocumentRecord,
): number {
  if (!first.vencimento && !second.vencimento) {
    return first.nome.localeCompare(second.nome);
  }

  if (!first.vencimento) {
    return 1;
  }

  if (!second.vencimento) {
    return -1;
  }

  const firstDate = new Date(first.vencimento).getTime();
  const secondDate = new Date(second.vencimento).getTime();

  if (
    Number.isNaN(firstDate)
    || Number.isNaN(secondDate)
  ) {
    return first.nome.localeCompare(second.nome);
  }

  return firstDate - secondDate;
}

export function useCndDocuments() {
  const empresasQuery = useQuery({
    queryKey: ['empresas'],
    queryFn: async () => {
      const response = await api.get('/empresas');

      return extractArray<EmpresaResumo>(response.data);
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const empresaPrincipal =
    empresasQuery.data?.[0] ?? null;

  const documentosQuery = useQuery({
    queryKey: [
      'documentos',
      empresaPrincipal?.id ?? 'sem-empresa',
    ],
    enabled: empresasQuery.isSuccess,
    queryFn: async () => {
      const response = await documentosApi.listar(
        empresaPrincipal?.id
          ? { empresa_id: empresaPrincipal.id }
          : undefined,
      );

      return extractArray<DocumentoApiRecord>(
        response.data,
      );
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const certidoes = useMemo<CndDocumentRecord[]>(
    () =>
      (documentosQuery.data ?? [])
        .filter(isCndDocument)
        .map(mapDocumentoToCnd)
        .sort(sortCertidoes),
    [documentosQuery.data],
  );

  async function refetch() {
    const empresasResult = await empresasQuery.refetch();

    if (empresasResult.isSuccess) {
      await documentosQuery.refetch();
    }
  }

  return {
    certidoes,
    empresaPrincipal,
    isLoading:
      empresasQuery.isLoading
      || documentosQuery.isLoading,
    isFetching:
      empresasQuery.isFetching
      || documentosQuery.isFetching,
    isError:
      empresasQuery.isError
      || documentosQuery.isError,
    refetch,
  };
}
