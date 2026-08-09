export async function fetchOportunidadesCRM(): Promise<any[]> {
  const response = await fetch('/api/crm/oportunidades');
  const result = await response.json();
  if (!result.success) throw new Error(result.message);
  return result.data as any[];
}

export async function updateEtapaOportunidade(id: string, etapa: string): Promise<boolean> {
  const response = await fetch(`/api/crm/oportunidades/${id}/etapa`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ etapa })
  });
  const result = await response.json();
  return result.success;
}

export async function fetchMetricasCRM(): Promise<any> {
  const response = await fetch('/api/crm/metricas');
  const result = await response.json();
  if (!result.success) throw new Error(result.message);
  return result.data as any;
}