import { DocumentoCofre, MetricasCofre } from '../types/cofre.types';

export async function fetchDocumentosCofre(): Promise<DocumentoCofre[]> {
  const response = await fetch('/api/cofre/documentos');
  const result = await response.json();
  if (!result.success) throw new Error(result.message);
  return result.data as DocumentoCofre[];
}

export async function fetchMetricasCofre(): Promise<MetricasCofre> {
  const response = await fetch('/api/cofre/metricas');
  const result = await response.json();
  if (!result.success) throw new Error(result.message);
  return result.data as MetricasCofre;
}