import axios from 'axios';

const TRANSPARENCIA_API_KEY = process.env.TRANSPARENCIA_API_KEY || '';
const BASE_URL = 'https://api.portaldatransparencia.gov.br/api-de-dados';

export interface AnaliseSancoes {
  cnpj: string;
  temSancoes: boolean;
  registrosCEIS: number;
  registrosCNEP: number;
  detalhes: any[];
}

export async function checarSancoesCnpj(cnpj: string): Promise<AnaliseSancoes> {
  const cnpjLimpo = cnpj.replace(/\D/g, '');

  if (!TRANSPARENCIA_API_KEY) {
    console.warn('[TransparenciaService] TRANSPARENCIA_API_KEY não configurada. Ignorando checagem.');
    return {
      cnpj: cnpjLimpo,
      temSancoes: false,
      registrosCEIS: 0,
      registrosCNEP: 0,
      detalhes: [],
    };
  }

  try {
    const headers = { 'chave-api-dados': TRANSPARENCIA_API_KEY };

    const [resCeis, resCnep] = await Promise.allSettled([
      axios.get(`${BASE_URL}/ceis?cnpjSancionado=${cnpjLimpo}&pagina=1`, { headers }),
      axios.get(`${BASE_URL}/cnep?cnpjSancionado=${cnpjLimpo}&pagina=1`, { headers }),
    ]);

    const ceisData = resCeis.status === 'fulfilled' ? resCeis.value.data || [] : [];
    const cnepData = resCnep.status === 'fulfilled' ? resCnep.value.data || [] : [];

    const totalSancoes = ceisData.length + cnepData.length;

    return {
      cnpj: cnpjLimpo,
      temSancoes: totalSancoes > 0,
      registrosCEIS: ceisData.length,
      registrosCNEP: cnepData.length,
      detalhes: [...ceisData, ...cnepData],
    };
  } catch (error: any) {
    console.error('[TransparenciaService] Erro ao consultar sanções:', error.message);
    return {
      cnpj: cnpjLimpo,
      temSancoes: false,
      registrosCEIS: 0,
      registrosCNEP: 0,
      detalhes: [],
    };
  }
}