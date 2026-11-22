import axios from 'axios';
import { getNumberEnv, getStringEnv } from '../config/env';

function resolveTransparenciaBaseUrl(raw?: string): string {
  const clean = String(raw || '').trim().replace(/\/+$/, '');
  if (!clean) {
    return 'https://api.portaldatransparencia.gov.br/api-de-dados';
  }
  if (clean.includes('api.portaldatransparencia.gov.br')) {
    return clean.endsWith('/api-de-dados') ? clean : `${clean}/api-de-dados`;
  }
  if (clean.includes('portaldatransparencia.gov.br')) {
    return 'https://api.portaldatransparencia.gov.br/api-de-dados';
  }
  return clean;
}

function extractTransparenciaToken(raw?: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const match = trimmed.match(/"value"\s*:\s*"([^"]+)"/i);
    if (match?.[1]) return match[1].trim();
  }
  return trimmed;
}

const BASE_URL = resolveTransparenciaBaseUrl(
  getStringEnv(
    'PORTAL_TRANSPARENCIA_BASE_URL',
    'https://api.portaldatransparencia.gov.br/api-de-dados',
  ),
);
const REQUEST_TIMEOUT_MS = Math.max(1000, getNumberEnv('PORTAL_TRANSPARENCIA_TIMEOUT', 10000));

export interface AnaliseSancoes {
  cnpj: string;
  temSancoes: boolean | null;
  registrosCEIS: number;
  registrosCNEP: number;
  detalhes: any[];
  statusConsulta: 'OK' | 'CNPJ_INVALIDO' | 'TOKEN_NAO_CONFIGURADO' | 'ERRO_PROVEDOR';
}

export async function checarSancoesCnpj(cnpj: string): Promise<AnaliseSancoes> {
  const cnpjLimpo = normalizeCnpj(cnpj);
  if (!isValidCnpj(cnpjLimpo)) {
    return {
      cnpj: cnpjLimpo,
      temSancoes: null,
      registrosCEIS: 0,
      registrosCNEP: 0,
      detalhes: [],
      statusConsulta: 'CNPJ_INVALIDO',
    };
  }

  const apiKey = extractTransparenciaToken(
    process.env.PORTAL_TRANSPARENCIA_TOKEN
    || process.env.TRANSPARENCIA_API_KEY
    || process.env.PORTAL_TRANSPARENCIA_KEY
    || process.env.TRANSPARENCIA_TOKEN
    || process.env.CGU_API_KEY
    || process.env.TRANSPARENCIA_API_TOKEN,
  );

  if (!apiKey) {
    console.warn('[TransparenciaService] PORTAL_TRANSPARENCIA_TOKEN / TRANSPARENCIA_API_KEY não configurada.');
    return {
      cnpj: cnpjLimpo,
      temSancoes: null,
      registrosCEIS: 0,
      registrosCNEP: 0,
      detalhes: [],
      statusConsulta: 'TOKEN_NAO_CONFIGURADO',
    };
  }

  const headers = { 'chave-api-dados': apiKey };
  const params = { cnpjSancionado: cnpjLimpo, pagina: 1 };
  const [resCeis, resCnep] = await Promise.allSettled([
    axios.get(`${BASE_URL}/ceis`, { headers, params, timeout: REQUEST_TIMEOUT_MS }),
    axios.get(`${BASE_URL}/cnep`, { headers, params, timeout: REQUEST_TIMEOUT_MS }),
  ]);

  const ceisData = resCeis.status === 'fulfilled' && Array.isArray(resCeis.value.data)
    ? resCeis.value.data
    : [];
  const cnepData = resCnep.status === 'fulfilled' && Array.isArray(resCnep.value.data)
    ? resCnep.value.data
    : [];
  const consultaCompleta =
    resCeis.status === 'fulfilled' && Array.isArray(resCeis.value.data)
    && resCnep.status === 'fulfilled' && Array.isArray(resCnep.value.data);

  if (!consultaCompleta) {
    console.error('[TransparenciaService] Falha parcial ou resposta inválida na consulta CEIS/CNEP.', {
      ceis: resCeis.status === 'rejected' ? 'falhou' : 'resposta inválida',
      cnep: resCnep.status === 'rejected' ? 'falhou' : 'resposta inválida',
    });
  }

  const totalSancoes = ceisData.length + cnepData.length;

  return {
    cnpj: cnpjLimpo,
    temSancoes: consultaCompleta ? totalSancoes > 0 : null,
    registrosCEIS: ceisData.length,
    registrosCNEP: cnepData.length,
    detalhes: [...ceisData, ...cnepData],
    statusConsulta: consultaCompleta ? 'OK' : 'ERRO_PROVEDOR',
  };
}

function normalizeCnpj(value: string) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isValidCnpj(cnpj: string) {
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj) || /^([A-Z0-9])\1{13}$/.test(cnpj)) {
    return false;
  }

  const calculateDigit = (value: string, weights: number[]) => {
    const sum = [...value].reduce(
      (total, character, index) => total + (character.charCodeAt(0) - 48) * weights[index],
      0,
    );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (Number(cnpj[12]) !== firstDigit) return false;

  const secondDigit = calculateDigit(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return Number(cnpj[13]) === secondDigit;
}
