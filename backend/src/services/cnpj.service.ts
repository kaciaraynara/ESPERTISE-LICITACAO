import axios from 'axios';

export interface CnpjPublicoData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  municipio: string | null;
  uf: string | null;
  cnae_principal: string | null;
  status: string | null;
}

export function normalizarCnpj(value: string) {
  return value.replace(/\D/g, '');
}

function getBrasilApiBaseUrl() {
  return (process.env.BRASILAPI_URL || 'https://brasilapi.com.br').replace(/\/+$/, '');
}

export async function consultarCnpjOficial(cnpj: string): Promise<CnpjPublicoData> {
  const cnpjLimpo = normalizarCnpj(cnpj);

  if (cnpjLimpo.length !== 14) {
    throw new Error('CNPJ_INVALIDO');
  }

  const response = await axios.get(`${getBrasilApiBaseUrl()}/api/cnpj/v1/${cnpjLimpo}`, {
    timeout: 8000,
  });

  const data = response.data;

  return {
    cnpj: cnpjLimpo,
    razao_social: data.razao_social,
    nome_fantasia: data.nome_fantasia || data.razao_social,
    municipio: data.municipio || null,
    uf: data.uf || null,
    cnae_principal: data.cnae_fiscal && data.cnae_fiscal_descricao
      ? `${data.cnae_fiscal} - ${data.cnae_fiscal_descricao}`
      : null,
    status: data.descricao_situacao_cadastral || null,
  };
}
