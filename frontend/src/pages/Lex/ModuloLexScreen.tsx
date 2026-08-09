import { AnaliseLexData, MinutaRecursoRequest, MinutaRecursoResponse } from '../../types/modulo-lex.types';

export async function fetchAnaliseLex(editalId: string): Promise<AnaliseLexData> {
  const response = await fetch(`/api/lex/analise/${encodeURIComponent(editalId)}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.message);
  return result.data as AnaliseLexData;
}

export async function solicitarMinutaRecurso(payload: MinutaRecursoRequest): Promise<MinutaRecursoResponse> {
  const response = await fetch('/api/lex/recurso', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.message);
  return result.data as MinutaRecursoResponse;
}