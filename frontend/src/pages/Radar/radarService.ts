import { EditalRadar, FiltrosRadar, MetricasRadar } from '../../types/radar.types';

export async function fetchEditaisRadar(filtros?: Partial<FiltrosRadar>): Promise<EditalRadar[]> {
  const queryParams = new URLSearchParams(filtros as Record<string, string>).toString();
  const response = await fetch(`/api/radar/editais?${queryParams}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.message);
  return result.data as EditalRadar[];
}

export async function fetchMetricasRadar(): Promise<MetricasRadar> {
  const response = await fetch('/api/radar/metricas');
  const result = await response.json();
  if (!result.success) throw new Error(result.message);
  return result.data as MetricasRadar;
}