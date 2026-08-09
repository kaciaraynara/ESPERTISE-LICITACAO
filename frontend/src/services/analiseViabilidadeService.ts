import { AnaliseViabilidadeData } from '../types/analise-viabilidade.types';

export async function fetchAnaliseViabilidade(editalId: string): Promise<AnaliseViabilidadeData> {
  const response = await fetch(`/api/analise-viabilidade/${encodeURIComponent(editalId)}`);
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.message || 'Erro ao buscar análise de viabilidade');
  }

  return result.data as AnaliseViabilidadeData;
}