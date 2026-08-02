import type { DataPipelineStage, DataSourceCode } from './types';

export interface DataPipelineMetricEntry {
  source: DataSourceCode;
  stage: DataPipelineStage;
  status: 'success' | 'error';
  durationMs: number;
  counters?: Record<string, number>;
  timestamp: Date;
}

export class DataPipelineMetricsService {
  private entries: DataPipelineMetricEntry[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries = 5000) {
    this.maxEntries = maxEntries;
  }

  record(entry: Omit<DataPipelineMetricEntry, 'timestamp'>) {
    this.entries.push({ ...entry, timestamp: new Date() });
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-Math.floor(this.maxEntries * 0.8));
    }
  }

  summary(windowMinutes = 60) {
    const cutoff = Date.now() - windowMinutes * 60_000;
    const recent = this.entries.filter((entry) => entry.timestamp.getTime() >= cutoff);
    const bySource = new Map<string, number>();
    const byStage = new Map<string, number>();
    let totalDuration = 0;
    let errors = 0;

    for (const entry of recent) {
      totalDuration += entry.durationMs;
      if (entry.status === 'error') errors += 1;
      bySource.set(entry.source, (bySource.get(entry.source) ?? 0) + 1);
      byStage.set(entry.stage, (byStage.get(entry.stage) ?? 0) + 1);
    }

    return {
      totalEvents: recent.length,
      errors,
      avgDurationMs: recent.length ? Math.round(totalDuration / recent.length) : 0,
      bySource: Object.fromEntries(bySource),
      byStage: Object.fromEntries(byStage),
    };
  }

  recent(limit = 50) {
    return this.entries.slice(-limit);
  }

  clear() {
    this.entries = [];
  }
}

export const dataPipelineMetrics = new DataPipelineMetricsService();
