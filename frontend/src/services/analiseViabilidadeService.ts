import { AnaliseViabilidadeData } from '../types/analise-viabilidade.types';
import { analiseViabilidadeApi } from './api';

export async function fetchAnaliseViabilidade(editalId?: string): Promise<AnaliseViabilidadeData> {
  const response = await analiseViabilidadeApi.obterPorEdital(editalId);
  const result = response.data;
  
  if (!result || !result.success) {
    throw new Error(result?.message || 'Conexão com os portais governamentais temporariamente indisponível. Tentando novamente...');
  }

  return result.data as AnaliseViabilidadeData;
}