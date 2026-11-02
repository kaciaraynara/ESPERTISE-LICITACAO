import axios from 'axios';
import { getNumberEnv, getStringEnv } from '../config/env';

const BASE_URL = getStringEnv(
  'PORTAL_TRANSPARENCIA_BASE_URL',
  'https://api.portaldatransparencia.gov.br/api-de-dados',
).replace(/\/+$/, '');
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

  const apiKey = (
    process.env.PORTAL_TRANSPARENCIA_TOKEN ||
    process.env.TRANSPARENCIA_API_KEY ||
    ''
  ).trim();

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
