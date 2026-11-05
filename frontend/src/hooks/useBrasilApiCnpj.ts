import { useCallback, useEffect, useRef, useState } from 'react';
import { isValidCnpj, sanitizeCnpj } from '@/utils/cnpj';

export interface BrasilApiCnpjRawResponse {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  cep?: string;
  descricao_tipo_de_logradouro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cnae_fiscal?: number | string;
  cnae_fiscal_descricao?: string;
  descricao_situacao_cadastral?: string;
  porte?: string;
}

export interface BrasilApiCnpjNormalizedData {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  cnaePrincipal: string;
  status: string;
}

export interface UseBrasilApiCnpjOptions {
  enabled?: boolean;
  onSuccess?: (data: BrasilApiCnpjNormalizedData) => void;
  onError?: (message: string) => void;
}

export const FRIENDLY_CNPJ_ERROR_MESSAGE =
  'Não foi possível buscar os dados da empresa. Por favor, preencha manualmente.';

function formatCep(rawCep?: string): string {
  const digits = String(rawCep || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return String(rawCep || '').trim();
}

function buildLogradouro(raw: BrasilApiCnpjRawResponse): string {
  const tipo = String(raw.descricao_tipo_de_logradouro || '').trim();
  const log = String(raw.logradouro || '').trim();
  const num = String(raw.numero || '').trim();

  const ruaBase =
    tipo && log && !log.toUpperCase().startsWith(tipo.toUpperCase())
      ? `${tipo} ${log}`
      : log || tipo;

  if (!ruaBase) return '';
  return num && num !== 'S/N' ? `${ruaBase}, ${num}` : ruaBase;
}

export function normalizeBrasilApiCnpjResponse(
  sanitizedCnpj: string,
  raw: BrasilApiCnpjRawResponse,
): BrasilApiCnpjNormalizedData {
  const razaoSocial = String(raw.razao_social || '').trim();
  const nomeFantasia = String(raw.nome_fantasia || '').trim() || razaoSocial;
  const cep = formatCep(raw.cep);
  const logradouro = buildLogradouro(raw);
  const bairro = String(raw.bairro || '').trim();
  const cidade = String(raw.municipio || '').trim();
  const uf = String(raw.uf || '').trim().toUpperCase().slice(0, 2);

  const cnaeCode = raw.cnae_fiscal ? String(raw.cnae_fiscal).trim() : '';
  const cnaeDesc = raw.cnae_fiscal_descricao ? String(raw.cnae_fiscal_descricao).trim() : '';
  const cnaePrincipal = cnaeCode && cnaeDesc ? `${cnaeCode} - ${cnaeDesc}` : cnaeDesc || cnaeCode;

  const status = String(raw.descricao_situacao_cadastral || raw.porte || 'ATIVA').trim();

  return {
    cnpj: sanitizedCnpj,
    razaoSocial,
    nomeFantasia,
    cep,
    logradouro,
    bairro,
    cidade,
    uf,
    cnaePrincipal,
    status,
  };
}

/**
 * Hook que escuta o campo de CNPJ e dispara automaticamente uma requisição GET
 * para `https://brasilapi.com.br/api/cnpj/v1/{cnpj}` assim que 14 caracteres válidos
 * são preenchidos, retornando estado de loading, dados normalizados e tratamento amigável de erro.
 */
export function useBrasilApiCnpj(
  cnpjInput: string,
  options: UseBrasilApiCnpjOptions = {},
) {
  const { enabled = true, onSuccess, onError } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BrasilApiCnpjNormalizedData | null>(null);

  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  const lastFetchedCnpjRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchByCnpj = useCallback(async (rawCnpj: string, force = false) => {
    const sanitized = sanitizeCnpj(rawCnpj);

    if (sanitized.length === 0) {
      setIsLoading(false);
      setError(null);
      lastFetchedCnpjRef.current = '';
      return null;
    }

    if (sanitized.length < 14) {
      setIsLoading(false);
      return null;
    }

    if (!isValidCnpj(sanitized, { optional: false })) {
      setIsLoading(false);
      setError(FRIENDLY_CNPJ_ERROR_MESSAGE);
      onErrorRef.current?.(FRIENDLY_CNPJ_ERROR_MESSAGE);
      return null;
    }

    if (!force && lastFetchedCnpjRef.current === sanitized) {
      return null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    lastFetchedCnpjRef.current = sanitized;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://brasilapi.com.br/api/cnpj/v1/${encodeURIComponent(sanitized)}`,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }

      const rawData = (await response.json()) as BrasilApiCnpjRawResponse;
      if (!rawData || typeof rawData !== 'object') {
        throw new Error('INVALID_PAYLOAD');
      }

      const normalized = normalizeBrasilApiCnpjResponse(sanitized, rawData);
      setData(normalized);
      setError(null);
      onSuccessRef.current?.(normalized);
      return normalized;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return null;
      }
      setError(FRIENDLY_CNPJ_ERROR_MESSAGE);
      onErrorRef.current?.(FRIENDLY_CNPJ_ERROR_MESSAGE);
      return null;
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const sanitized = sanitizeCnpj(cnpjInput);

    if (sanitized.length === 0) {
      setIsLoading(false);
      setError(null);
      lastFetchedCnpjRef.current = '';
      return;
    }

    if (sanitized.length < 14) {
      setIsLoading(false);
      if (error) setError(null);
      lastFetchedCnpjRef.current = '';
      return;
    }

    if (!isValidCnpj(sanitized, { optional: false })) {
      setIsLoading(false);
      setError(FRIENDLY_CNPJ_ERROR_MESSAGE);
      return;
    }

    void fetchByCnpj(sanitized);
  }, [cnpjInput, enabled, fetchByCnpj]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    isLoading,
    error,
    data,
    fetchByCnpj,
    clearError,
  };
}

